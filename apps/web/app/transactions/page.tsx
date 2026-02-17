"use client";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "../../components/AppHeader";
import { BottomNav } from "../../components/BottomNav";
import { WalletSync } from "../../components/WalletSync";
import { api } from "../../lib/api";
import { getTelegramUser, ready } from "../../lib/telegram";

export default function Transactions() {
  const [me,setMe] = useState<any>(null);
  const [balance,setBalance] = useState<any>(null);
  const [rows,setRows] = useState<any[]>([]);

  const tgUser = useMemo(() => getTelegramUser(), []);

  async function refresh() {
    const [m,b,t] = await Promise.all([api.me(), api.balance(), api.transactions()]);
    setMe(m); setBalance(b); setRows(t);
  }
  useEffect(()=>{ ready(); refresh().catch(()=>{}); }, []);

  return (
    <div className="page">
      <WalletSync />
      <AppHeader
        balanceTon={balance?.ton || "0.00"}
        username={me?.username || tgUser?.username || tgUser?.first_name || "user"}
        photoUrl={tgUser?.photo_url || null}
      />
      <div className="h2">Transactions</div>

      <div className="card">
        {rows.length===0 && <div className="smallMuted">No transactions</div>}
        {rows.map(r => (
          <div key={r.id} style={{padding:"10px 0", borderBottom:"1px solid #eef2f6"}}>
            <div className="row">
              <div style={{fontWeight:900}}>{r.type}</div>
              <div style={{fontWeight:900}}>{r.amount_ton} TON</div>
            </div>
            <div className="smallMuted" style={{marginTop:4}}>{new Date(r.created_at).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <BottomNav/>
    </div>
  );
}
