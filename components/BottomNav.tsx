"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getLanguage, translations, type Language } from "../lib/i18n";

type BottomNavProps = {
  dark: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "HOME", icon: "⌂" },
  { href: "/stats", label: "STATS", icon: "▥" },
  { href: "/car", label: "MY CAR", icon: "▰" },
  { href: "/settings", label: "SETTINGS", icon: "⚙" },
  { href: "/diagnostics", label: "DIAGNOSTICS", icon: "◉" },
];

export function BottomNav({ dark }: BottomNavProps) {
  const pathname = usePathname();
  const [language, setLanguage] = useState<Language>("en");
  useEffect(() => { const sync = () => setLanguage(getLanguage()); sync(); window.addEventListener("evergy:language-change", sync); return () => window.removeEventListener("evergy:language-change", sync); }, []);
  const t = translations[language];
  const labels: Record<string, string> = { HOME: t.home, STATS: t.stats, "MY CAR": t.car, SETTINGS: t.settings, DIAGNOSTICS: t.diagnostics };

  return (
    <nav
      aria-label="Primary navigation"
      className={`fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl ${
        dark
          ? "border-white/[0.07] bg-[#070a0c]/85"
          : "border-black/[0.06] bg-[#f4f6f7]/90"
      }`}
    >
      <div className="mx-auto flex min-h-[76px] w-full max-w-[760px] flex-wrap items-center justify-center gap-2 px-3 pb-[env(safe-area-inset-bottom)] pt-2 sm:gap-3 sm:px-5">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex h-14 min-w-[108px] flex-col items-center justify-center gap-1 rounded-2xl border transition-all duration-300 ${
                isActive
                  ? dark
                    ? "border-cyan-400/30 bg-cyan-400/[0.08] text-cyan-300"
                    : "border-cyan-600/25 bg-cyan-500/[0.08] text-cyan-700"
                  : dark
                    ? "border-transparent text-zinc-600 hover:border-white/[0.08] hover:text-zinc-300"
                    : "border-transparent text-zinc-400 hover:border-black/[0.06] hover:text-zinc-700"
              }`}
            >
              <span className="text-xl leading-none" aria-hidden="true">
                {item.icon}
              </span>
              <span className="text-[8px] font-medium tracking-[0.2em]">
                {labels[item.label]}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
