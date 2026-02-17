import crypto from "crypto";

export function verifyTelegramWebAppData(initData, botToken) {
  if (!initData) return { ok:false, reason:"missing_init_data" };
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok:false, reason:"missing_hash" };
  params.delete("hash");

  const entries = Array.from(params.entries()).sort(([a],[b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k,v]) => `${k}=${v}`).join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (computed !== hash) return { ok:false, reason:"bad_hash" };

  const userRaw = params.get("user");
  let user = null;
  if (userRaw) { try { user = JSON.parse(userRaw); } catch {} }
  return { ok:true, user };
}
