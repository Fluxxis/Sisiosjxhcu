import { requireUser } from "./me.js";
import { tonToNano, nanoToTon } from "../lib/ton.js";
import { ledgerAdd, getCashbackNano, getReferralNano } from "../db.js";
import { checkRequiredChannels } from "../lib/subscription.js";
import crypto from "crypto";

function todayKey(){ return new Date().toISOString().slice(0,10); }

export function bonusRoutes(fastify) {
  fastify.get("/bonuses/status", async (req, reply) => {
    try{
      const u = await requireUser(fastify, req);
      const key = `daily_bonus:${u.tg_id}:${todayKey()}`;
      const row = await fastify.db.get("SELECT value_json FROM settings WHERE key=?", key);
      return { ok:true, claimed: !!row };
    }catch{
      return reply.code(401).send({ ok:false });
    }
  });

  fastify.post("/bonuses/daily/claim", async (req, reply) => {
    try{
      const u = await requireUser(fastify, req);

      const s = await fastify.db.get("SELECT value_json FROM settings WHERE key='required_channels'");
      const channels = s ? JSON.parse(s.value_json) : [];
      const gate = await checkRequiredChannels({
        botToken: fastify.config.BOT_TOKEN,
        tgId: u.tg_id,
        channels,
        skip: fastify.config.SKIP_SUB_CHECK === "1"
      });
      if (!gate.ok) return reply.code(403).send({ ok:false, reason:"subscribe_required", missing: gate.missing });

      const key = `daily_bonus:${u.tg_id}:${todayKey()}`;
      const already = await fastify.db.get("SELECT value_json FROM settings WHERE key=?", key);
      if (already) return reply.code(400).send({ ok:false, reason:"already_claimed" });

      const pool = ["0.05","0.10","0.05","0.05"];
      const h = crypto.createHash("sha256").update(`${u.tg_id}|${todayKey()}`).digest("hex");
      const r = parseInt(h.slice(0,6), 16) / 0x1000000;
      const idx = Math.min(pool.length-1, Math.floor(r * pool.length));
      const amountNano = tonToNano(pool[idx]);

      await ledgerAdd(fastify.db, u.tg_id, "deposit_confirmed", amountNano.toString(), { source:"daily_bonus" });
      await fastify.db.run("INSERT INTO settings(key,value_json) VALUES(?,?)", key, JSON.stringify({ amount_nano: amountNano.toString() }));
      return { ok:true, amount_ton: nanoToTon(amountNano) };
    }catch{
      return reply.code(401).send({ ok:false });
    }
  });

  fastify.get("/bonuses/cashback", async (req, reply) => {
    try{
      const u = await requireUser(fastify, req);
      const cb = await getCashbackNano(fastify.db, u.tg_id);
      return { ok:true, available_ton: nanoToTon(cb) };
    }catch{
      return reply.code(401).send({ ok:false });
    }
  });

  fastify.post("/bonuses/cashback/claim", async (req, reply) => {
    try{
      const u = await requireUser(fastify, req);

      const s = await fastify.db.get("SELECT value_json FROM settings WHERE key='required_channels'");
      const channels = s ? JSON.parse(s.value_json) : [];
      const gate = await checkRequiredChannels({
        botToken: fastify.config.BOT_TOKEN,
        tgId: u.tg_id,
        channels,
        skip: fastify.config.SKIP_SUB_CHECK === "1"
      });
      if (!gate.ok) return reply.code(403).send({ ok:false, reason:"subscribe_required", missing: gate.missing });

      const cb = await getCashbackNano(fastify.db, u.tg_id);
      if (cb <= 0n) return reply.code(400).send({ ok:false, reason:"nothing_to_claim" });

      await ledgerAdd(fastify.db, u.tg_id, "deposit_confirmed", cb.toString(), { source:"cashback_claim" });
      await fastify.db.run("UPDATE cashback SET available_nano='0' WHERE tg_id=?", u.tg_id);
      return { ok:true, amount_ton: nanoToTon(cb) };
    }catch{
      return reply.code(401).send({ ok:false });
    }
  });

  fastify.get("/bonuses/referral", async (req, reply) => {
    try{
      const u = await requireUser(fastify, req);
      const rf = await getReferralNano(fastify.db, u.tg_id);
      return { ok:true, available_ton: nanoToTon(rf) };
    }catch{
      return reply.code(401).send({ ok:false });
    }
  });

  fastify.post("/bonuses/referral/claim", async (req, reply) => {
    try{
      const u = await requireUser(fastify, req);

      const s = await fastify.db.get("SELECT value_json FROM settings WHERE key='required_channels'");
      const channels = s ? JSON.parse(s.value_json) : [];
      const gate = await checkRequiredChannels({
        botToken: fastify.config.BOT_TOKEN,
        tgId: u.tg_id,
        channels,
        skip: fastify.config.SKIP_SUB_CHECK === "1"
      });
      if (!gate.ok) return reply.code(403).send({ ok:false, reason:"subscribe_required", missing: gate.missing });

      const rf = await getReferralNano(fastify.db, u.tg_id);
      if (rf <= 0n) return reply.code(400).send({ ok:false, reason:"nothing_to_claim" });

      await ledgerAdd(fastify.db, u.tg_id, "deposit_confirmed", rf.toString(), { source:"referral_claim" });
      await fastify.db.run("UPDATE referral_earnings SET available_nano='0' WHERE tg_id=?", u.tg_id);
      return { ok:true, amount_ton: nanoToTon(rf) };
    }catch{
      return reply.code(401).send({ ok:false });
    }
  });
}
