import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, CirclePlus, Pencil, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type Gender = "male" | "female" | "other" | "all";
type DurationUnit = "day" | "week" | "month" | "year";
type PricingOption = "discount" | "fixed";
type DiscountType = "percentage" | "fixed";

type DealRecord = {
  id: string;
  name: string;
  description: string | null;
  pricingOption: PricingOption;
  originalPrice: number;
  offeredPrice: number;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount: number | null;
  terms: string | null;
  durationCount: number;
  durationUnit: DurationUnit;
  gender: Gender;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
  serviceIds: string[];
  services: SelectableService[];
};

const today = new Date().toISOString().slice(0, 10);
const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const blankForm = {
  name: "",
  pricingOption: "discount" as PricingOption,
  originalPrice: 0,
  offeredPrice: 0,
  discountType: "percentage" as DiscountType,
  discountValue: 0,
  maxDiscountAmount: 0,
  terms: "",
  durationCount: 1,
  durationUnit: "month" as DurationUnit,
  gender: "all" as Gender,
  startsOn: today,
  endsOn: nextMonth,
  serviceIds: [] as string[],
};

function DealsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirmation();
  const { activeSalonId: salonId } = useSalonBranches();
  const [editing, setEditing] = useState<DealRecord | null | "new">(null);
  const [details, setDetails] = useState<DealRecord | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
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
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["deals", salonId] });

  function openForm(deal?: DealRecord) {
    setStep(1);
    if (deal) {
      setEditing(deal);
      setForm({
        name: deal.name,
        pricingOption: deal.pricingOption ?? "discount",
        originalPrice: deal.originalPrice ?? 0,
        offeredPrice: deal.offeredPrice ?? 0,
        discountType: deal.discountType ?? "percentage",
        discountValue: deal.discountValue ?? 0,
        maxDiscountAmount: deal.maxDiscountAmount ?? 0,
        terms: deal.terms ?? "",
        durationCount: deal.durationCount ?? 1,
        durationUnit: deal.durationUnit ?? "month",
        gender: deal.gender ?? "all",
        startsOn: deal.startsOn ?? today,
        endsOn: deal.endsOn ?? nextMonth,
        serviceIds: deal.serviceIds,
      });
    } else {
      setEditing("new");
      setForm(blankForm);
    }
  }

  async function submit() {
    try {
      await save({
        data: {
          salonId: salonId!,
          id: editing && editing !== "new" ? editing.id : undefined,
          ...form,
          description: form.terms,
          maxDiscountAmount:
            form.pricingOption === "discount" ? form.maxDiscountAmount || null : null,
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
        title: `${isActive ? "Activate" : "Inactivate"} ${deal.name}?`,
        description: isActive
          ? "This deal will be available again."
          : "This deal will be hidden from booking and sales.",
        confirmLabel: isActive ? "Activate" : "Inactivate",
        destructive: !isActive,
      }))
    )
      return;
    try {
      await setActive({ data: { salonId: salonId!, id: deal.id, isActive } });
      toast.success(`Deal ${isActive ? "activated" : "inactivated"}`);
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
    <div className="w-full px-4 py-4">
      <SalonBranchTabs className="mb-7" />
      <div className="flex justify-end">
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-dashed border-border bg-card px-5 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:border-accent hover:text-primary"
          onClick={() => openForm()}
        >
          <CirclePlus className="size-4 text-primary" /> Add Deals
        </button>
      </div>

      <div className="mt-6">
        {dealsQuery.isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2Icon />
          </div>
        ) : deals.length ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                actionLabel={deal.isActive ? "Inactivate" : "Activate"}
                onDetails={() => setDetails(deal)}
                onToggle={() => void toggle(deal)}
                onEdit={() => openForm(deal)}
                onDelete={() => void handleDelete(deal)}
              />
            ))}
          </div>
        ) : (
          <EmptyState label="No deals available" />
        )}
      </div>

      <DealDialog
        open={Boolean(editing)}
        mode={editing === "new" ? "create" : "edit"}
        step={step}
        form={form}
        services={services}
        onClose={() => setEditing(null)}
        onStep={setStep}
        onForm={setForm}
        onSubmit={() => void submit()}
      />

      <DetailsDialog item={details} onClose={() => setDetails(null)} />
    </div>
  );
}

