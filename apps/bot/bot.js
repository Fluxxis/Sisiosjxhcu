const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");

function readJsonIfExists(p) {
  try {
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object") ? parsed : {};
  } catch (e) {
    console.error(`Config JSON error in ${p}:`, e?.message || e);
    return {};
  }
}

function loadConfig() {
  const base = readJsonIfExists(path.join(__dirname, "config.json"));
  const runtime = readJsonIfExists(path.join(__dirname, "config.runtime.json"));
  return Object.assign({}, base, runtime);
}

const CFG = loadConfig();

const fetch = (...args) => import("node-fetch").then(({default: f}) => f(...args));

const BOT_TOKEN = CFG.BOT_TOKEN;
const API_URL = CFG.API_URL || "http://localhost:8787";
const WEBAPP_URL = CFG.WEBAPP_URL || "http://localhost:3000";
const CHANNEL_URL = CFG.CHANNEL_URL || CFG.CHANNEL || "";
const CHAT_URL = CFG.CHAT_URL || CFG.CHAT || "";
const SUPPORT_URL = CFG.SUPPORT_URL || CFG.SUPPORT || "";
const ADMINS = String(CFG.ADMIN_TG_IDS || "").split(",").map(s=>s.trim()).filter(Boolean);

if (!BOT_TOKEN) {
  console.error("Missing BOT_TOKEN");
  process.exit(1);
}

function isAdmin(id){ return ADMINS.includes(String(id)); }

async function api(path, opts={}, adminId=null){
  const headers = Object.assign({ "Content-Type":"application/json" }, opts.headers||{});
  if (adminId) headers["x-admin-tg-id"] = String(adminId);
  const res = await fetch(API_URL+path, Object.assign({}, opts, { headers }));
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw Object.assign(new Error("API error"), { status:res.status, data });
  return data;
}

const bot = new TelegramBot(BOT_TOKEN, { polling:true });

bot.onText(/\/start(?:\s+(\d+))?/, async (msg, match) => {
  const tgId = msg.from.id;
  const username = msg.from.username || msg.from.first_name || "user";
  const ref = match && match[1] ? Number(match[1]) : null;

  try{
    await api("/bot/start", { method:"POST", body: JSON.stringify({ tg_id: tgId, username, referrer_tg_id: ref }) });
  }catch{}

  const rows = [];

  // 1) Start game (WebApp)
  rows.push([{ text: "🚀 Начать игру", web_app: { url: WEBAPP_URL } }]);

  // 2) Channel + Chat (URL buttons)
  const secondRow = [];
  if (CHANNEL_URL) secondRow.push({ text: "📢 Канал", url: CHANNEL_URL });
  if (CHAT_URL) secondRow.push({ text: "💬 Чат", url: CHAT_URL });
  if (secondRow.length) rows.push(secondRow);

  // 3) Support (URL button)
  if (SUPPORT_URL) rows.push([{ text: "🧑‍💻 Поддержка", url: SUPPORT_URL }]);

  const keyboard = { inline_keyboard: rows };

  const text =
    "Платформа Raise TON приветствует вас!\n\n" +
    "• Играйте в Джекпот и выигрывайте.\n" +
    "• Зарабатывайте, приглашая друзей.\n\n" +
    "Используйте кнопки ниже, чтобы начать.";

  bot.sendMessage(msg.chat.id, text, { reply_markup: keyboard });
});

bot.onText(/\/channels/, async (msg) => {
  try{
    const r = await api("/requirements");
    const list = r.required_channels || [];
    bot.sendMessage(msg.chat.id, "Required channels:\n" + (list.length? list.join("\n") : "(none)"));
  }catch(e){
    bot.sendMessage(msg.chat.id, "Error reading channels.");
  }
});

bot.onText(/\/setchannels\s+(.+)/, async (msg, match) => {
  const adminId = msg.from.id;
  if (!isAdmin(adminId)) return bot.sendMessage(msg.chat.id, "Forbidden.");

  const raw = (match && match[1]) ? String(match[1]).trim() : "";
  const arr = raw.toLowerCase()==="none" ? [] : raw.split(",").map(s=>s.trim()).filter(Boolean);

  try{
    const r = await api("/bot/admin/required-channels", {
      method:"POST",
      body: JSON.stringify({ required_channels: arr })
    }, adminId);
    bot.sendMessage(msg.chat.id, "Saved: " + (r.required_channels.length? r.required_channels.join(", ") : "(none)"));
  }catch(e){
    bot.sendMessage(msg.chat.id, "Error saving channels.");
  }
});

bot.onText(/\/confirm_deposit\s+(\d+)/, async (msg, match) => {
  const adminId = msg.from.id;
  if (!isAdmin(adminId)) return bot.sendMessage(msg.chat.id, "Forbidden.");
  const id = Number(match[1]);
  try{
    await api(`/admin/deposits/${id}/confirm`, { method:"POST", body:"{}" }, adminId);
    bot.sendMessage(msg.chat.id, `Deposit #${id} confirmed.`);
  }catch(e){
    bot.sendMessage(msg.chat.id, `Failed: ${e?.data?.reason || "error"}`);
  }
});

bot.onText(/\/pay_withdrawal\s+(\d+)(?:\s+(.+))?/, async (msg, match) => {
  const adminId = msg.from.id;
  if (!isAdmin(adminId)) return bot.sendMessage(msg.chat.id, "Forbidden.");
  const id = Number(match[1]);
  const tx = match[2] ? String(match[2]).trim() : "";
  try{
    await api(`/admin/withdrawals/${id}/pay`, { method:"POST", body: JSON.stringify({ tx_hash: tx || null }) }, adminId);
    bot.sendMessage(msg.chat.id, `Withdrawal #${id} marked as paid.`);
  }catch(e){
    bot.sendMessage(msg.chat.id, `Failed: ${e?.data?.reason || "error"}`);
  }
});

bot.on("polling_error", (e) => console.error("polling_error", e?.message || e));
console.log("Bot running...");
