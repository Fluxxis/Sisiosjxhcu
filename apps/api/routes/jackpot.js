import crypto from "crypto";
import { requireUser } from "./me.js";
import { tonToNano, nanoToTon } from "../lib/ton.js";
import { ledgerAdd, getBalanceNano, addCashbackNano, addReferralNano } from "../db.js";
import { rollPrizeIndex, sha256Hex } from "../lib/prizeRoll.js";

function rndHex(n=32){ return crypto.randomBytes(n).toString("hex"); }

async function getOrCreateOpenRound(db, targetNano) {
  const open = await db.get("SELECT * FROM rounds WHERE status='open' ORDER BY id DESC LIMIT 1");
  if (open) return open;

  const serverSeed = rndHex(32);
  const commit = sha256Hex(serverSeed);
  const now = new Date().toISOString();
  await db.run(
    "INSERT INTO rounds(status,target_bank_nano,bank_nano,server_commit,server_seed,created_at) VALUES('open',?,?,?,?,?)",
    targetNano.toString(), "0", commit, serverSeed, now
  );
  return await db.get("SELECT * FROM rounds WHERE status='open' ORDER BY id DESC LIMIT 1");
}

function randFloat(seed, salt) {
  const h = sha256Hex(`${seed}|${salt}`);
  return parseInt(h.slice(0,12), 16) / 0x1000000000000;
}

function pickWinnerWeighted(entries, r) {
  let total = 0n;
  for (const e of entries) total += BigInt(e.amount_nano);
  if (total <= 0n) return entries[0]?.tg_id;

  const h = sha256Hex(`winner|${r}`);
  let x = BigInt("0x" + h.slice(0,16)) % total;

  for (const e of entries) {
    const a = BigInt(e.amount_nano);
    if (x < a) return e.tg_id;
    x -= a;
  }
  return entries[entries.length-1].tg_id;
}

async function resolveRound({ fastify, round }) {
  await fastify.db.run("UPDATE rounds SET status='resolving' WHERE id=?", round.id);

  const entries = await fastify.db.all("SELECT tg_id, amount_nano FROM entries WHERE round_id=?", round.id);
  if (entries.length === 0) {
    await fastify.db.run("UPDATE rounds SET status='closed', closed_at=? WHERE id=?", new Date().toISOString(), round.id);
    return { resolved:true };
  }

  const seed = `${round.server_seed}:${round.id}`;
  const rw = randFloat(seed, "winner");
  const winner = pickWinnerWeighted(entries, rw);

  const mode = fastify.config.DEMO_MODE === "1" ? "demo" : "prod";
  // Featured prize ids (demo mode). Backward-compatible with old key name.
  const demoMainIds = String((fastify.config.DEMO_MAIN_PRIZE_IDS || "1,2,3,4"))
    .split(",").map(s=>parseInt(s.trim(),10)).filter(Boolean);
  const demoMainProb = parseFloat(fastify.config.DEMO_MAIN_PROB || "0.9");
  const prizeIndex = rollPrizeIndex({ mode, seed, demoMainIds, demoMainProb });

  const bankNano = BigInt(round.bank_nano);
  await ledgerAdd(fastify.db, winner, "win", bankNano.toString(), { round_id: round.id, prizeIndex });

  const now = new Date().toISOString();
  await fastify.db.run(
    "INSERT INTO round_history(round_id, bank_nano, winner_tg_id, winning_nft_index, server_commit, server_seed_reveal, created_at) VALUES(?,?,?,?,?,?,?)",
    round.id, bankNano.toString(), winner, prizeIndex, round.server_commit, round.server_seed, now
  );

  await fastify.db.run(
    "UPDATE rounds SET status='closed', winner_tg_id=?, winning_nft_index=?, closed_at=? WHERE id=?",
    winner, prizeIndex, now, round.id
  );

  // API: frontend uses winning_index.
  return { resolved:true, winner_tg_id:winner, winning_index:prizeIndex, server_seed_reveal: round.server_seed };
}

