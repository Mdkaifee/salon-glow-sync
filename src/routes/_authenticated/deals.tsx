import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  CircleCheck,
  CircleOff,
  Loader2,
  Pencil,
  Plus,
  Scissors,
  Tag,
  Trash2,
} from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import {
  BusinessServicePicker,
  type SelectableService,
} from "@/components/business-service-picker";
import { useConfirmation } from "@/components/confirmation-provider";
import { SalonBranchTabs, useSalonBranches } from "@/components/salon-branch-selector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteDeal,
  listDeals,
  listSelectableServices,
  saveDeal,
  setDealActiveStatus,
} from "@/lib/business.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/deals")({
  head: () => ({
    meta: [
      { title: "Deals - Glowante Business" },
      { name: "description", content: "Run limited-time offers and discounts on your services." },
    ],
  }),
  component: DealsPage,
});

type DealRecord = {
  id: string;
  name: string;
  description: string | null;
  discountType: "percentage" | "fixed";
  discountValue: number;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
  serviceIds: string[];
  services: SelectableService[];
};

const today = new Date().toISOString().slice(0, 10);
const blankForm = {
  name: "",
  description: "",
  discountType: "percentage" as const,
  discountValue: 10,
  startsOn: today,
  endsOn: today,
  serviceIds: [] as string[],
};

function DealsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirmation();
  const { activeSalonId: salonId } = useSalonBranches();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<DealRecord | null | "new">(null);
  const [form, setForm] = useState(blankForm);
  const getDeals = useServerFn(listDeals);
  const getServices = useServerFn(listSelectableServices);
  const save = useServerFn(saveDeal);
  const setActive = useServerFn(setDealActiveStatus);
  const remove = useServerFn(deleteDeal);
  const dealsQuery = useQuery({
    queryKey: ["deals", salonId],
    queryFn: () => getDeals({ data: { salonId: salonId! } }),
    enabled: Boolean(salonId),
  });
  const servicesQuery = useQuery({
    queryKey: ["selectable-services", salonId],
    queryFn: () => getServices({ data: { salonId: salonId! } }),
    enabled: Boolean(salonId),
  });
  const deals = useMemo(() => (dealsQuery.data ?? []) as DealRecord[], [dealsQuery.data]);
  const services = useMemo(
    () => (servicesQuery.data ?? []) as SelectableService[],
    [servicesQuery.data],
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return deals.filter(
      (deal) => !term || `${deal.name} ${deal.description ?? ""}`.toLowerCase().includes(term),
    );
  }, [deals, search]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["deals", salonId] });

  function openForm(deal?: DealRecord) {
    if (deal) {
      setEditing(deal);
      setForm({
        name: deal.name,
        description: deal.description ?? "",
        discountType: deal.discountType,
        discountValue: deal.discountValue,
        startsOn: deal.startsOn,
        endsOn: deal.endsOn,
        serviceIds: deal.serviceIds,
      });
    } else {
      setEditing("new");
      setForm(blankForm);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await save({
        data: {
          salonId: salonId!,
          id: editing && editing !== "new" ? editing.id : undefined,
          ...form,
        },
      });
      toast.success(editing === "new" ? "Deal added" : "Deal updated");
      setEditing(null);
      void refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save deal");
    }
  }

  async function toggle(deal: DealRecord) {
    const isActive = !deal.isActive;
    if (
      !(await confirm({
        title: `${isActive ? "Activate" : "Deactivate"} ${deal.name}?`,
        description: isActive
          ? "This deal can be used again."
          : "Clients will no longer be able to use this deal.",
        confirmLabel: isActive ? "Activate" : "Deactivate",
        destructive: !isActive,
      }))
    )
      return;
    try {
      await setActive({ data: { salonId: salonId!, id: deal.id, isActive } });
      toast.success(`Deal ${isActive ? "activated" : "deactivated"}`);
      void refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update deal");
    }
  }

  async function handleDelete(deal: DealRecord) {
    if (
      !(await confirm({
        title: `Delete ${deal.name}?`,
        description: "This permanently removes the deal and its service links.",
        confirmLabel: "Delete deal",
        destructive: true,
      }))
    )
      return;
    try {
      await remove({ data: { salonId: salonId!, id: deal.id } });
      toast.success("Deal deleted");
      void refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete deal");
    }
  }

  return (
    <div className="w-full px-4 py-7">
      <SalonBranchTabs className="mb-7" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Deals</p>
          <h1 className="font-display text-4xl text-primary">Offers and Discounts</h1>
          <p className="mt-1 text-muted-foreground">
            Attach limited-time offers to branch services.
          </p>
        </div>
        <Button size="lg" onClick={() => openForm()}>
          <Plus className="size-4" /> Add Deal
        </Button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Metric icon={<Tag className="size-4" />} label="Total deals" value={deals.length} />
        <Metric
          icon={<CircleCheck className="size-4" />}
          label="Active"
          value={deals.filter((deal) => deal.isActive).length}
        />
        <Metric
          icon={<Scissors className="size-4" />}
          label="Services ready"
          value={services.length}
        />
      </div>
      <div className="mt-6 rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search deals"
            className="max-w-sm"
          />
        </div>
        {dealsQuery.isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : filtered.length ? (
          <div className="grid gap-4 p-4 xl:grid-cols-2">
            {filtered.map((deal) => (
              <article key={deal.id} className="rounded-xl border border-border p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-2xl text-primary">{deal.name}</h2>
                      <Status active={deal.isActive} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {deal.description || "No description added"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <IconButton label="Edit" onClick={() => openForm(deal)}>
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton
                      label={deal.isActive ? "Deactivate" : "Activate"}
                      onClick={() => void toggle(deal)}
                    >
                      {deal.isActive ? (
                        <CircleOff className="size-4" />
                      ) : (
                        <CircleCheck className="size-4" />
                      )}
                    </IconButton>
                    <IconButton label="Delete" destructive onClick={() => void handleDelete(deal)}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <Info
                    label="Discount"
                    value={
                      deal.discountType === "percentage"
                        ? `${deal.discountValue}%`
                        : `Rs ${deal.discountValue.toLocaleString("en-IN")}`
                    }
                  />
                  <Info label="Starts" value={deal.startsOn} />
                  <Info label="Ends" value={deal.endsOn} />
                  <Info label="Services" value={`${deal.services.length} selected`} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="px-5 py-16 text-center text-muted-foreground">
            No deals available for this branch.
          </div>
        )}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-3xl flex-col overflow-hidden rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary">
              {editing === "new" ? "Add Deal" : "Edit Deal"}
            </DialogTitle>
            <DialogDescription>
              Set discount details and select eligible services.
            </DialogDescription>
          </DialogHeader>
          <form className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1" onSubmit={(event) => void submit(event)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Deal name">
                <Input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
              </Field>
              <Field label="Discount type">
                <Select
                  value={form.discountType}
                  onValueChange={(value: "percentage" | "fixed") =>
                    setForm({ ...form, discountType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed amount</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Discount value">
                <Input
                  type="number"
                  min="0"
                  max={form.discountType === "percentage" ? 100 : undefined}
                  value={form.discountValue}
                  onChange={(event) =>
                    setForm({ ...form, discountValue: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="Start date">
                <Input
                  type="date"
                  value={form.startsOn}
                  onChange={(event) => setForm({ ...form, startsOn: event.target.value })}
                />
              </Field>
              <Field label="End date">
                <Input
                  type="date"
                  value={form.endsOn}
                  onChange={(event) => setForm({ ...form, endsOn: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Description">
              <Textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </Field>
            <BusinessServicePicker
              services={services}
              value={form.serviceIds}
              onChange={(serviceIds) => setForm({ ...form, serviceIds })}
            />
            <DialogFooter className="shrink-0 border-t border-border bg-background pt-4">
              <Button type="submit">{editing === "new" ? "Add deal" : "Save changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-3xl font-semibold text-primary">{value}</p>
    </div>
  );
}

function Status({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-semibold",
        active ? "bg-emerald-50 text-emerald-700" : "bg-secondary text-muted-foreground",
      )}
    >
      {active ? "Active" : "Deactivated"}
    </span>
  );
}

function IconButton({
  label,
  destructive,
  children,
  onClick,
}: {
  label: string;
  destructive?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "rounded-lg border border-border p-2 hover:bg-secondary",
        destructive && "text-destructive hover:bg-destructive/10",
      )}
    >
      {children}
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/45 p-3">
      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
