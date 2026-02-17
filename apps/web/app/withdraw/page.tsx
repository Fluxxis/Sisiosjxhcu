'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';

import { AppHeader } from '../../components/AppHeader';
import { BottomNav } from '../../components/BottomNav';
import { Segmented } from '../../components/Segmented';
import { TopToast } from '../../components/TopToast';
import { WalletSync } from '../../components/WalletSync';

import { api } from '../../lib/api';
import { getTelegramUser, ready } from '../../lib/telegram';

function sanitizeTonAmount(input: string) {
  const a = String(input).replace(',', '.').replace(/[^0-9.]/g, '');
  const parts = a.split('.');
  if (parts.length === 1) return parts[0];
  return `${parts[0]}.${(parts[1] || '').slice(0, 2)}`;
}

export default function WithdrawPage() {
  const [me, setMe] = useState<any>(null);
  const [balance, setBalance] = useState<any>(null);

  const [amount, setAmount] = useState('1.00');
  const [busy, setBusy] = useState(false);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastKind, setToastKind] = useState<'error' | 'success'>('error');
  const [toastTitle, setToastTitle] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const tgUser = useMemo(() => getTelegramUser(), []);
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();

  function showToast(kind: 'error' | 'success', title: string, message: string) {
    setToastKind(kind);
    setToastTitle(title);
    setToastMsg(message);
    setToastOpen(true);
  }

  function showErrorRequireWallet() {
    showToast('error', 'Возникла ошибка', 'Сначала подключите кошелек');
  }

  async function refresh() {
    const [m, b] = await Promise.all([api.me(), api.balance()]);
    setMe(m);
    setBalance(b);
  }

  useEffect(() => {
    ready();
    refresh().catch(() => {});
  }, []);

  async function requestWithdraw() {
    const a = sanitizeTonAmount(amount);
    if (!a) return;

    if (!wallet?.account?.address) {
      showErrorRequireWallet();
      try {
        tonConnectUI.openModal();
      } catch {}
      return;
    }

    setBusy(true);
    try {
      // ensure backend knows the wallet address
      await api.walletSet(wallet.account.address).catch(() => {});
      await api.withdrawRequest(a);
      showToast('success', 'Готово', 'Вывод поставлен в очередь');
      await refresh();
    } catch (e: any) {
      const reason = e?.data?.reason || 'Ошибка';
      if (reason === 'subscribe_required') {
        showToast('error', 'Ошибка', 'Нужно подписаться на каналы');
      } else if (reason === 'insufficient_balance') {
        showToast('error', 'Ошибка', 'Недостаточно средств');
      } else if (reason === 'min_withdraw') {
        showToast('error', 'Ошибка', `Минимум ${e?.data?.min_ton || '1'} TON`);
      } else if (reason === 'wallet_required') {
        showErrorRequireWallet();
      } else {
        showToast('error', 'Ошибка', reason);
      }
    } finally {
      setBusy(false);
    }
  }

  const amountSanitized = useMemo(() => sanitizeTonAmount(amount), [amount]);

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

      <div className="h2">Вывод</div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <Segmented
            value={'ton'}
            options={[{ value: 'ton', label: 'Ton' }]}
            onChange={() => {}}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <input
            value={amountSanitized}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            style={{
              fontSize: 58,
              fontWeight: 900,
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent'
            }}
          />
        </div>

        <div style={{ marginTop: 6, opacity: 0.6, fontWeight: 700 }}>Введите сумму вывода</div>

        <button
          className="btnPrimary"
          onClick={requestWithdraw}
          disabled={busy}
          style={{ marginTop: 14, width: '100%', height: 54, borderRadius: 18 }}
        >
          {busy ? '...' : 'Вывести'}
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
