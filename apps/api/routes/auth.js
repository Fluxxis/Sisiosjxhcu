import { verifyTelegramWebAppData } from "../lib/telegram.js";

export function authRoutes(fastify) {
  fastify.post("/auth/telegram", async (req, reply) => {
    const initData = req.headers["x-init-data"] || req.body?.initData || "";
    if (fastify.config.ALLOW_DEMO_AUTH === "1" && !initData) {
      return { ok:true, user:{ id:1, username:"demo" } };
    }
    const v = verifyTelegramWebAppData(String(initData), fastify.config.BOT_TOKEN);
    if (!v.ok || !v.user?.id) return reply.code(401).send({ ok:false, reason:v.reason });
    return { ok:true, user:{ id:v.user.id, username:v.user.username || v.user.first_name || "user" } };
  });
}
