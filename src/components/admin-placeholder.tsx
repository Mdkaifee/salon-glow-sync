import type { LucideIcon } from "lucide-react";

export function AdminPlaceholder({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8">
      <h1 className="font-display text-3xl font-semibold text-foreground">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
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
