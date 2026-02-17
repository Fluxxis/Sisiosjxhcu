import fetch from "node-fetch";
import { Address, TonClient, WalletContractV4, internal } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

import { ledgerAdd } from "../db.js";
import { tonToNano } from "../lib/ton.js";

function safeParseAddress(addr) {
  try {
    const a = Address.parse(addr);
    // Use bounceable, urlSafe
    return a.toString({ urlSafe: true, bounceable: true });
  } catch {
    return String(addr || "").trim();
  }
}

async function toncenterGetTransactions({ baseUrl, apiKey, address, limit = 50 }) {
  const u = new URL(baseUrl.replace(/\/+$/, "") + "/getTransactions");
  u.searchParams.set("address", address);
  u.searchParams.set("limit", String(limit));

  const res = await fetch(String(u), {
    headers: apiKey ? { "X-API-Key": apiKey } : {}
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    const reason = data?.error || `toncenter_http_${res.status}`;
    throw new Error(reason);
  }
  return Array.isArray(data.result) ? data.result : [];
}

async function cryptopayCall({ baseUrl, token, method, params }) {
  const url = baseUrl.replace(/\/+$/, "") + "/api/" + method;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Crypto-Pay-API-Token": token
    },
    body: JSON.stringify(params || {})
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    const reason = data?.error || `cryptopay_http_${res.status}`;
    throw new Error(reason);
  }
  return data.result;
}

async function processTonConnectDeposits(fastify) {
  const treasury = String(fastify.config.TREASURY_ADDRESS || "").trim();
  const baseUrl = String(fastify.config.TONCENTER_BASE_URL || "").trim();
  if (!treasury || !baseUrl) return;

  const pending = await fastify.db.all(
    "SELECT * FROM deposits WHERE method='tonconnect' AND status IN ('created','sent') ORDER BY id ASC LIMIT 50"
  );
  if (!pending.length) return;

  // We match by: to=treasury (implicit because we query treasury txs) + from + amount + time
  let txs = [];
  try {
    txs = await toncenterGetTransactions({
      baseUrl,
      apiKey: String(fastify.config.TONCENTER_API_KEY || "").trim(),
      address: treasury,
      limit: 80
    });
  } catch (e) {
    // Do not crash the server if provider is down.
    return;
  }

  // Index inbound transfers by (from|amount)
  const inbound = [];
  for (const t of txs) {
    const utime = Number(t?.utime || 0);
    const h = t?.transaction_id?.hash || t?.id?.hash || null;
    const inMsg = t?.in_msg || t?.in_message || null;
    const from = inMsg?.source || inMsg?.src || "";
    const value = inMsg?.value || inMsg?.amount || "0";
    if (!from) continue;
    inbound.push({ utime, hash: h, from: safeParseAddress(from), value: String(value) });
  }

  for (const dep of pending) {
    const depFrom = dep.source_address ? safeParseAddress(dep.source_address) : "";
    const depAmount = String(dep.amount_nano);
    const createdAt = Date.parse(dep.created_at || "") || 0;
    const createdU = Math.floor(createdAt / 1000);

    // If user hasn't submitted the wallet address yet, do nothing.
    if (!depFrom) continue;

    const match = inbound.find(tx => {
      if (tx.value !== depAmount) return false;
      if (tx.from !== depFrom) return false;
      // allow a small clock skew
      return tx.utime >= createdU - 120;
    });

    if (!match) continue;

    // Mark confirmed + credit balance
    await fastify.db.run(
      "UPDATE deposits SET status='confirmed', confirmed_at=?, tx_hash=? WHERE id=? AND status!='confirmed'",
      new Date().toISOString(), match.hash, dep.id
    );
    await ledgerAdd(fastify.db, dep.tg_id, "deposit_confirmed", dep.amount_nano, {
      method: "tonconnect",
      deposit_id: dep.id,
      tx_hash: match.hash
    });
  }
}

async function processCryptoBotDeposits(fastify) {
  const token = String(fastify.config.CRYPTOBOT_API_TOKEN || "").trim();
  const baseUrl = String(fastify.config.CRYPTOBOT_BASE_URL || "").trim();
  if (!token || !baseUrl) return;

  const pending = await fastify.db.all(
    "SELECT * FROM deposits WHERE method='cryptobot' AND status IN ('invoice','active') AND invoice_id IS NOT NULL ORDER BY id ASC LIMIT 50"
  );
  if (!pending.length) return;

  const ids = pending.map(d => d.invoice_id).filter(Boolean);
  let result;
  try {
    result = await cryptopayCall({ baseUrl, token, method: "getInvoices", params: { invoice_ids: ids.join(",") } });
  } catch {
    return;
  }
  const invoices = Array.isArray(result?.items) ? result.items : (Array.isArray(result) ? result : []);
  const byId = new Map(invoices.map(inv => [Number(inv.invoice_id), inv]));

  for (const dep of pending) {
    const inv = byId.get(Number(dep.invoice_id));
    if (!inv) continue;
    const st = String(inv.status || "");
    if (st !== "paid") continue;

    await fastify.db.run(
      "UPDATE deposits SET status='confirmed', confirmed_at=? WHERE id=? AND status!='confirmed'",
      new Date().toISOString(), dep.id
    );
    await ledgerAdd(fastify.db, dep.tg_id, "deposit_confirmed", dep.amount_nano, {
      method: "cryptobot",
      deposit_id: dep.id,
      invoice_id: dep.invoice_id
    });
  }
}

