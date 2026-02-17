import { verifyTelegramWebAppData } from "../lib/telegram.js";
import { getBalanceNano, getCashbackNano, getReferralNano, formatBalance } from "../db.js";

export async function requireUser(fastify, req) {
  const initData = String(req.headers["x-init-data"] || "");
  if (fastify.config.ALLOW_DEMO_AUTH === "1" && !initData) return { tg_id:1, username:"demo" };

  const v = verifyTelegramWebAppData(initData, fastify.config.BOT_TOKEN);
  if (!v.ok || !v.user?.id) throw new Error("UNAUTH");
  return { tg_id: v.user.id, username: v.user.username || v.user.first_name || "user" };
}

export function meRoutes(fastify) {
  fastify.get("/me", async (req, reply) => {
    try{
      const u = await requireUser(fastify, req);
      const row = await fastify.db.get("SELECT * FROM users WHERE tg_id=?", u.tg_id);
      if (!row) {
        await fastify.db.run("INSERT INTO users(tg_id,username,registered_at) VALUES(?,?,?)",
          u.tg_id, u.username, new Date().toISOString()
        );
      }
      const user = await fastify.db.get("SELECT * FROM users WHERE tg_id=?", u.tg_id);
      return {
        tg_id: user.tg_id,
        username: user.username,
        registered_at: user.registered_at,
        wallet_address: user.wallet_address || null,
        referrer_tg_id: user.referrer_tg_id || null
      };
    }catch{
      return reply.code(401).send({ ok:false });
    }
  });

  fastify.get("/balance", async (req, reply) => {
    try{
      const u = await requireUser(fastify, req);
      const bal = await getBalanceNano(fastify.db, u.tg_id);
      const cb = await getCashbackNano(fastify.db, u.tg_id);
      const rf = await getReferralNano(fastify.db, u.tg_id);
      return formatBalance(bal, cb, rf);
    }catch{
      return reply.code(401).send({ ok:false });
    }
  });

  fastify.post("/wallet/set", async (req, reply) => {
    try{
      const u = await requireUser(fastify, req);
      const address = String(req.body?.address || "").trim();
      if (!address) return reply.code(400).send({ ok:false, reason:"missing_address" });
      await fastify.db.run("UPDATE users SET wallet_address=? WHERE tg_id=?", address, u.tg_id);
      return { ok:true };
    }catch{
      return reply.code(401).send({ ok:false });
    }
  });
}
