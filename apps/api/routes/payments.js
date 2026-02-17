import { requireUser } from "./me.js";
import { tonToNano, nanoToTon } from "../lib/ton.js";
import { ledgerAdd, getBalanceNano } from "../db.js";
import { checkRequiredChannels } from "../lib/subscription.js";
import fetch from "node-fetch";

function isAdmin(fastify, tgId) {
  const admins = String(fastify.config.ADMIN_TG_IDS || "").split(",").map(s=>s.trim()).filter(Boolean);
  return admins.includes(String(tgId));
}

export function paymentRoutes(fastify) {
  // --- Deposits ---
  // Legacy/manual deposit (kept for backwards compatibility)
  fastify.post("/deposits/create", async (req, reply) => {
    try{
      const u = await requireUser(fastify, req);
      const amountTon = String(req.body?.amount_ton || "").trim();
      const amountNano = tonToNano(amountTon);
      if (amountNano <= 0n) return reply.code(400).send({ ok:false, reason:"bad_amount" });

      const comment = `DEP-${u.tg_id}-${Date.now()}`;
      const now = new Date().toISOString();
      const r = await fastify.db.run(
        "INSERT INTO deposits(tg_id,amount_nano,status,created_at,comment,method) VALUES(?,?,?,?,?,?)",
        u.tg_id, amountNano.toString(), "pending", now, comment, "manual"
      );
      await ledgerAdd(fastify.db, u.tg_id, "deposit_pending", amountNano.toString(), { deposit_id: r.lastID, comment, method:"manual" });
      return { ok:true, deposit_id:r.lastID, amount_ton:nanoToTon(amountNano), treasury_address: fastify.config.TREASURY_ADDRESS || "", comment };
    }catch{
      return reply.code(401).send({ ok:false });
    }
  });

  // TON Connect deposit (user sends a TON transfer from their connected wallet)
  fastify.post("/deposits/tonconnect/create", async (req, reply) => {
    try {
      const u = await requireUser(fastify, req);
      const treasury = String(fastify.config.TREASURY_ADDRESS || "").trim();
      if (!treasury) return reply.code(500).send({ ok:false, reason:"treasury_not_configured" });

      const amountTon = String(req.body?.amount_ton || "").trim();
      const amountNano = tonToNano(amountTon);
      if (amountNano <= 0n) return reply.code(400).send({ ok:false, reason:"bad_amount" });

      const now = new Date().toISOString();
      const comment = `TC-${u.tg_id}-${Date.now()}`;
      const r = await fastify.db.run(
        "INSERT INTO deposits(tg_id,amount_nano,status,created_at,comment,method) VALUES(?,?,?,?,?,?)",
        u.tg_id, amountNano.toString(), "created", now, comment, "tonconnect"
      );
      await ledgerAdd(fastify.db, u.tg_id, "deposit_pending", amountNano.toString(), { deposit_id: r.lastID, method:"tonconnect" });
      return {
        ok:true,
        deposit_id: r.lastID,
        treasury_address: treasury,
        amount_ton: nanoToTon(amountNano),
        amount_nano: amountNano.toString(),
        comment
      };
    } catch {
      return reply.code(401).send({ ok:false });
    }
  });

  fastify.post("/deposits/tonconnect/submit", async (req, reply) => {
    try {
      const u = await requireUser(fastify, req);
      const depositId = Number(req.body?.deposit_id || 0);
      const sourceAddress = String(req.body?.source_address || "").trim();
      if (!depositId || !sourceAddress) return reply.code(400).send({ ok:false, reason:"bad_request" });

      const dep = await fastify.db.get("SELECT * FROM deposits WHERE id=?", depositId);
      if (!dep || dep.tg_id !== u.tg_id) return reply.code(404).send({ ok:false, reason:"not_found" });

      await fastify.db.run(
        "UPDATE deposits SET source_address=?, status='sent' WHERE id=?",
        sourceAddress, depositId
      );

      // Also store wallet on user profile (so withdrawals can work)
      await fastify.db.run("UPDATE users SET wallet_address=? WHERE tg_id=?", sourceAddress, u.tg_id);

      return { ok:true };
    } catch {
      return reply.code(401).send({ ok:false });
    }
  });

  // CryptoBot / Crypto Pay deposit ("Send" tab) — creates an invoice and returns a pay URL
  fastify.post("/deposits/cryptobot/create", async (req, reply) => {
    try {
      const u = await requireUser(fastify, req);
      const token = String(fastify.config.CRYPTOBOT_API_TOKEN || "").trim();
      const baseUrl = String(fastify.config.CRYPTOBOT_BASE_URL || "").trim();
      if (!token || !baseUrl) return reply.code(500).send({ ok:false, reason:"cryptobot_not_configured" });

      const amountTon = String(req.body?.amount_ton || "").trim();
      const amountNano = tonToNano(amountTon);
      if (amountNano <= 0n) return reply.code(400).send({ ok:false, reason:"bad_amount" });

      const now = new Date().toISOString();
      const r = await fastify.db.run(
        "INSERT INTO deposits(tg_id,amount_nano,status,created_at,method) VALUES(?,?,?,?,?)",
        u.tg_id, amountNano.toString(), "invoice", now, "cryptobot"
      );
      await ledgerAdd(fastify.db, u.tg_id, "deposit_pending", amountNano.toString(), { deposit_id: r.lastID, method:"cryptobot" });

      // Create invoice
      const url = baseUrl.replace(/\/+$/, "") + "/api/createInvoice";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Crypto-Pay-API-Token": token
        },
        body: JSON.stringify({
          asset: "TON",
          amount: nanoToTon(amountNano),
          description: "Raise TON deposit",
          payload: `dep:${r.lastID}`
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        await fastify.db.run("UPDATE deposits SET status='failed' WHERE id=?", r.lastID);
        return reply.code(502).send({ ok:false, reason: data?.error || `cryptobot_http_${res.status}` });
      }
      const inv = data.result;
      const invoiceId = Number(inv.invoice_id);
      const payUrl = inv.mini_app_invoice_url || inv.bot_invoice_url || inv.web_app_invoice_url || null;
      await fastify.db.run("UPDATE deposits SET invoice_id=?, status='active' WHERE id=?", invoiceId, r.lastID);

      return {
        ok:true,
        deposit_id: r.lastID,
        invoice_id: invoiceId,
        pay_url: payUrl,
        amount_ton: nanoToTon(amountNano)
      };
    } catch {
      return reply.code(401).send({ ok:false });
    }
  });

  // --- Withdrawals (automatic, no admin) ---
  fastify.post("/withdraw/request", async (req, reply) => {
    try{
      const u = await requireUser(fastify, req);
      const amountTon = String(req.body?.amount_ton || "").trim();
      const amountNano = tonToNano(amountTon);

      const minNano = tonToNano(fastify.config.MIN_WITHDRAW_TON || "1");
      if (amountNano < minNano) return reply.code(400).send({ ok:false, reason:"min_withdraw", min_ton:nanoToTon(minNano) });

      const s = await fastify.db.get("SELECT value_json FROM settings WHERE key='required_channels'");
      const channels = s ? JSON.parse(s.value_json) : [];
      const gate = await checkRequiredChannels({
        botToken: fastify.config.BOT_TOKEN,
        tgId: u.tg_id,
        channels,
        skip: fastify.config.SKIP_SUB_CHECK === "1"
      });
      if (!gate.ok) return reply.code(403).send({ ok:false, reason:"subscribe_required", missing: gate.missing });

      const userRow = await fastify.db.get("SELECT * FROM users WHERE tg_id=?", u.tg_id);
      const toAddress = String(userRow?.wallet_address || "").trim();
      if (!toAddress) return reply.code(400).send({ ok:false, reason:"wallet_required" });

      const bal = await getBalanceNano(fastify.db, u.tg_id);
      if (bal < amountNano) return reply.code(400).send({ ok:false, reason:"insufficient_balance" });

      const now = new Date().toISOString();
      const r = await fastify.db.run(
        "INSERT INTO withdrawals(tg_id,amount_nano,status,created_at,to_address) VALUES(?,?,?,?,?)",
        u.tg_id, amountNano.toString(), "queued", now, toAddress
      );
      await ledgerAdd(fastify.db, u.tg_id, "withdraw_requested", (-amountNano).toString(), { withdrawal_id:r.lastID, to_address: toAddress });

      return { ok:true, withdrawal_id:r.lastID, amount_ton:nanoToTon(amountNano) };
    }catch{
      return reply.code(401).send({ ok:false });
    }
  });

  fastify.post("/admin/deposits/:id/confirm", async (req, reply) => {
    const adminId = Number(req.headers["x-admin-tg-id"] || 0);
    if (!isAdmin(fastify, adminId)) return reply.code(403).send({ ok:false });

    const id = Number(req.params.id);
    const dep = await fastify.db.get("SELECT * FROM deposits WHERE id=?", id);
    if (!dep) return reply.code(404).send({ ok:false });
    if (dep.status === "confirmed") return { ok:true, already:true };

    await fastify.db.run("UPDATE deposits SET status='confirmed', confirmed_at=? WHERE id=?", new Date().toISOString(), id);
    await ledgerAdd(fastify.db, dep.tg_id, "deposit_confirmed", dep.amount_nano, { deposit_id:id });
    return { ok:true };
  });

  fastify.post("/admin/withdrawals/:id/pay", async (req, reply) => {
    const adminId = Number(req.headers["x-admin-tg-id"] || 0);
    if (!isAdmin(fastify, adminId)) return reply.code(403).send({ ok:false });

    const id = Number(req.params.id);
    const wd = await fastify.db.get("SELECT * FROM withdrawals WHERE id=?", id);
    if (!wd) return reply.code(404).send({ ok:false });
    if (wd.status === "paid") return { ok:true, already:true };

    const tx = String(req.body?.tx_hash || "").trim() || null;
    await fastify.db.run("UPDATE withdrawals SET status='paid', paid_at=?, tx_hash=? WHERE id=?",
      new Date().toISOString(), tx, id
    );
    await ledgerAdd(fastify.db, wd.tg_id, "withdraw_paid", "0", { withdrawal_id:id, tx_hash: tx });
    return { ok:true };
  });
}
