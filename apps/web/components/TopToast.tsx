'use client';

import React, { useEffect, useMemo, useState } from 'react';

export type ToastKind = 'error' | 'success';

export function TopToast({
  kind,
  title,
  message,
  open,
  onClose,
  durationMs = 2500
}: {
  kind: ToastKind;
  title: string;
  message: string;
  open: boolean;
  onClose: () => void;
  durationMs?: number;
}) {
  const [progress, setProgress] = useState(0);

  const bg = useMemo(() => {
    if (kind === 'success') return 'linear-gradient(180deg, #12351e, #0f2416)';
    return 'linear-gradient(180deg, #4a1212, #2b0b0b)';
  }, [kind]);

  useEffect(() => {
    if (!open) return;
    setProgress(0);
    const start = Date.now();
    const t = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / durationMs);
      setProgress(p);
      if (p >= 1) {
        clearInterval(t);
        onClose();
      }
    }, 30);
    return () => clearInterval(t);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 74,
        left: 14,
        right: 14,
        zIndex: 9999,
        padding: 14,
        borderRadius: 18,
        color: '#fff',
        background: bg,
        boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
        overflow: 'hidden'
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 10,
          right: 12,
          width: 28,
          height: 28,
          borderRadius: 14,
          border: 'none',
          background: 'rgba(255,255,255,0.12)',
          color: '#fff',
          fontSize: 18,
          cursor: 'pointer'
        }}
        aria-label="close"
      >
        ×
      </button>

      <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.05 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800, lineHeight: 1.05 }}>{message}</div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          height: 4,
          width: `${Math.round(progress * 100)}%`,
          background: 'rgba(255,255,255,0.55)'
        }}
      />
    </div>
  );
}
