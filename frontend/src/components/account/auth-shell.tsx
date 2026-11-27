import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/project/sections";

// The frame of the sign-up and login pages: the logo-only header, then one centred column (400px,
// 464px on wide screens where the card padding grows) with the title on the page background and the
// form in a card under it. Narrow on purpose: the form is the only thing on these pages (Bek,
// 2026-11-27).

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="flex justify-center px-[16px] py-[64px] sm:px-[48px]">
        <div className="flex w-full max-w-[400px] flex-col wide:max-w-[464px]">
          <h1 className="text-title font-bold tracking-[-0.02em]">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}

/** "Already have an account? Log in" under the title, keeping where to go afterwards. */
export function SwitchLine({ question, href, label }: { question: string; href: string; label: string }) {
  return (
    <p className="mt-[8px] text-body text-muted">
      {question}{" "}
      <Link
        href={href}
        className="font-medium text-primary-strong underline-offset-4 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-primary"
      >
        {label}
      </Link>
    </p>
  );
}
