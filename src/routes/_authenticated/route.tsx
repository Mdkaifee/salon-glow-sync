import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { SalonBranchProvider } from "@/components/salon-branch-selector";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/business" });
    return { user: data.user };
  },
  component: () => (
    <SalonBranchProvider><AdminShell><Outlet /></AdminShell></SalonBranchProvider>
  ),
});