export function jackpotRoutes(fastify) {
  fastify.get("/jackpot/state", async () => {
    const targetNano = tonToNano(fastify.config.ROUND_TARGET_TON || "0.10");
    const round = await getOrCreateOpenRound(fastify.db, targetNano);
    const entries = await fastify.db.all("SELECT tg_id, SUM(CAST(amount_nano AS INTEGER)) as amount_nano FROM entries WHERE round_id=? GROUP BY tg_id", round.id);

    let total = 0n;
    for (const e of entries) total += BigInt(e.amount_nano || "0");

    const participants = [];
    for (const e of entries) {
      const u = await fastify.db.get("SELECT username FROM users WHERE tg_id=?", e.tg_id);
      const a = BigInt(e.amount_nano || "0");
      const chance = total > 0n ? (Number(a) / Number(total))*100 : 0;
      participants.push({ tg_id:e.tg_id, username:u?.username || ("user"+e.tg_id), amount_ton:nanoToTon(a), chance_pct: chance.toFixed(2) });
    }
    participants.sort((a,b)=>parseFloat(b.amount_ton)-parseFloat(a.amount_ton));

    const histRows = await fastify.db.all("SELECT * FROM round_history ORDER BY id DESC LIMIT 20");
    const history = [];
    for (const h of histRows) {
      const u = await fastify.db.get("SELECT username FROM users WHERE tg_id=?", h.winner_tg_id);
      history.push({
        round_id: h.round_id,
        bank_ton: nanoToTon(h.bank_nano),
        winner_username: u?.username || ("user"+h.winner_tg_id),
        winner_tg_id: h.winner_tg_id,
        winning_index: h.winning_nft_index,
        server_commit: h.server_commit,
        server_seed_reveal: h.server_seed_reveal,
        created_at: h.created_at
      });
    }

    return {
      round_id: round.id,
      bank_ton: nanoToTon(round.bank_nano),
      target_bank_ton: nanoToTon(round.target_bank_nano),
      status: round.status,
      participants,
      history
    };
  });

  fastify.post("/jackpot/bet", async (req, reply) => {
    try{
      const u = await requireUser(fastify, req);
      const amountTon = String(req.body?.amount_ton || "").trim();
      const amountNano = tonToNano(amountTon);
      if (amountNano <= 0n) return reply.code(400).send({ ok:false, reason:"bad_amount" });

      const bal = await getBalanceNano(fastify.db, u.tg_id);
      if (bal < amountNano) return reply.code(400).send({ ok:false, reason:"insufficient_balance" });

      const targetNano = tonToNano(fastify.config.ROUND_TARGET_TON || "0.10");
      let round = await getOrCreateOpenRound(fastify.db, targetNano);

      await ledgerAdd(fastify.db, u.tg_id, "bet", (-amountNano).toString(), { round_id: round.id });
      await fastify.db.run("INSERT INTO entries(round_id,tg_id,amount_nano,created_at) VALUES(?,?,?,?)",
        round.id, u.tg_id, amountNano.toString(), new Date().toISOString()
      );

      const bankNano = BigInt(round.bank_nano) + amountNano;
      await fastify.db.run("UPDATE rounds SET bank_nano=? WHERE id=?", bankNano.toString(), round.id);
      round = await fastify.db.get("SELECT * FROM rounds WHERE id=?", round.id);

      // cashback
      const rakePct = parseFloat(fastify.config.RAKEBACK_PCT || "0.005");
      const rakeNano = BigInt(Math.floor(Number(amountNano) * rakePct));
      if (rakeNano > 0n) {
        await addCashbackNano(fastify.db, u.tg_id, rakeNano);
        await ledgerAdd(fastify.db, u.tg_id, "cashback_accrued", rakeNano.toString(), { round_id: round.id });
      }

      // referral
      const row = await fastify.db.get("SELECT referrer_tg_id FROM users WHERE tg_id=?", u.tg_id);
      const refId = row?.referrer_tg_id;
      const refPct = parseFloat(fastify.config.REFERRAL_PCT || "0.0025");
      const refNano = BigInt(Math.floor(Number(amountNano) * refPct));
      if (refId && refNano > 0n) {
        await addReferralNano(fastify.db, refId, refNano);
        await ledgerAdd(fastify.db, refId, "referral_accrued", refNano.toString(), { from_tg_id: u.tg_id, round_id: round.id });
      }

      // chance for UI
      const totals = await fastify.db.all("SELECT tg_id, SUM(CAST(amount_nano AS INTEGER)) as amount_nano FROM entries WHERE round_id=? GROUP BY tg_id", round.id);
      let total = 0n;
      let mine = 0n;
      for (const t of totals) {
        const a = BigInt(t.amount_nano || "0");
        total += a;
        if (t.tg_id === u.tg_id) mine = a;
      }
      const chance = total > 0n ? (Number(mine)/Number(total))*100 : 0;

      let resp = { ok:true, round_id: round.id, bank_ton:nanoToTon(bankNano), participant_chance_pct: chance.toFixed(2) };

      if (bankNano >= BigInt(round.target_bank_nano)) {
        const res = await resolveRound({ fastify, round });
        resp = { ...resp, resolved:true, winner_tg_id: res.winner_tg_id, winning_index: res.winning_index, server_seed_reveal: res.server_seed_reveal };
      }
      return resp;
    }catch{
      return reply.code(401).send({ ok:false });
    }
  });
}