function DealDialog({
  open,
  mode,
  step,
  form,
  services,
  onClose,
  onStep,
  onForm,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  step: 1 | 2;
  form: typeof blankForm;
  services: SelectableService[];
  onClose: () => void;
  onStep: (step: 1 | 2) => void;
  onForm: (form: typeof blankForm) => void;
  onSubmit: () => void;
}) {
  const selectedServices = services.filter((service) => form.serviceIds.includes(service.id));
  const canReview = form.name.trim().length > 1 && form.serviceIds.length > 0;
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[720px] overflow-y-auto rounded-lg bg-card px-9 py-8 sm:px-12">
        <DialogHeader className="items-center text-center">
          <DialogTitle className="font-display text-lg text-primary">
            {mode === "create" ? "Create Deal" : "Edit Deal"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Fill deal details, then review and submit.
          </DialogDescription>
        </DialogHeader>
        <StepHeader step={step} />

        {step === 1 ? (
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (canReview) onStep(2);
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Deal Title" required>
                <Input
                  placeholder="Eg: Weekend Hair Deal"
                  value={form.name}
                  onChange={(event) => onForm({ ...form, name: event.target.value })}
                  required
                />
              </Field>
              <Field label="Pricing Option" required>
                <Select
                  value={form.pricingOption}
                  onValueChange={(pricingOption: PricingOption) =>
                    onForm({ ...form, pricingOption })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discount">Discount</SelectItem>
                    <SelectItem value="fixed">Fixed Price</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Select Services" required>
              <BusinessServicePicker
                services={services}
                value={form.serviceIds}
                onChange={(serviceIds) => onForm({ ...form, serviceIds })}
              />
            </Field>

            {form.pricingOption === "discount" ? (
              <>
                <Field label="Discount Type" required>
                  <Select
                    value={form.discountType}
                    onValueChange={(discountType: DiscountType) =>
                      onForm({ ...form, discountType })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Flat Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label={
                      form.discountType === "percentage" ? "Percentage Off (%)" : "Amount Off (Rs)"
                    }
                    required
                  >
                    <Input
                      type="number"
                      min="0"
                      max={form.discountType === "percentage" ? 100 : undefined}
                      placeholder={form.discountType === "percentage" ? "e.g. 50" : "e.g. 100"}
                      value={form.discountValue}
                      onChange={(event) =>
                        onForm({ ...form, discountValue: Number(event.target.value) })
                      }
                    />
                  </Field>
                  {form.discountType === "percentage" && (
                    <Field label="Max Discount Amount (Rs)" required>
                      <Input
                        type="number"
                        min="0"
                        placeholder="e.g. 100"
                        value={form.maxDiscountAmount}
                        onChange={(event) =>
                          onForm({ ...form, maxDiscountAmount: Number(event.target.value) })
                        }
                      />
                    </Field>
                  )}
                </div>
              </>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Original Price" required>
                <Input
                  type="number"
                  min="0"
                  value={form.originalPrice}
                  onChange={(event) =>
                    onForm({ ...form, originalPrice: Number(event.target.value) })
                  }
                />
              </Field>
              <Field
                label={form.pricingOption === "fixed" ? "Offered Price" : "Discounted Price"}
                required
              >
                <Input
                  type="number"
                  min="0"
                  placeholder="Final price to offer (Rs)"
                  value={form.offeredPrice}
                  onChange={(event) =>
                    onForm({ ...form, offeredPrice: Number(event.target.value) })
                  }
                />
              </Field>
            </div>

            <Field label="Terms" optional>
              <Input
                maxLength={50}
                placeholder="Any terms & conditions..."
                value={form.terms}
                onChange={(event) => onForm({ ...form, terms: event.target.value })}
              />
              <p className="mt-1 text-right text-[10px] text-muted-foreground">
                {form.terms.length}/50
              </p>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Start Date" required>
                <Input
                  type="date"
                  value={form.startsOn}
                  onChange={(event) => onForm({ ...form, startsOn: event.target.value })}
                />
              </Field>
              <Field label="End Date" required>
                <Input
                  type="date"
                  value={form.endsOn}
                  onChange={(event) => onForm({ ...form, endsOn: event.target.value })}
                />
              </Field>
              <Field label="Duration" required>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g. 3"
                  value={form.durationCount}
                  onChange={(event) =>
                    onForm({ ...form, durationCount: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="Unit" required>
                <Select
                  value={form.durationUnit}
                  onValueChange={(durationUnit: DurationUnit) => onForm({ ...form, durationUnit })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="year">Year</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Gender" required>
              <GenderPicker
                value={form.gender}
                onChange={(gender) => onForm({ ...form, gender })}
              />
            </Field>

            <DialogFooter className="pt-4">
              <Button type="submit" disabled={!canReview} className="rounded-full px-8">
                Review Summary
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="rounded-lg border border-border p-5">
              <h3 className="font-display text-xl text-primary">{form.name}</h3>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <Summary
                  label="Services"
                  value={selectedServices.map((service) => service.name).join(", ")}
                />
                <Summary label="Pricing" value={priceSummary(form)} />
                <Summary
                  label="Original Price"
                  value={`Rs ${form.originalPrice.toLocaleString("en-IN")}`}
                />
                <Summary
                  label="Offered Price"
                  value={`Rs ${form.offeredPrice.toLocaleString("en-IN")}`}
                />
                <Summary label="Dates" value={`${form.startsOn} to ${form.endsOn}`} />
                <Summary
                  label="Duration"
                  value={`${form.durationCount} ${unitLabel(form.durationUnit, form.durationCount)}`}
                />
                <Summary label="Gender" value={genderLabel(form.gender)} />
                <Summary label="Terms" value={form.terms || "Not added"} />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onStep(1)}>
                Back
              </Button>
              <Button type="button" className="rounded-full px-8" onClick={onSubmit}>
                Submit Deal
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DealCard({
  deal,
  actionLabel,
  onDetails,
  onToggle,
  onEdit,
  onDelete,
}: {
  deal: DealRecord;
  actionLabel: string;
  onDetails: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const firstService = deal.services[0]?.name ?? "Services";
  return (
    <article className="relative min-h-64 overflow-hidden rounded-lg border border-border bg-card p-4 shadow-md">
      <Ribbon label={genderLabel(deal.gender)} />
      <h2 className="pr-20 text-xl font-bold text-foreground">{deal.name}</h2>
      <span className="mt-3 inline-flex rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
        {firstService}
      </span>
      <dl className="mt-5 space-y-3 text-base">
        <CardRow
          label="Actual Price:"
          value={`Rs ${deal.originalPrice.toLocaleString("en-IN")}`}
          muted
          strike
        />
        <CardRow
          label="Discounted Price:"
          value={`Rs ${deal.offeredPrice.toLocaleString("en-IN")}`}
          accent
          suffix="(Inc. taxes)"
        />
        <CardRow label="Duration:" value={`${totalDuration(deal.services)} mins`} />
      </dl>
      <div className="mt-6 flex items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-orange-500 text-orange-600 hover:bg-orange-50"
          onClick={onDetails}
        >
          Details
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-orange-600 text-white hover:bg-orange-700"
          onClick={onToggle}
        >
          {actionLabel}
        </Button>
        <IconButton label="Edit" onClick={onEdit}>
          <Pencil className="size-4" />
        </IconButton>
        <IconButton label="Delete" destructive onClick={onDelete}>
          <Trash2 className="size-4" />
        </IconButton>
      </div>
    </article>
  );
}

function DetailsDialog({ item, onClose }: { item: DealRecord | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg rounded-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">Deal Details</DialogTitle>
          <DialogDescription>{item.name}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <Summary
            label="Services"
            value={item.services.map((service) => service.name).join(", ")}
          />
          <Summary
            label="Actual Price"
            value={`Rs ${item.originalPrice.toLocaleString("en-IN")}`}
          />
          <Summary
            label="Offered Price"
            value={`Rs ${item.offeredPrice.toLocaleString("en-IN")}`}
          />
          <Summary label="Dates" value={`${item.startsOn} to ${item.endsOn}`} />
          <Summary
            label="Duration"
            value={`${item.durationCount} ${unitLabel(item.durationUnit, item.durationCount)}`}
          />
          <Summary label="Gender" value={genderLabel(item.gender)} />
          <Summary label="Terms" value={item.terms || "Not added"} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StepHeader({ step }: { step: 1 | 2 }) {
  return (
    <div className="mt-5 flex items-center justify-center gap-3 text-xs">
      <Step active={step === 1} done={step > 1} label="Fill Details" number={1} />
      <span className="h-px w-20 bg-border" />
      <Step active={step === 2} label="Review & Submit" number={2} />
    </div>
  );
}

function Step({
  active,
  done,
  number,
  label,
}: {
  active: boolean;
  done?: boolean;
  number: number;
  label: string;
}) {
  return (
    <span
      className={cn("flex items-center gap-2", active ? "text-primary" : "text-muted-foreground")}
    >
      <span
        className={cn(
          "grid size-5 place-items-center rounded-full border text-xs font-semibold",
          active || done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card",
        )}
      >
        {done ? <Check className="size-3" /> : number}
      </span>
      {label}
    </span>
  );
}

function Field({
  label,
  required,
  optional,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-foreground">
      {label} {required && <span className="text-destructive">*</span>}
      {optional && <span className="ml-1 text-[10px] text-muted-foreground">(optional)</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function GenderPicker({ value, onChange }: { value: Gender; onChange: (value: Gender) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-4 pt-1 text-sm">
      {(["male", "female", "other"] as const).map((gender) => (
        <button
          key={gender}
          type="button"
          className="inline-flex items-center gap-2"
          onClick={() => onChange(gender)}
        >
          <span
            className={cn(
              "size-4 rounded-full border",
              value === gender
                ? "border-primary bg-primary shadow-[inset_0_0_0_3px_white]"
                : "border-primary",
            )}
          />
          {genderLabel(gender)}
        </button>
      ))}
    </div>
  );
}

function CardRow({
  label,
  value,
  muted,
  strike,
  accent,
  suffix,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strike?: boolean;
  accent?: boolean;
  suffix?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-medium text-foreground",
          muted && "text-muted-foreground",
          accent && "text-orange-600",
          strike && "line-through",
        )}
      >
        {value} {suffix && <span className="text-[10px] font-normal">{suffix}</span>}
      </dd>
    </div>
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
      className={cn("p-1.5 text-orange-600 hover:text-orange-700", destructive && "text-red-700")}
    >
      {children}
    </button>
  );
}

function Ribbon({ label }: { label: string }) {
  return (
    <span className="absolute -right-10 top-5 w-36 rotate-45 bg-orange-500 py-1 text-center text-xs font-semibold text-white">
      {label}
    </span>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm text-foreground">{value || "Not added"}</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card px-5 py-16 text-center text-muted-foreground">
      {label}
    </div>
  );
}

function Loader2Icon() {
  return (
    <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  );
}

function totalDuration(services: SelectableService[]) {
  return services.reduce((sum, service) => sum + service.durationMins, 0);
}

function priceSummary(form: typeof blankForm) {
  if (form.pricingOption === "fixed") return "Fixed Price";
  return form.discountType === "percentage"
    ? `${form.discountValue}% off`
    : `Rs ${form.discountValue.toLocaleString("en-IN")} off`;
}

function genderLabel(gender: Gender) {
  if (gender === "male") return "Male";
  if (gender === "female") return "Female";
  if (gender === "other") return "Other";
  return "All";
}

function unitLabel(unit: DurationUnit, count: number) {
  const base = unit[0]!.toUpperCase() + unit.slice(1);
  return count === 1 ? base : `${base}s`;
}