function buildTonClient(fastify) {
  const endpoint = String(fastify.config.TON_RPC_URL || "").trim();
  const apiKey = String(fastify.config.TONCENTER_API_KEY || "").trim();
  if (!endpoint) return null;
  return new TonClient({
    endpoint,
    apiKey: apiKey || undefined
  });
}

async function processWithdrawals(fastify, client, walletCtx) {
  const minNano = tonToNano(String(fastify.config.MIN_WITHDRAW_TON || "1"));
  const treasuryMnemonic = String(fastify.config.TREASURY_MNEMONIC || "").trim();
  const treasuryAddrCfg = String(fastify.config.TREASURY_ADDRESS || "").trim();
  if (!treasuryMnemonic || !treasuryAddrCfg || !client) return;

  // Pick one queued withdrawal (sequential to avoid seqno races)
  const w = await fastify.db.get(
    "SELECT * FROM withdrawals WHERE status='queued' ORDER BY id ASC LIMIT 1"
  );
  if (!w) return;

  // Lock row
  const locked = await fastify.db.run(
    "UPDATE withdrawals SET status='processing' WHERE id=? AND status='queued'",
    w.id
  );
  if (locked.changes !== 1) return;

  try {
    const amountNano = BigInt(w.amount_nano);
    if (amountNano < minNano) throw new Error("min_withdraw");

    const to = String(w.to_address || "").trim();
    if (!to) throw new Error("wallet_required");

    // Init wallet contract once
    if (!walletCtx.wallet) {
      const words = treasuryMnemonic.split(/\s+/).filter(Boolean);
      if (words.length < 12) throw new Error("bad_treasury_mnemonic");
      const keyPair = await mnemonicToPrivateKey(words);
      const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
      walletCtx.wallet = wallet;
      walletCtx.keyPair = keyPair;
      walletCtx.opened = client.open(wallet);

      const computed = wallet.address.toString({ urlSafe: true, bounceable: true });
      walletCtx.computedAddress = computed;
      if (safeParseAddress(treasuryAddrCfg) !== safeParseAddress(computed)) {
        // Not fatal, but will confuse. Keep going.
        walletCtx.warnedMismatch = true;
      }
    }

    const opened = walletCtx.opened;
    const seqno = await opened.getSeqno();

    // Build & send transfer
    const sendResult = await opened.sendTransfer({
      seqno,
      secretKey: walletCtx.keyPair.secretKey,
      messages: [
        internal({
          to: Address.parse(to),
          value: amountNano,
          bounce: false
        })
      ]
    });

    // sendTransfer doesn't return tx hash reliably; we mark as paid and let operator review if needed.
    await fastify.db.run(
      "UPDATE withdrawals SET status='paid', paid_at=?, tx_hash=? WHERE id=?",
      new Date().toISOString(), null, w.id
    );
    await ledgerAdd(fastify.db, w.tg_id, "withdraw_paid", "0", {
      withdrawal_id: w.id,
      to_address: to
    });
    return sendResult;
  } catch (e) {
    const reason = String(e?.message || "withdraw_failed");
    // refund
    await fastify.db.run(
      "UPDATE withdrawals SET status='failed', error=? WHERE id=?",
      reason, w.id
    );
    await ledgerAdd(fastify.db, w.tg_id, "withdraw_failed_refund", w.amount_nano, {
      withdrawal_id: w.id,
      reason
    });
  }
}

export function startPaymentsWorker(fastify) {
  const depositMs = Math.max(2000, Number(fastify.config.DEPOSIT_POLL_MS || 6000));
  const withdrawMs = Math.max(2000, Number(fastify.config.WITHDRAW_POLL_MS || 4000));

  const client = buildTonClient(fastify);
  const walletCtx = { wallet: null, opened: null, keyPair: null, computedAddress: null, warnedMismatch: false };

  // Deposit confirmations (TON Connect + CryptoBot)
  setInterval(() => {
    processTonConnectDeposits(fastify).catch(() => {});
    processCryptoBotDeposits(fastify).catch(() => {});
  }, depositMs);

  // Withdrawals
  setInterval(() => {
    processWithdrawals(fastify, client, walletCtx).catch(() => {});
  }, withdrawMs);
}
