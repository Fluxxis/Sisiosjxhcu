import { requireUser } from "./me.js";
import { tonToNano, nanoToTon } from "../lib/ton.js";
import { ledgerAdd } from "../db.js";

function isAdmin(fastify, tgId) {
  const admins = String(fastify.config.ADMIN_TG_IDS || "").split(",").map(s=>s.trim()).filter(Boolean);
  return admins.includes(String(tgId));
}

export function promoRoutes(fastify) {
  fastify.post("/promo/activate", async (req, reply) => {
    try{
      const u = await requireUser(fastify, req);
      const code = String(req.body?.code || "").trim().toUpperCase();
      if (!code) return reply.code(400).send({ ok:false, reason:"missing_code" });

      const promo = await fastify.db.get("SELECT * FROM promo_codes WHERE code=?", code);
      if (!promo) return reply.code(404).send({ ok:false, reason:"not_found" });
      if (promo.uses >= promo.max_uses) return reply.code(400).send({ ok:false, reason:"exhausted" });

      const already = await fastify.db.get("SELECT * FROM promo_activations WHERE code=? AND tg_id=?", code, u.tg_id);
      if (already) return reply.code(400).send({ ok:false, reason:"already_used" });

      await fastify.db.run("INSERT INTO promo_activations(code,tg_id,created_at) VALUES(?,?,?)", code, u.tg_id, new Date().toISOString());
      await fastify.db.run("UPDATE promo_codes SET uses=uses+1 WHERE code=?", code);

      await ledgerAdd(fastify.db, u.tg_id, "deposit_confirmed", promo.amount_nano, { source:"promo", code });
      return { ok:true, amount_ton: nanoToTon(promo.amount_nano) };
    }catch{
      return reply.code(401).send({ ok:false });
    }
  });

  fastify.post("/admin/promo/create", async (req, reply) => {
    const adminId = Number(req.headers["x-admin-tg-id"] || 0);
    if (!isAdmin(fastify, adminId)) return reply.code(403).send({ ok:false });

    const code = String(req.body?.code || "").trim().toUpperCase();
    const amountTon = String(req.body?.amount_ton || "").trim();
    const maxUses = Number(req.body?.max_uses || 100);
    if (!code || !amountTon) return reply.code(400).send({ ok:false });

    const nano = tonToNano(amountTon);
    await fastify.db.run(
      "INSERT OR REPLACE INTO promo_codes(code,amount_nano,max_uses,uses,created_at) VALUES(?,?,?,?,?)",
      code, nano.toString(), maxUses, 0, new Date().toISOString()
    );
    return { ok:true };
  });
}
