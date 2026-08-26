import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import {
  BookOpen,
  CalendarDays,
  Gift,
  Images,
  Loader2,
  LogOut,
  LockKeyhole,
  Mail,
  Phone,
  Quote,
  Star,
  Store,
  Tag,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import logo from "@/assets/glowante-logo.png";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount, getMyProfile } from "@/lib/auth.functions";
import { displayPhone } from "@/lib/phone";
import { CurrentSalonDropdown } from "@/components/salon-branch-selector";
import { useConfirmation } from "@/components/confirmation-provider";

const navItems = [
  { to: "/bookings", label: "Bookings", icon: CalendarDays },
  { to: "/salons", label: "Salons", icon: Store },
  { to: "/team", label: "Team", icon: Users },
  { to: "/catalog", label: "Catalog", icon: BookOpen },
  { to: "/packages", label: "Packages", icon: Gift },
  { to: "/deals", label: "Deals", icon: Tag },
  { to: "/gallery", label: "Gallery", icon: Images },
  { to: "/reviews", label: "Reviews", icon: Star },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);
  const confirm = useConfirmation();
  const fetchProfile = useServerFn(getMyProfile);
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const profile = profileQuery.data;

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    await queryClient.cancelQueries();
    queryClient.clear();
    navigate({ to: "/business", replace: true });
  }

  async function handleSignOut() {
    if (!(await confirm({
      title: "Sign out?",
      description: "You will need to sign in again to manage your salons.",
      confirmLabel: "Sign out",
    }))) return;
    try {
      await signOut();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out. Please try again.");
    }
  }

  async function handleDelete() {
    if (!(await confirm({
      title: "Delete your account?",
      description: "This permanently removes your profile, salons, branches and catalog. This cannot be undone.",
      confirmLabel: "Delete account",
      destructive: true,
    }))) return;
    try {
      await deleteMyAccount();
      const { error } = await supabase.auth.signOut();
      if (error) console.warn("Account was deleted, but the local sign-out request failed.", error);
      await queryClient.cancelQueries();
      queryClient.clear();
      toast.success("Your account has been deleted");
      navigate({ to: "/business", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete account");
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="relative z-[101] hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="px-4 py-4" aria-label="Glowante">
          <img src={logo} alt="Glowante" width={176} height={56} className="h-14 w-44 object-cover object-center" />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 pb-6">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <div className="rounded-xl bg-gold-soft px-3 py-2.5 text-center text-xs italic leading-tight text-primary">
            <Quote className="mr-1 inline size-3" />Investing in your hair is the crown you never take off.<Quote className="ml-1 inline size-3" />
          </div>
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="mt-3 flex w-full items-center gap-2 rounded-xl bg-gold-soft px-3 py-2.5 text-left transition-colors hover:bg-secondary"
          >
            <ProfileAvatar profile={profile} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">{profileName(profile)}</span>
              <span className="block text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Salon owner</span>
            </span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-[101] flex items-center justify-between gap-4 border-b border-border bg-card px-5 py-2">
          <Link to="/" className="lg:hidden">
            <img src={logo} alt="Glowante" width={130} height={36} className="h-8 w-auto" />
          </Link>
          <CurrentSalonDropdown />
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex size-10 items-center justify-center rounded-full border border-border text-primary transition-colors hover:bg-secondary">
                <UserRound className="size-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                  <UserRound className="size-4" /> View profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleSignOut()}>
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => void handleDelete()}
                >
                  <Trash2 className="size-4" /> Delete account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex-1 overflow-x-hidden">{children}</div>

        <nav className="relative z-[101] flex items-center justify-around gap-1 overflow-x-auto border-t border-border bg-card px-2 py-2 lg:hidden">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex shrink-0 flex-col items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground data-[status=active]:text-primary"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <AccountDetailsDialog open={profileOpen} onOpenChange={setProfileOpen} profile={profile} loading={profileQuery.isLoading} />
    </div>
  );
}

type Profile = { first_name: string | null; last_name: string | null; phone: string | null; email: string | null; roles: string[] } | null | undefined;

function profileName(profile: Profile) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Account owner";
}

function profileRoles(profile: Profile) {
  return profile?.roles?.map((role) => role === "salon_owner" ? "Salon Owner" : "App User") ?? ["App User"];
}

function ProfileAvatar({ profile, large = false }: { profile: Profile; large?: boolean }) {
  const initials = profileName(profile).split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <Avatar className={large ? "size-20 border-2 border-gold-soft p-1 shadow-soft" : "size-9 border border-border"}><AvatarFallback className="bg-secondary font-display text-primary">{initials}</AvatarFallback></Avatar>;
}

function AccountDetailsDialog({ open, onOpenChange, profile, loading }: { open: boolean; onOpenChange: (open: boolean) => void; profile: Profile; loading: boolean }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-[525px] rounded-2xl border-border p-5 sm:p-6"><DialogHeader className="border-b border-border pb-4"><DialogTitle className="font-display text-2xl text-primary">Account Details</DialogTitle><DialogDescription className="sr-only">Your Glowante account information.</DialogDescription></DialogHeader>{loading ? <div className="flex justify-center py-20"><Loader2 className="size-5 animate-spin text-primary" /></div> : <div className="pt-1"><div className="flex flex-col items-center text-center"><ProfileAvatar profile={profile} large /><h2 className="mt-3 font-display text-3xl text-primary">{profileName(profile)}</h2><p className="mt-1 text-sm text-muted-foreground">{profileRoles(profile).join(", ")}</p></div><dl className="mt-7 space-y-5 rounded-2xl border border-border bg-gold-soft/20 p-5"><AccountItem icon={<Phone className="size-5" />} label="Phone number" value={displayPhone(profile?.phone)} /><AccountItem icon={<Mail className="size-5" />} label="Email address" value={profile?.email ?? "Not added"} /><AccountItem icon={<LockKeyhole className="size-5" />} label="Access roles" value={profileRoles(profile).join(", ")} /></dl></div>}</DialogContent></Dialog>;
}

function AccountItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">{icon}</span><div><dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</dt><dd className="mt-0.5 font-medium text-foreground">{value}</dd></div></div>;
}
