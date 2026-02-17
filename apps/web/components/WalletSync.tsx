'use client';

import React, { useEffect, useRef } from 'react';
import { useTonWallet } from '@tonconnect/ui-react';
import { api } from '../lib/api';

export function WalletSync() {
  const wallet = useTonWallet();
  const last = useRef<string>('');

  useEffect(() => {
    const addr = wallet?.account?.address;
    if (!addr || addr === last.current) return;
    last.current = addr;
    api.walletSet(addr).catch(() => {});
  }, [wallet?.account?.address]);

  return null;
}
