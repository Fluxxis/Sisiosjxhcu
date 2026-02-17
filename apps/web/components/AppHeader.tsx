'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { TopBar } from './TopBar';
import { BalancePill } from './BalancePill';
import { ProfilePill } from './ProfilePill';

export function AppHeader({
  balanceTon,
  username,
  photoUrl
}: {
  balanceTon: string;
  username: string;
  photoUrl?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const active = pathname === '/deposit' ? 'deposit' : pathname === '/withdraw' ? 'withdraw' : null;

  return (
    <>
      <TopBar />

      <BalancePill
        balanceTon={balanceTon}
        active={active}
        onDepositClick={() => router.push('/deposit')}
        onWithdrawClick={() => router.push('/withdraw')}
      />

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <ProfilePill username={username} photoUrl={photoUrl} />
      </div>
    </>
  );
}
