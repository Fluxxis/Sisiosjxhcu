'use client';

import { useEffect, useMemo, useState } from 'react';

import { AppHeader } from '../../components/AppHeader';
import { BottomNav } from '../../components/BottomNav';
import { DepositCard } from '../../components/DepositCard';
import { TopToast } from '../../components/TopToast';
import { WalletSync } from '../../components/WalletSync';

import { api } from '../../lib/api';
import { getTelegramUser, ready } from '../../lib/telegram';

export default function DepositPage() {
  const [me, setMe] = useState<any>(null);
  const [balance, setBalance] = useState<any>(null);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastKind, setToastKind] = useState<'error' | 'success'>('error');
  const [toastTitle, setToastTitle] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const tgUser = useMemo(() => getTelegramUser(), []);

  function showErrorRequireWallet() {
    setToastKind('error');
    setToastTitle('Возникла ошибка');
    setToastMsg('Сначала подключите кошелек');
    setToastOpen(true);
  }

  function showError(title: string, message: string) {
    setToastKind('error');
    setToastTitle(title);
    setToastMsg(message);
    setToastOpen(true);
  }

  function showSuccess(message: string) {
    setToastKind('success');
    setToastTitle('Готово');
    setToastMsg(message);
    setToastOpen(true);
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

      <div className="h2">Депозиты</div>
      <DepositCard onRequireWallet={showErrorRequireWallet} onError={showError} onSuccess={showSuccess} />

      <BottomNav />
    </div>
  );
}
