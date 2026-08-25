import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";

import { AdminPlaceholder } from "@/components/admin-placeholder";

export const Route = createFileRoute("/_authenticated/reviews")({
  head: () => ({
    meta: [
      { title: "Reviews — Glowante Business" },
      { name: "description", content: "Read and respond to client feedback for every branch." },
      { property: "og:title", content: "Reviews — Glowante Business" },
      { property: "og:description", content: "Read and respond to client feedback for every branch." },
    ],
  }),
  component: () => (
    <AdminPlaceholder title="Reviews" description="What clients say after their appointments." icon={Star} />
  ),
});
