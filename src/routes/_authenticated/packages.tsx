import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CircleCheck,
  CircleOff,
  Gift,
  Loader2,
  Pencil,
  Plus,
  Scissors,
  Trash2,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  deletePackage,
  listPackages,
  listSelectableServices,
  savePackage,
  setPackageActiveStatus,
} from "@/lib/business.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/packages")({
  head: () => ({
    meta: [
      { title: "Packages - Glowante Business" },
      { name: "description", content: "Bundle services into packages your clients can pre-book." },
    ],
  }),
  component: PackagesPage,
});

type PackageRecord = {
  id: string;
  name: string;
  description: string | null;
  packagePrice: number;
  validityDays: number;
  isActive: boolean;
  serviceIds: string[];
  services: SelectableService[];
};

const blankForm = {
  name: "",
  description: "",
  packagePrice: 0,
  validityDays: 90,
  serviceIds: [] as string[],
};

function PackagesPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirmation();
  const { activeSalonId: salonId } = useSalonBranches();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PackageRecord | null | "new">(null);
  const [form, setForm] = useState(blankForm);
  const getPackages = useServerFn(listPackages);
  const getServices = useServerFn(listSelectableServices);
  const save = useServerFn(savePackage);
  const setActive = useServerFn(setPackageActiveStatus);
  const remove = useServerFn(deletePackage);
  const packagesQuery = useQuery({
    queryKey: ["packages", salonId],
    queryFn: () => getPackages({ data: { salonId: salonId! } }),
    enabled: Boolean(salonId),
  });
  const servicesQuery = useQuery({
    queryKey: ["selectable-services", salonId],
    queryFn: () => getServices({ data: { salonId: salonId! } }),
    enabled: Boolean(salonId),
  });
  const packages = useMemo(
    () => (packagesQuery.data ?? []) as PackageRecord[],
    [packagesQuery.data],
  );
  const services = useMemo(
    () => (servicesQuery.data ?? []) as SelectableService[],
    [servicesQuery.data],
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return packages.filter(
      (item) => !term || `${item.name} ${item.description ?? ""}`.toLowerCase().includes(term),
    );
  }, [packages, search]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["packages", salonId] });

  function openForm(item?: PackageRecord) {
    if (item) {
      setEditing(item);
      setForm({
        name: item.name,
        description: item.description ?? "",
        packagePrice: item.packagePrice,
        validityDays: item.validityDays,
        serviceIds: item.serviceIds,
      });
    } else {
      setEditing("new");
      setForm(blankForm);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await save({
        data: {
          salonId: salonId!,
          id: editing && editing !== "new" ? editing.id : undefined,
          ...form,
        },
      });
      toast.success(editing === "new" ? "Package added" : "Package updated");
      setEditing(null);
      void refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save package");
    }
  }

  async function toggle(item: PackageRecord) {
    const isActive = !item.isActive;
    if (
      !(await confirm({
        title: `${isActive ? "Activate" : "Deactivate"} ${item.name}?`,
        description: isActive
          ? "This package can be sold again."
          : "Clients will no longer be able to buy this package.",
        confirmLabel: isActive ? "Activate" : "Deactivate",
        destructive: !isActive,
      }))
    )
      return;
    try {
      await setActive({ data: { salonId: salonId!, id: item.id, isActive } });
      toast.success(`Package ${isActive ? "activated" : "deactivated"}`);
      void refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update package");
    }
  }

  async function handleDelete(item: PackageRecord) {
    if (
      !(await confirm({
        title: `Delete ${item.name}?`,
        description: "This permanently removes the package and its service links.",
        confirmLabel: "Delete package",
        destructive: true,
      }))
    )
      return;
    try {
      await remove({ data: { salonId: salonId!, id: item.id } });
      toast.success("Package deleted");
      void refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete package");
    }
  }

  return (
    <div className="w-full px-4 py-7">
      <SalonBranchTabs className="mb-7" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Packages</p>
          <h1 className="font-display text-4xl text-primary">Service Bundles</h1>
          <p className="mt-1 text-muted-foreground">
            Create prepaid packages from branch services.
          </p>
        </div>
        <Button size="lg" onClick={() => openForm()}>
          <Plus className="size-4" /> Add Package
        </Button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Metric icon={<Gift className="size-4" />} label="Total packages" value={packages.length} />
        <Metric
          icon={<CircleCheck className="size-4" />}
          label="Active"
          value={packages.filter((item) => item.isActive).length}
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
            placeholder="Search packages"
            className="max-w-sm"
          />
        </div>
        {packagesQuery.isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : filtered.length ? (
          <div className="grid gap-4 p-4 xl:grid-cols-2">
            {filtered.map((item) => (
              <article key={item.id} className="rounded-xl border border-border p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-2xl text-primary">{item.name}</h2>
                      <Status active={item.isActive} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.description || "No description added"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <IconButton label="Edit" onClick={() => openForm(item)}>
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton
                      label={item.isActive ? "Deactivate" : "Activate"}
                      onClick={() => void toggle(item)}
                    >
                      {item.isActive ? (
                        <CircleOff className="size-4" />
                      ) : (
                        <CircleCheck className="size-4" />
                      )}
                    </IconButton>
                    <IconButton label="Delete" destructive onClick={() => void handleDelete(item)}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Info label="Price" value={`Rs ${item.packagePrice.toLocaleString("en-IN")}`} />
                  <Info label="Validity" value={`${item.validityDays} days`} />
                  <Info label="Services" value={`${item.services.length} selected`} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="px-5 py-16 text-center text-muted-foreground">
            No packages available for this branch.
          </div>
        )}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary">
              {editing === "new" ? "Add Package" : "Edit Package"}
            </DialogTitle>
            <DialogDescription>Bundle one or more services with a package price.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Package name">
                <Input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
              </Field>
              <Field label="Package price">
                <Input
                  type="number"
                  min="0"
                  value={form.packagePrice}
                  onChange={(event) =>
                    setForm({ ...form, packagePrice: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="Validity days">
                <Input
                  type="number"
                  min="1"
                  value={form.validityDays}
                  onChange={(event) =>
                    setForm({ ...form, validityDays: Number(event.target.value) })
                  }
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
            <DialogFooter>
              <Button type="submit">{editing === "new" ? "Add package" : "Save changes"}</Button>
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
