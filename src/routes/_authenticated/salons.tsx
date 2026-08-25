import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Pencil, Phone, Plus, Search, Store, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { SalonSetupModal, type SalonSetupTarget } from "@/components/salon-setup-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteSalon, listSalons } from "@/lib/salons.functions";

export const Route = createFileRoute("/_authenticated/salons")({
  head: () => ({
    meta: [
      { title: "Salons — Glowante Business" },
      { name: "description", content: "Manage your Glowante salon network, branches, timings and locations." },
      { property: "og:title", content: "Salons — Glowante Business" },
      { property: "og:description", content: "Manage your Glowante salon network, branches and locations." },
    ],
  }),
  component: SalonsPage,
});

function SalonsPage() {
  const queryClient = useQueryClient();
  const fetchSalons = useServerFn(listSalons);
  const removeSalon = useServerFn(deleteSalon);
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<SalonSetupTarget | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);

  const salonsQuery = useQuery({ queryKey: ["salons"], queryFn: () => fetchSalons() });
  const salons = salonsQuery.data ?? [];

  useEffect(() => {
    if (salonsQuery.isSuccess && salons.length === 0 && !autoOpened) {
      setAutoOpened(true);
      setTarget({ mode: "create-salon" });
    }
  }, [salonsQuery.isSuccess, salons.length, autoOpened]);

  const parents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return salons
      .filter((salon) => !salon.parent_id)
      .filter((salon) => !term || salon.name.toLowerCase().includes(term) || (salon.address ?? "").toLowerCase().includes(term));
  }, [salons, search]);

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This also removes its branches and catalog.`)) return;
    try {
      await removeSalon({ data: { id } });
      toast.success("Salon deleted");
      void queryClient.invalidateQueries({ queryKey: ["salons"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete");
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Manage Your Salon Network</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add salons, open new branches and keep every location up to date.
          </p>
        </div>
        <Button size="lg" onClick={() => setTarget({ mode: "create-salon" })}>
          <Plus className="size-4" /> Add Salon
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Store className="size-4 text-accent" /> Total Salons
          </div>
          <p className="mt-2 font-display text-3xl font-semibold text-foreground">{parents.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4 text-accent" /> Total Branches
          </div>
          <p className="mt-2 font-display text-3xl font-semibold text-foreground">
            {salons.filter((salon) => salon.parent_id).length}
          </p>
        </div>
        <div className="rounded-2xl bg-gradient-gold p-5 text-primary">
          <div className="flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="size-4" /> Strategic expansion
          </div>
          <p className="mt-2 text-sm">
            Salons with 2+ branches see up to 40% more repeat bookings on Glowante.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">Your salons</h2>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search salon or address"
              className="w-64 pl-9"
            />
          </div>
        </div>

        {salonsQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-accent" />
          </div>
        ) : parents.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Store className="mx-auto size-8 text-accent" />
            <p className="mt-3 font-medium text-foreground">No salons yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Set up your first salon to start taking bookings.</p>
            <Button className="mt-4" onClick={() => setTarget({ mode: "create-salon" })}>
              <Plus className="size-4" /> Add Salon
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {parents.map((salon) => {
              const branches = salons.filter((item) => item.parent_id === salon.id);
              return (
                <li key={salon.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-xl font-semibold text-foreground">{salon.name}</h3>
                        {salon.is_stylist && (
                          <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-medium text-primary">
                            Stylist owner
                          </span>
                        )}
                      </div>
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-accent" />
                        <span>{[salon.house_no, salon.street, salon.address].filter(Boolean).join(", ")}</span>
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="size-3.5 text-accent" /> +91 {salon.phone}
                        <span className="ml-3">
                          {salon.open_time?.slice(0, 5)} – {salon.close_time?.slice(0, 5)}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/catalog" search={{ salon: salon.id }}>
                          Catalog
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTarget({ mode: "edit", salon })}
                      >
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                      <Button size="sm" onClick={() => setTarget({ mode: "create-branch", parentId: salon.id })}>
                        <Plus className="size-3.5" /> Add Branch
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => void handleDelete(salon.id, salon.name)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {branches.length > 0 && (
                    <ul className="mt-3 space-y-2 border-l-2 border-gold-soft pl-4">
                      {branches.map((branch) => (
                        <li key={branch.id} className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{branch.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {branch.address} · +91 {branch.phone}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setTarget({ mode: "edit", salon: branch })}>
                              <Pencil className="size-3.5" /> Edit branch
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => void handleDelete(branch.id, branch.name)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {target && (
        <SalonSetupModal
          target={target}
          onClose={() => setTarget(null)}
          onSaved={() => {
            setTarget(null);
            void queryClient.invalidateQueries({ queryKey: ["salons"] });
          }}
        />
      )}
    </div>
  );
}
