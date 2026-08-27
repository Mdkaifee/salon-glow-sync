import type { LucideIcon } from "lucide-react";
import { SalonBranchTabs } from "@/components/salon-branch-selector";

export function AdminPlaceholder({
  title,
  description,
  icon: Icon,
  image,
  imageAlt,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  image?: string;
  imageAlt?: string;
}) {
  return (
    <div className="w-full px-4 py-8">
      <SalonBranchTabs className="mb-7" />
      <h1 className="font-display text-3xl font-semibold text-foreground">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {image && (
        <div className="mt-6 overflow-hidden rounded-2xl shadow-soft">
          <img
            src={image}
            alt={imageAlt ?? title}
            width={1200}
            height={800}
            loading="lazy"
            className="h-52 w-full object-cover sm:h-64"
          />
        </div>
      )}
      <div className="mt-6 rounded-2xl border border-dashed border-accent/50 bg-card px-5 py-20 text-center">
        <Icon className="mx-auto size-8 text-accent" />
        <p className="mt-3 font-medium text-foreground">{title} is coming next</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The section is wired into your dashboard — we&apos;ll build the workflow in the next round.
        </p>
      </div>
    </div>
  );
}
