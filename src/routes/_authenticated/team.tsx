import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { AdminPlaceholder } from "@/components/admin-placeholder";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team — Glowante Business" },
      { name: "description", content: "Add stylists, assign services and manage commissions." },
      { property: "og:title", content: "Team — Glowante Business" },
      { property: "og:description", content: "Add stylists, assign services and manage commissions." },
    ],
  }),
  component: () => (
    <AdminPlaceholder title="Team" description="Stylists and staff working across your salons." icon={Users} />
  ),
});
