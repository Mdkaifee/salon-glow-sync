import { type ReactNode } from "react";

import { PublicFooter } from "@/components/public-footer";
import { SiteHeader } from "@/components/site-header";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
        <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Glowantey legal</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-foreground sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {updated}</p>
        <article className="legal-content mt-10 space-y-8 text-base leading-7 text-muted-foreground">{children}</article>
      </main>
      <PublicFooter />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2 className="text-2xl font-semibold text-foreground">{title}</h2><div className="mt-3 space-y-3">{children}</div></section>;
}
