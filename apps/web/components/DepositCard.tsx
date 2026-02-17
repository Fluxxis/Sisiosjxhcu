'use client';

import React, { useMemo, useState } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { api } from '../lib/api';
import { Segmented } from './Segmented';

function openLink(url: string) {
  try {
    // Telegram Mini App if available
    // @ts-ignore
    if (window?.Telegram?.WebApp?.openLink) {
      // @ts-ignore
      window.Telegram.WebApp.openLink(url);
      return;
    }
  } catch {}
  window.open(url, '_blank');
}

export function DepositCard({
  onRequireWallet,
  onError,
  onSuccess
}: {
  onRequireWallet: () => void;
  onError?: (title: string, message: string) => void;
  onSuccess?: (message: string) => void;
}) {
  const [mode, setMode] = useState<'ton' | 'send'>('ton');
  const [amount, setAmount] = useState('1.00');
  const [busy, setBusy] = useState(false);

  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();

  const amountSanitized = useMemo(() => {
    // Keep it simple: digits + dot, max 2 decimals
    const a = String(amount).replace(',', '.').replace(/[^0-9.]/g, '');
    const parts = a.split('.');
    if (parts.length === 1) return parts[0];
    return `${parts[0]}.${(parts[1] || '').slice(0, 2)}`;
  }, [amount]);

  async function handleTonDeposit() {
    if (!wallet?.account?.address) {
      onRequireWallet();
      try { tonConnectUI.openModal(); } catch {}
      return;
    }
    setBusy(true);
    try {
      const dep = await api.depositTonConnectCreate(amountSanitized);
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 5 * 60,
        messages: [
          {
            address: dep.treasury_address,
            amount: dep.amount_nano
          }
        ]
      });
      await api.depositTonConnectSubmit(dep.deposit_id, wallet.account.address);
      onSuccess?.('Транзакция отправлена');
    } catch (e: any) {
      const reason = e?.data?.reason || e?.message || 'Ошибка';
      onError?.('Ошибка', String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function handleSendDeposit() {
    setBusy(true);
    try {
      const inv = await api.depositCryptoBotCreate(amountSanitized);
      if (inv.pay_url) {
        openLink(inv.pay_url);
        onSuccess?.('Счет создан');
      } else {
        onError?.('Ошибка', 'Не удалось создать счет');
      }
    } catch (e: any) {
      const reason = e?.data?.reason || e?.message || 'Ошибка';
      onError?.('Ошибка', String(reason));
    } finally {
      setBusy(false);
    }
  }

  const buttonLabel = mode === 'send' ? 'Создать счет' : 'Депозит';

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <Segmented
          value={mode}
          options={[
            { value: 'ton', label: 'Ton' },
            { value: 'send', label: 'Send' }
          ]}
          onChange={(v) => setMode(v as any)}
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

      <div style={{ marginTop: 6, opacity: 0.6, fontWeight: 700 }}>
        Введите сумму депозита в TON
      </div>

      <button
        className="btnPrimary"
        onClick={mode === 'send' ? handleSendDeposit : handleTonDeposit}
        disabled={busy}
        style={{ marginTop: 14, width: '100%', height: 54, borderRadius: 18 }}
      >
        {busy ? '...' : buttonLabel}
      </button>
    </div>
  );
}
