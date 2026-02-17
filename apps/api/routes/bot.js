export function botRoutes(fastify) {
  fastify.post("/bot/start", async (req) => {
    const tgId = Number(req.body?.tg_id || 0);
    const username = String(req.body?.username || "user").slice(0, 64);
    const referrer = Number(req.body?.referrer_tg_id || 0) || null;
    if (!tgId) return { ok:false };

    const row = await fastify.db.get("SELECT * FROM users WHERE tg_id=?", tgId);
    if (!row) {
      await fastify.db.run("INSERT INTO users(tg_id,username,registered_at,referrer_tg_id) VALUES(?,?,?,?)",
        tgId, username, new Date().toISOString(), referrer
      );
    } else if (!row.referrer_tg_id && referrer && referrer !== tgId) {
      await fastify.db.run("UPDATE users SET referrer_tg_id=? WHERE tg_id=?", referrer, tgId);
    }
    return { ok:true };
  });
}
