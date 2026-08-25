import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";

import { AdminPlaceholder } from "@/components/admin-placeholder";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({
    meta: [
      { title: "Bookings — Glowante Business" },
      { name: "description", content: "Track upcoming and past salon appointments in one calendar." },
      { property: "og:title", content: "Bookings — Glowante Business" },
      { property: "og:description", content: "Track upcoming and past salon appointments in one calendar." },
    ],
  }),
  component: () => (
    <AdminPlaceholder
      title="Bookings"
      description="Every appointment across your salons and branches."
      icon={CalendarDays}
    />
  ),
});
