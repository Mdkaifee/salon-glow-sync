import { createFileRoute } from "@tanstack/react-router";
import { Tag } from "lucide-react";

import { AdminPlaceholder } from "@/components/admin-placeholder";

export const Route = createFileRoute("/_authenticated/deals")({
  head: () => ({
    meta: [
      { title: "Deals — Glowante Business" },
      { name: "description", content: "Run limited-time offers and discounts on your services." },
      { property: "og:title", content: "Deals — Glowante Business" },
      { property: "og:description", content: "Run limited-time offers and discounts on your services." },
    ],
  }),
  component: () => (
    <AdminPlaceholder title="Deals" description="Seasonal offers and discounts for your salons." icon={Tag} />
  ),
});
