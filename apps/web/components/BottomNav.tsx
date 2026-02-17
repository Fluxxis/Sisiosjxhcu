"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "🏠" },
  { href: "/bonuses", label: "🎁" },
  { href: "/referrals", label: "👥" },
  { href: "/transactions", label: "🕘" }
];

export function BottomNav() {
  const p = usePathname();
  return (
    <div className="bottomNav">
      <div className="bottomNavInner">
        {items.map(it => (
          <Link key={it.href} href={it.href} className={"navItem" + (p===it.href ? " active" : "")}>
            {it.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
