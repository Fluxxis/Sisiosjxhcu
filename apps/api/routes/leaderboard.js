import { nanoToTon } from "../lib/ton.js";

export function leaderboardRoutes(fastify) {
  fastify.get("/leaderboard/top", async () => {
    const rows = await fastify.db.all(`
      SELECT tg_id, SUM(-CAST(amount_nano AS INTEGER)) as vol
      FROM ledger
      WHERE type='bet'
      GROUP BY tg_id
      ORDER BY vol DESC
      LIMIT 50
    `);
    const out = [];
    for (const r of rows) {
      const u = await fastify.db.get("SELECT username FROM users WHERE tg_id=?", r.tg_id);
      out.push({ tg_id:r.tg_id, username:u?.username || ("user"+r.tg_id), volume_ton:nanoToTon(r.vol || 0) });
    }
    return { ok:true, top: out };
  });

  fastify.get("/tournament/prizes", async () => ({
    ok:true,
    prizes: [
      { place:1, title:"Record player", type:"gift" },
      { place:2, title:"5 TON", type:"ton", amount_ton:"5" },
      { place:3, title:"2 TON", type:"ton", amount_ton:"2" }
    ]
  }));
}
