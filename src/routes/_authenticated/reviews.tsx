import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";

import reviewsImage from "@/assets/salon-reviews.jpg";
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
    <AdminPlaceholder
      title="Reviews"
      description="What clients say after their appointments."
      icon={Star}
      image={reviewsImage}
      imageAlt="Happy client admiring her new hairstyle in a salon mirror"
    />
  ),
});
