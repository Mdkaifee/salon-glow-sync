import { createFileRoute } from "@tanstack/react-router";
import { Images } from "lucide-react";

import { AdminPlaceholder } from "@/components/admin-placeholder";

export const Route = createFileRoute("/_authenticated/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery — Glowante Business" },
      { name: "description", content: "Showcase your salon interiors and signature work." },
      { property: "og:title", content: "Gallery — Glowante Business" },
      { property: "og:description", content: "Showcase your salon interiors and signature work." },
    ],
  }),
  component: () => (
    <AdminPlaceholder title="Gallery" description="Photos that sell your salon experience." icon={Images} />
  ),
});
