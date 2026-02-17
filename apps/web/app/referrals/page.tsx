"use client";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "../../components/AppHeader";
import { BottomNav } from "../../components/BottomNav";
import { WalletSync } from "../../components/WalletSync";
import { api } from "../../lib/api";
import { getTelegramUser, ready } from "../../lib/telegram";

export default function Referrals() {
  const [me,setMe] = useState<any>(null);
  const [balance,setBalance] = useState<any>(null);
  const [stats,setStats] = useState<any>(null);

  const tgUser = useMemo(() => getTelegramUser(), []);

  async function refresh() {
    const [m,b,s] = await Promise.all([api.me(), api.balance(), api.refStats()]);
    setMe(m); setBalance(b); setStats(s);
  }
  useEffect(()=>{ ready(); refresh().catch(()=>{}); }, []);

  const refLink = useMemo(() => {
    if (!me?.tg_id) return "";
    const base = "https://t.me/YOUR_BOT?start=";
    return base + me.tg_id;
  }, [me]);

  return (
    <div className="page">
      <WalletSync />
      <AppHeader
        balanceTon={balance?.ton || "0.00"}
        username={me?.username || tgUser?.username || tgUser?.first_name || "user"}
        photoUrl={tgUser?.photo_url || null}
      />
      <div className="h2">Referrals</div>

      <div className="card">
        <div className="smallMuted">Invite and earn 0.25% from friend's bet</div>
        <div className="mt12" style={{fontWeight:900, wordBreak:"break-all"}}>{refLink || "—"}</div>
        <button className="btnBlue mt12" onClick={()=>{ navigator.clipboard?.writeText(refLink); alert("Copied"); }}>Copy link</button>
      </div>

      <div className="card mt12">
        <div className="row"><div style={{fontWeight:900}}>Invited</div><div>{stats?.invited ?? "—"}</div></div>
        <div className="row mt12"><div style={{fontWeight:900}}>Active</div><div>{stats?.active ?? "—"}</div></div>
        <div className="row mt12"><div style={{fontWeight:900}}>Friends stake</div><div>{stats?.friends_stake_ton ?? "—"} TON</div></div>
        <div className="row mt12"><div style={{fontWeight:900}}>Earned</div><div>{stats?.earned_ton ?? "—"} TON</div></div>
        <div className="row mt12"><div style={{fontWeight:900}}>Available</div><div>{stats?.available_ton ?? "—"} TON</div></div>
      </div>

      <BottomNav/>
    </div>
  );
}
