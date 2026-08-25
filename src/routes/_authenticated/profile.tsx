import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, Phone, UserRound } from "lucide-react";

import { getMyProfile } from "@/lib/auth.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Glowante Business" },
      { name: "description", content: "Your Glowante owner account details." },
      { property: "og:title", content: "My Profile — Glowante Business" },
      { property: "og:description", content: "Your Glowante owner account details." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const fetchProfile = useServerFn(getMyProfile);
  const { data, isLoading } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <h1 className="font-display text-3xl font-semibold text-foreground">My Profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">Account details linked to your Glowante business login.</p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-accent" />
          </div>
        ) : (
          <dl className="space-y-4">
            <div className="flex items-center gap-3">
              <UserRound className="size-4 text-accent" />
              <div>
                <dt className="text-xs tracking-wide text-muted-foreground uppercase">Name</dt>
                <dd className="font-medium text-foreground">
                  {[data?.first_name, data?.last_name].filter(Boolean).join(" ") || "—"}
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="size-4 text-accent" />
              <div>
                <dt className="text-xs tracking-wide text-muted-foreground uppercase">Phone</dt>
                <dd className="font-medium text-foreground">+91 {data?.phone ?? "—"}</dd>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="size-4 text-accent" />
              <div>
                <dt className="text-xs tracking-wide text-muted-foreground uppercase">Email</dt>
                <dd className="font-medium text-foreground">{data?.email ?? "—"}</dd>
              </div>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
