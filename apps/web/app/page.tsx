'use client';

import { useEffect, useMemo, useState } from 'react';

import { AppHeader } from '../components/AppHeader';
import { BottomNav } from '../components/BottomNav';
import { JackpotReel } from '../components/JackpotReel';
import { TopToast } from '../components/TopToast';
import { WalletSync } from '../components/WalletSync';

import { api } from '../lib/api';
import { getTelegramUser, ready } from '../lib/telegram';

function sanitizeTonAmount(input: string) {
  const a = String(input).replace(',', '.').replace(/[^0-9.]/g, '');
  const parts = a.split('.');
  if (parts.length === 1) return parts[0];
  return `${parts[0]}.${(parts[1] || '').slice(0, 2)}`;
}

export default function Home() {
  const [me, setMe] = useState<any>(null);
  const [balance, setBalance] = useState<any>(null);
  const [state, setState] = useState<any>(null);

  const [betAmount, setBetAmount] = useState('0.03');
  const [busy, setBusy] = useState(false);

  const [spinning, setSpinning] = useState(false);
  const [winning, setWinning] = useState<number | null>(null);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastKind, setToastKind] = useState<'error' | 'success'>('error');
  const [toastTitle, setToastTitle] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const tgUser = useMemo(() => getTelegramUser(), []);

  const bankPct = useMemo(() => {
    const b = parseFloat(state?.bank_ton || '0');
    const t = parseFloat(state?.target_bank_ton || '0.10');
    if (t <= 0) return 0;
    return Math.min(100, (b / t) * 100);
  }, [state]);

  function showToast(kind: 'error' | 'success', title: string, message: string) {
    setToastKind(kind);
    setToastTitle(title);
    setToastMsg(message);
    setToastOpen(true);
  }

  async function refresh() {
    const [m, b, s] = await Promise.all([api.me(), api.balance(), api.jackpotState()]);
    setMe(m);
    setBalance(b);
    setState(s);
  }

  useEffect(() => {
    ready();
    refresh().catch(() => {});
  }, []);

  async function onBet() {
    setBusy(true);
    try {
      const res = await api.bet(sanitizeTonAmount(betAmount));
      await refresh();
      if (res.resolved && res.winning_index) {
        setWinning(res.winning_index);
        setSpinning(true);
      }
    } catch (e: any) {
      showToast('error', 'Ошибка', e?.data?.reason || 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <WalletSync />

      <TopToast
        kind={toastKind}
        title={toastTitle}
        message={toastMsg}
        open={toastOpen}
        onClose={() => setToastOpen(false)}
      />

      <AppHeader
        balanceTon={balance?.ton || '0.00'}
        username={me?.username || tgUser?.username || tgUser?.first_name || 'user'}
        photoUrl={tgUser?.photo_url || null}
      />

      <div className="h2">Jackpot</div>

      <JackpotReel
        winningIndex={winning}
        spinning={spinning}
        onDone={() => {
          setSpinning(false);
          showToast('success', 'Готово', `Выпал предмет #${winning}`);
        }}
      />

      <div className="card mt12">
        <div className="row">
          <div style={{ fontWeight: 900 }}>Round #{state?.round_id || '—'}</div>
          <div className="smallMuted">
            {state?.bank_ton || '0'} / {state?.target_bank_ton || '0.10'} TON
          </div>
        </div>

        <div
          style={{
            height: 10,
            background: '#f1f3f7',
            borderRadius: 99,
            overflow: 'hidden',
            marginTop: 10,
            border: '1px solid #e7ebf0'
          }}
        >
          <div style={{ height: '100%', width: `${bankPct}%`, background: '#2f7cf6' }} />
        </div>

        <div className="mt16 row">
          <div className="smallMuted">Сумма ставки (TON)</div>
          <input
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            style={{
              width: 140,
              height: 40,
              borderRadius: 12,
              border: '1px solid #e7ebf0',
              padding: '0 10px',
              fontWeight: 900
            }}
            inputMode="decimal"
          />
        </div>

        <div className="mt12">
          <button className="btnPrimary" disabled={busy || spinning} onClick={onBet}>
            {spinning ? 'Rolling...' : 'Сделать ставку'}
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
