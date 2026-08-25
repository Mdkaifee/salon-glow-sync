import { createFileRoute } from "@tanstack/react-router";
import { Gift } from "lucide-react";

import { AdminPlaceholder } from "@/components/admin-placeholder";

export const Route = createFileRoute("/_authenticated/packages")({
  head: () => ({
    meta: [
      { title: "Packages — Glowante Business" },
      { name: "description", content: "Bundle services into packages your clients can pre-book." },
      { property: "og:title", content: "Packages — Glowante Business" },
      { property: "og:description", content: "Bundle services into packages your clients can pre-book." },
    ],
  }),
  component: () => (
    <AdminPlaceholder title="Packages" description="Bundled service offerings for regular clients." icon={Gift} />
  ),
});
