import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarCheck, Scissors, Sparkles, Store } from "lucide-react";
import { useEffect } from "react";

import heroImage from "@/assets/salon-hero.jpg";
import { PublicFooter } from "@/components/public-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { canonical, SITE_NAME, SITE_URL } from "@/lib/site";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${SITE_NAME} | Salon Appointment Booking & Owner Admin Panel` },
      { name: "description", content: "Glowantey is a salon appointment booking platform and owner admin panel for managing salons, branches, staff, services and bookings." },
      { property: "og:title", content: `${SITE_NAME} | Salon Appointment Booking & Owner Admin Panel` },
      { property: "og:description", content: "Book beauty appointments and run your salon network from one elegant dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: canonical() }],
  }),
  component: Home,
});

const highlights = [
  { icon: CalendarCheck, title: "Instant bookings", body: "Real-time availability across every branch, with zero double-booking." },
  { icon: Store, title: "Multi-salon ready", body: "Add salons and branches, each with its own hours, catalogue and team." },
  { icon: Scissors, title: "Seeded catalogue", body: "Start with a ready-made service catalogue with pricing and durations included." },
];

function Home() {
  const navigate = useNavigate();
  const structuredData = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: SITE_NAME, url: SITE_URL, applicationCategory: "BusinessApplication", operatingSystem: "Web", description: "Salon appointment booking platform and owner admin panel for salons, branches, services, teams and bookings." };
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/salons", replace: true });
    });
  }, [navigate]);
  return <div className="min-h-screen bg-background">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <SiteHeader />
    <main>
      <section className="relative overflow-hidden"><div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 lg:grid-cols-2 lg:py-20"><div><span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-xs font-semibold tracking-[0.18em] text-primary uppercase"><Sparkles className="size-3.5" /> Beauty, booked beautifully</span><h1 className="mt-6 text-4xl leading-[1.1] font-semibold text-foreground sm:text-5xl lg:text-6xl">Your salon, <span className="text-gradient-gold">glowing</span> with every booking.</h1><p className="mt-5 max-w-lg text-base text-muted-foreground sm:text-lg">Glowantey is the appointment platform for modern salons — effortless booking for clients and a powerful owner suite for your team.</p><div className="mt-8 flex flex-wrap gap-3"><Button asChild size="lg"><Link to="/business">List your salon</Link></Button><Button asChild size="lg" variant="outline"><Link to="/about">Why Glowantey</Link></Button></div></div><div className="relative"><div className="overflow-hidden rounded-3xl shadow-elegant"><img src={heroImage} alt="Warmly lit luxury salon interior with arched mirrors and velvet chairs" width={1600} height={1008} className="h-full w-full object-cover" /></div></div></div></section>
      <section className="border-t border-border/70 bg-gold-soft/50"><div className="mx-auto grid max-w-6xl gap-5 px-5 py-14 sm:grid-cols-3">{highlights.map((item) => <div key={item.title} className="rounded-2xl border border-border bg-card p-6 shadow-soft"><span className="inline-flex size-11 items-center justify-center rounded-full bg-secondary text-primary"><item.icon className="size-5" /></span><h2 className="mt-4 text-xl font-semibold text-foreground">{item.title}</h2><p className="mt-2 text-sm text-muted-foreground">{item.body}</p></div>)}</div></section>
      <section className="mx-auto max-w-6xl px-5 py-16 text-center"><h2 className="text-3xl font-semibold text-foreground sm:text-4xl">Ready to open your Glowantey suite?</h2><p className="mx-auto mt-3 max-w-xl text-muted-foreground">Sign in with your mobile number and set up your salon in three guided steps.</p><Button asChild size="lg" className="mt-7"><Link to="/business">Continue to Business</Link></Button></section>
    </main>
    <PublicFooter />
  </div>;
}
