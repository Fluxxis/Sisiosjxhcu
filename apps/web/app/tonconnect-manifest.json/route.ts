import { NextResponse } from 'next/server';

// Dynamic manifest: works with cloudflared / changing domains.
export function GET(request: Request) {
  const origin = new URL(request.url).origin;

  return NextResponse.json({
    url: origin,
    name: 'Raise TON',
    iconUrl: `${origin}/icon.svg`,
    termsOfUseUrl: origin,
    privacyPolicyUrl: origin
  });
}
