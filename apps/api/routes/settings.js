function isAdmin(fastify, tgId) {
  const admins = String(fastify.config.ADMIN_TG_IDS || "").split(",").map(s=>s.trim()).filter(Boolean);
  return admins.includes(String(tgId));
}

export function settingsRoutes(fastify) {
  fastify.get("/requirements", async () => {
    const s = await fastify.db.get("SELECT value_json FROM settings WHERE key='required_channels'");
    return { required_channels: s ? JSON.parse(s.value_json) : [] };
  });

  fastify.get("/bot/admin/required-channels", async (req, reply) => {
    const adminId = Number(req.headers["x-admin-tg-id"] || 0);
    if (!isAdmin(fastify, adminId)) return reply.code(403).send({ ok:false });
    const s = await fastify.db.get("SELECT value_json FROM settings WHERE key='required_channels'");
    return { ok:true, required_channels: s ? JSON.parse(s.value_json) : [] };
  });

  fastify.post("/bot/admin/required-channels", async (req, reply) => {
    const adminId = Number(req.headers["x-admin-tg-id"] || 0);
    if (!isAdmin(fastify, adminId)) return reply.code(403).send({ ok:false });

    const channels = Array.isArray(req.body?.required_channels) ? req.body.required_channels : [];
    const clean = channels.map(c=>String(c).trim()).filter(Boolean);
    await fastify.db.run("UPDATE settings SET value_json=? WHERE key='required_channels'", JSON.stringify(clean));
    return { ok:true, required_channels: clean };
  });
}
