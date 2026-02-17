export function getInitData(): string {
  // @ts-ignore
  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  return tg?.initData || "";
}

export function getTelegramUser(): { username?: string; first_name?: string; photo_url?: string } | null {
  // @ts-ignore
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
  try {
    return tg?.initDataUnsafe?.user || null;
  } catch {
    return null;
  }
}
export function ready() {
  // @ts-ignore
  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  try { tg?.ready?.(); } catch {}
}
