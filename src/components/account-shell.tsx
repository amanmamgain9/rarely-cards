"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { href: "/account", label: "Billing", exact: true },
  { href: "/account/profile", label: "Profile", exact: false },
];

export function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="min-h-svh bg-background text-ink">
      <header className="border-b border-ink/10 bg-cream">
        <div className="mx-auto flex min-h-18 w-[calc(100%-2.5rem)] max-w-[1080px] items-center justify-between gap-5 max-sm:w-[calc(100%-1.75rem)]">
          <Link className="font-display text-xl leading-none text-pink" href="/studio">
            RARELY <span className="text-yellow [text-shadow:1px_1px_0_#241a44]">★</span>
          </Link>
          <Link
            className="inline-flex min-h-10 items-center rounded-xl border-2 border-ink bg-pink px-4 text-sm font-black text-white shadow-[3px_3px_0_#241a44] transition-transform hover:-translate-y-0.5"
            href="/studio/talking-pet"
          >
            New video <span aria-hidden="true">→</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-[calc(100%-2.5rem)] max-w-[1080px] gap-10 py-12 md:grid-cols-[190px_minmax(0,1fr)] max-sm:w-[calc(100%-1.75rem)] max-sm:gap-7 max-sm:py-7">
        <aside>
          <p className="mb-4 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted max-md:hidden">
            Account
          </p>
          <nav
            aria-label="Account sections"
            className="flex gap-1 rounded-xl bg-purple/10 p-1 md:grid md:bg-transparent md:p-0"
          >
            {sections.map((section) => {
              const active = section.exact
                ? pathname === section.href
                : pathname.startsWith(section.href);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`min-h-11 flex-1 rounded-lg px-4 py-3 text-sm font-extrabold transition-colors md:flex-none ${
                    active
                      ? "bg-white text-pink shadow-sm ring-1 ring-ink/10"
                      : "text-ink-muted hover:bg-white/70 hover:text-ink"
                  }`}
                  href={section.href}
                  key={section.href}
                >
                  {section.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
