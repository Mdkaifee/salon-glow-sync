import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  BookOpen,
  CalendarDays,
  Gift,
  Images,
  LogOut,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/auth.functions";

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
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/business", replace: true });
  }

  async function handleDelete() {
    try {
      await deleteMyAccount();
      toast.success("Your account has been deleted");
      await signOut();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete account");
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
        <Link to="/" className="px-5 py-5">
          <img src={logo} alt="Glowante" width={150} height={42} className="h-9 w-auto" />
        </Link>
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
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-card px-5 py-3">
          <Link to="/" className="lg:hidden">
            <img src={logo} alt="Glowante" width={130} height={36} className="h-8 w-auto" />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex size-10 items-center justify-center rounded-full border border-border text-primary transition-colors hover:bg-secondary">
                <UserRound className="size-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center gap-2">
                    <UserRound className="size-4" /> View profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void signOut()}>
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" /> Delete account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex-1 overflow-x-hidden">{children}</div>

        <nav className="flex items-center justify-around gap-1 overflow-x-auto border-t border-border bg-card px-2 py-2 lg:hidden">
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

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes your profile, salons, branches and catalog. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Delete account</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
