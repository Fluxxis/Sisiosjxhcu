'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);

  useEffect(() => {
    setManifestUrl(`${window.location.origin}/tonconnect-manifest.json`);
  }, []);

  const walletsPreferredFeatures = useMemo(() => ({
    sendTransaction: {
      minMessages: 1
    }
  }), []);

  if (!manifestUrl) {
    // Don't render children until the provider is ready;
    // otherwise components using TonConnect hooks will crash.
    return null;
  }

  return (
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      walletsPreferredFeatures={walletsPreferredFeatures}
    >
      {children}
    </TonConnectUIProvider>
  );
}
