import fetch from "node-fetch";

export async function checkRequiredChannels({ botToken, tgId, channels, skip=false }) {
  if (skip) return { ok:true, missing:[] };
  if (!channels || channels.length === 0) return { ok:true, missing:[] };

  const missing = [];
  for (const ch of channels) {
    const chat_id = ch.startsWith("@") ? ch : "@"+ch;
    const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(chat_id)}&user_id=${tgId}`;
    try{
      const res = await fetch(url);
      const js = await res.json();
      const status = js?.result?.status;
      const ok = status === "member" || status === "administrator" || status === "creator";
      if (!ok) missing.push(chat_id);
    }catch{
      missing.push(chat_id);
    }
  }
  return { ok: missing.length===0, missing };
}
