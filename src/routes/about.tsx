import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Glowante — Built for Salon Owners" },
      {
        name: "description",
        content:
          "Glowante brings salon appointment booking, branch management, catalogs, teams and client reviews together in one warm, elegant platform.",
      },
      { property: "og:title", content: "About Glowante" },
      {
        property: "og:description",
        content: "The story behind Glowante and the salon owners we build for.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

const values = [
  {
    title: "Made with salon owners",
    body: "Every screen — from salon setup to catalog pricing — mirrors how a real salon runs its day.",
  },
  {
    title: "One suite, every branch",
    body: "Salons, branches, teams, packages, deals and gallery all live in one place, always in sync.",
  },
  {
    title: "Effortless for clients",
    body: "A mobile number and an OTP is all it takes. No passwords, no friction, no drop-offs.",
  },
];

function About() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-5 py-14">
        <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">About Glowante</h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Glowante began with a simple observation: salons spend more time managing appointments than
          creating beautiful work. So we built a platform that handles the bookings, the branches, the
          pricing and the paperwork — and lets you get back to the chair.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {values.map((value) => (
            <div key={value.title} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="text-lg font-semibold text-foreground">{value.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{value.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-3xl bg-gold-soft p-8 text-center">
          <h2 className="text-2xl font-semibold text-foreground">Join the network</h2>
          <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
            Salon owners across India use Glowante to manage their appointments, catalog and team.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/business">Get started</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
