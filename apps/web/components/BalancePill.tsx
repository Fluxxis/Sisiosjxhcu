'use client';

import React, { useMemo } from 'react';

function WalletIcon({ active }: { active: boolean }) {
  const color = active ? '#fff' : '#1f2a37';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 7.5C4 6.11929 5.11929 5 6.5 5H18.5C19.8807 5 21 6.11929 21 7.5V16.5C21 17.8807 19.8807 19 18.5 19H6.5C5.11929 19 4 17.8807 4 16.5V7.5Z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M17 12H21"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="17" cy="12" r="1.3" fill={color} />
    </svg>
  );
}

function ArrowUpIcon({ active }: { active: boolean }) {
  const color = active ? '#fff' : '#1f2a37';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 17V7" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M8 11L12 7L16 11" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BalancePill({
  balanceTon,
  onDepositClick,
  onWithdrawClick,
  active = null
}: {
  balanceTon: string;
  onDepositClick?: () => void;
  onWithdrawClick?: () => void;
  active?: 'deposit' | 'withdraw' | null;
}) {
  const isDepositActive = useMemo(() => active === 'deposit', [active]);
  const isWithdrawActive = useMemo(() => active === 'withdraw', [active]);

  return (
    <div className="pill">
      <button
        className={'pillBtn pillBtnSquare' + (isDepositActive ? ' active' : '')}
        onClick={onDepositClick}
        aria-label="deposit"
        type="button"
      >
        <WalletIcon active={isDepositActive} />
      </button>

      <div className="balanceText" style={{ flex: 1, textAlign: 'center' }}>
        {balanceTon} <span>TON</span>
      </div>

      <button
        className={'pillBtn pillBtnRound' + (isWithdrawActive ? ' active' : '')}
        onClick={onWithdrawClick}
        aria-label="withdraw"
        type="button"
      >
        <ArrowUpIcon active={isWithdrawActive} />
      </button>
    </div>
  );
}
