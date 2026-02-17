import { requireUser } from "./me.js";
import { nanoToTon } from "../lib/ton.js";

export function txRoutes(fastify) {
  fastify.get("/transactions", async (req, reply) => {
    try{
      const u = await requireUser(fastify, req);
      const rows = await fastify.db.all("SELECT * FROM ledger WHERE tg_id=? ORDER BY id DESC LIMIT 100", u.tg_id);
      return rows.map(r => ({
        id: r.id,
        tg_id: r.tg_id,
        type: r.type,
        amount_ton: nanoToTon(r.amount_nano),
        created_at: r.created_at,
        meta: r.meta_json ? JSON.parse(r.meta_json) : null
      }));
    }catch{
      return reply.code(401).send({ ok:false });
    }
  });
}
