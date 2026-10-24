"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Bottom tab bar: Map · Quests · Dex · Feed · Profile (ui.md).
 * Fixed to the bottom, mobile-first, with wooden-panel styling and a
 * highlighted active tab. Icons are simple emoji glyphs for M0; pixel sprites
 * arrive with the UI milestones.
 */

const TABS = [
  { href: "/map", label: "Map", icon: "🗺️" },
  { href: "/quests", label: "Quests", icon: "📜" },
  { href: "/dex", label: "Dex", icon: "📖" },
  { href: "/feed", label: "Feed", icon: "📣" },
  { href: "/profile", label: "Profile", icon: "🧑‍🌾" },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t-4 border-wood-dark bg-wood-light pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-screen-sm items-stretch justify-between">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-0.5 text-wood-dark transition-colors ${
                  active ? "bg-parchment" : "hover:bg-parchment/60"
                }`}
              >
                <span aria-hidden="true" className="text-xl leading-none">
                  {tab.icon}
                </span>
                <span className="font-label text-sm uppercase tracking-wide">
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
