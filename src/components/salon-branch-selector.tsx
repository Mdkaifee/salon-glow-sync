import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listSalons } from "@/lib/salons.functions";

type SalonLocation = { id: string; name: string; parent_id: string | null; address: string | null; house_no: string | null; street: string | null };
type SalonBranchContextValue = { salons: SalonLocation[]; activeSalonId: string | undefined; setActiveSalonId: (id: string) => void; isLoading: boolean };
const SalonBranchContext = createContext<SalonBranchContextValue | null>(null);

export function SalonBranchProvider({ children }: { children: ReactNode }) {
  const getSalons = useServerFn(listSalons);
  const salonsQuery = useQuery({ queryKey: ["salons"], queryFn: () => getSalons() });
  const salons = (salonsQuery.data ?? []) as SalonLocation[];
  const [activeSalonId, setActiveSalonId] = useState<string>();
  useEffect(() => { if (!activeSalonId && salons[0]) setActiveSalonId(salons[0].id); }, [activeSalonId, salons]);
  return <SalonBranchContext.Provider value={{ salons, activeSalonId, setActiveSalonId, isLoading: salonsQuery.isLoading }}>{children}</SalonBranchContext.Provider>;
}

export function useSalonBranches() {
  const context = useContext(SalonBranchContext);
  if (!context) throw new Error("useSalonBranches must be used inside SalonBranchProvider");
  return context;
}

function parentFor(salons: SalonLocation[], locationId: string | undefined) {
  const location = salons.find((salon) => salon.id === locationId);
  return location?.parent_id ? salons.find((salon) => salon.id === location.parent_id) : location;
}

export function CurrentSalonDropdown() {
  const { salons, activeSalonId, setActiveSalonId, isLoading } = useSalonBranches();
  const [open, setOpen] = useState(false);
  const parents = salons.filter((salon) => !salon.parent_id);
  const current = parentFor(salons, activeSalonId) ?? parents[0];
  const address = current ? [current.house_no, current.street, current.address].filter(Boolean).join(", ") : "";
  return <div className="relative hidden sm:block">{isLoading ? <div className="h-12 w-52 animate-pulse rounded-lg bg-secondary" /> : <><button type="button" onClick={() => setOpen((value) => !value)} className="flex w-54 items-center gap-3 rounded-lg border border-border bg-secondary/70 px-3 py-2 text-left shadow-sm"><span className="min-w-0 flex-1"><span className="block text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">Current salon</span><span className="block truncate text-sm font-semibold text-primary">{current?.name ?? "Select salon"}</span><span className="block truncate text-[10px] text-muted-foreground">{address}</span></span><ChevronDown className={cn("size-4 shrink-0 text-primary transition-transform", open && "rotate-180")} /></button>{open && <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-elegant">{parents.map((salon) => <button key={salon.id} type="button" onClick={() => { setActiveSalonId(salon.id); setOpen(false); }} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gold-soft"><span className="min-w-0"><span className="block truncate text-sm font-medium text-primary">{salon.name}</span><span className="block truncate text-[10px] text-muted-foreground">{[salon.house_no, salon.street, salon.address].filter(Boolean).join(", ")}</span></span>{current?.id === salon.id && <Check className="size-4 text-primary" />}</button>)}</div>}</>}</div>;
}

export function SalonBranchTabs({ className }: { className?: string }) {
  const { salons, activeSalonId, setActiveSalonId, isLoading } = useSalonBranches();
  const parent = parentFor(salons, activeSalonId);
  const locations = useMemo(() => parent ? [parent, ...salons.filter((salon) => salon.parent_id === parent.id)] : [], [parent, salons]);
  if (isLoading || !locations.length) return null;
  return <section className={cn("rounded-xl border border-border bg-card px-4 py-3 shadow-sm", className)}><p className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Select branch</p><div className="flex flex-wrap items-center gap-1">{locations.map((location, index) => <div key={location.id} className="flex items-center"><Button size="sm" variant="ghost" onClick={() => setActiveSalonId(location.id)} className={cn("h-7 rounded-none px-3 text-xs font-medium", activeSalonId === location.id ? "border-b border-primary text-primary" : "text-muted-foreground hover:text-primary")}>{activeSalonId === location.id && <Check className="size-3.5" />}{location.name}</Button>{index < locations.length - 1 && <span className="mx-1 h-5 w-px bg-border" />}</div>)}</div></section>;
}
