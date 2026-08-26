import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Scissors,
  Trash2,
  UserRound,
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
  deleteBooking,
  listBookings,
  listDeals,
  listPackages,
  listSelectableServices,
  listTeamMembers,
  saveBooking,
  setBookingStatus,
} from "@/lib/business.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({
    meta: [
      { title: "Bookings - Glowante Business" },
      {
        name: "description",
        content: "Track upcoming and past salon appointments in one calendar.",
      },
    ],
  }),
  component: BookingsPage,
});

type Status = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";
type BookingRecord = {
  id: string;
  clientName: string;
  clientPhone: string;
  startsAt: string;
  endsAt: string;
  status: Status;
  totalAmount: number;
  notes: string | null;
  teamMemberId: string | null;
  teamMemberName: string | null;
  packageId: string | null;
  packageName: string | null;
  dealId: string | null;
  dealName: string | null;
  serviceIds: string[];
  services: SelectableService[];
};
type TeamMember = { id: string; fullName: string; isActive: boolean; branchIds: string[] };
type PackageOption = { id: string; name: string; isActive: boolean };
type DealOption = { id: string; name: string; isActive: boolean };

const statuses: { value: Status; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No show" },
];

const blankForm = {
  clientName: "",
  clientPhone: "",
  startsAt: localInputValue(new Date()),
  teamMemberId: "none",
  packageId: "none",
  dealId: "none",
  status: "pending" as Status,
  notes: "",
  serviceIds: [] as string[],
};

function BookingsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirmation();
  const { activeSalonId: salonId } = useSalonBranches();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<BookingRecord | null | "new">(null);
  const [form, setForm] = useState(blankForm);
  const getBookings = useServerFn(listBookings);
  const getServices = useServerFn(listSelectableServices);
  const getTeam = useServerFn(listTeamMembers);
  const getPackages = useServerFn(listPackages);
  const getDeals = useServerFn(listDeals);
  const save = useServerFn(saveBooking);
  const setStatus = useServerFn(setBookingStatus);
  const remove = useServerFn(deleteBooking);
  const bookingsQuery = useQuery({
    queryKey: ["bookings", salonId],
    queryFn: () => getBookings({ data: { salonId: salonId! } }),
    enabled: Boolean(salonId),
  });
  const servicesQuery = useQuery({
    queryKey: ["selectable-services", salonId],
    queryFn: () => getServices({ data: { salonId: salonId! } }),
    enabled: Boolean(salonId),
  });
  const teamQuery = useQuery({
    queryKey: ["team-members", salonId],
    queryFn: () => getTeam({ data: { salonId: salonId! } }),
    enabled: Boolean(salonId),
  });
  const packagesQuery = useQuery({
    queryKey: ["packages", salonId],
    queryFn: () => getPackages({ data: { salonId: salonId! } }),
    enabled: Boolean(salonId),
  });
  const dealsQuery = useQuery({
    queryKey: ["deals", salonId],
    queryFn: () => getDeals({ data: { salonId: salonId! } }),
    enabled: Boolean(salonId),
  });
  const bookings = useMemo(
    () => (bookingsQuery.data ?? []) as BookingRecord[],
    [bookingsQuery.data],
  );
  const services = useMemo(
    () => (servicesQuery.data ?? []) as SelectableService[],
    [servicesQuery.data],
  );
  const teamMembers = useMemo(
    () =>
      ((teamQuery.data ?? []) as TeamMember[]).filter(
        (member) => member.isActive && (!salonId || member.branchIds.includes(salonId)),
      ),
    [salonId, teamQuery.data],
  );
  const packages = useMemo(
    () => ((packagesQuery.data ?? []) as PackageOption[]).filter((item) => item.isActive),
    [packagesQuery.data],
  );
  const deals = useMemo(
    () => ((dealsQuery.data ?? []) as DealOption[]).filter((item) => item.isActive),
    [dealsQuery.data],
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return bookings.filter(
      (booking) =>
        !term ||
        `${booking.clientName} ${booking.clientPhone} ${booking.teamMemberName ?? ""}`
          .toLowerCase()
          .includes(term),
    );
  }, [bookings, search]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["bookings", salonId] });

  function openForm(booking?: BookingRecord) {
    if (booking) {
      setEditing(booking);
      setForm({
        clientName: booking.clientName,
        clientPhone: booking.clientPhone,
        startsAt: localInputValue(new Date(booking.startsAt)),
        teamMemberId: booking.teamMemberId ?? "none",
        packageId: booking.packageId ?? "none",
        dealId: booking.dealId ?? "none",
        status: booking.status,
        notes: booking.notes ?? "",
        serviceIds: booking.serviceIds,
      });
    } else {
      setEditing("new");
      setForm({ ...blankForm, startsAt: localInputValue(new Date()) });
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await save({
        data: {
          salonId: salonId!,
          id: editing && editing !== "new" ? editing.id : undefined,
          clientName: form.clientName,
          clientPhone: form.clientPhone,
          startsAt: new Date(form.startsAt).toISOString(),
          teamMemberId: form.teamMemberId === "none" ? null : form.teamMemberId,
          packageId: form.packageId === "none" ? null : form.packageId,
          dealId: form.dealId === "none" ? null : form.dealId,
          status: form.status,
          notes: form.notes,
          serviceIds: form.serviceIds,
        },
      });
      toast.success(editing === "new" ? "Booking added" : "Booking updated");
      setEditing(null);
      void refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save booking");
    }
  }

  async function updateStatus(booking: BookingRecord, status: Status) {
    try {
      await setStatus({ data: { salonId: salonId!, id: booking.id, status } });
      toast.success("Booking status updated");
      void refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update status");
    }
  }

  async function handleDelete(booking: BookingRecord) {
    if (
      !(await confirm({
        title: `Delete booking for ${booking.clientName}?`,
        description: "This permanently removes the booking and service links.",
        confirmLabel: "Delete booking",
        destructive: true,
      }))
    )
      return;
    try {
      await remove({ data: { salonId: salonId!, id: booking.id } });
      toast.success("Booking deleted");
      void refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete booking");
    }
  }

  return (
    <div className="w-full px-4 py-7">
      <SalonBranchTabs className="mb-7" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Bookings</p>
          <h1 className="font-display text-4xl text-primary">Appointments</h1>
          <p className="mt-1 text-muted-foreground">
            Create bookings, assign stylists and progress appointment status.
          </p>
        </div>
        <Button size="lg" onClick={() => openForm()}>
          <Plus className="size-4" /> Add Booking
        </Button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Metric
          icon={<CalendarDays className="size-4" />}
          label="Total bookings"
          value={bookings.length}
        />
        <Metric
          icon={<CheckCircle2 className="size-4" />}
          label="Confirmed"
          value={bookings.filter((item) => item.status === "confirmed").length}
        />
        <Metric
          icon={<UserRound className="size-4" />}
          label="Available team"
          value={teamMembers.length}
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
            placeholder="Search bookings"
            className="max-w-sm"
          />
        </div>
        {bookingsQuery.isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : filtered.length ? (
          <div className="divide-y divide-border">
            {filtered.map((booking) => (
              <article
                key={booking.id}
                className="grid gap-4 p-4 lg:grid-cols-[1.4fr_1fr_auto] lg:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-2xl text-primary">{booking.clientName}</h2>
                    <StatusBadge status={booking.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">{booking.clientPhone}</p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
                    <CalendarClock className="size-4 text-accent" />
                    {formatDateTime(booking.startsAt)} - {formatTime(booking.endsAt)}
                  </p>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <Info label="Stylist" value={booking.teamMemberName ?? "Unassigned"} />
                  <Info
                    label="Amount"
                    value={`Rs ${booking.totalAmount.toLocaleString("en-IN")}`}
                  />
                  <Info label="Services" value={`${booking.services.length} selected`} />
                  <Info label="Offer" value={booking.packageName ?? booking.dealName ?? "None"} />
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Select
                    value={booking.status}
                    onValueChange={(value: Status) => void updateStatus(booking, value)}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <IconButton label="Edit" onClick={() => openForm(booking)}>
                    <Pencil className="size-4" />
                  </IconButton>
                  <IconButton label="Delete" destructive onClick={() => void handleDelete(booking)}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="px-5 py-16 text-center text-muted-foreground">
            No bookings for this branch.
          </div>
        )}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-3xl flex-col overflow-hidden rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary">
              {editing === "new" ? "Add Booking" : "Edit Booking"}
            </DialogTitle>
            <DialogDescription>
              Select services first; the backend calculates end time and amount.
            </DialogDescription>
          </DialogHeader>
          <form className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1" onSubmit={(event) => void submit(event)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client name">
                <Input
                  value={form.clientName}
                  onChange={(event) => setForm({ ...form, clientName: event.target.value })}
                  required
                />
              </Field>
              <Field label="Client phone">
                <Input
                  value={form.clientPhone}
                  onChange={(event) => setForm({ ...form, clientPhone: event.target.value })}
                  required
                />
              </Field>
              <Field label="Start time">
                <Input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
                  required
                />
              </Field>
              <Field label="Stylist">
                <Select
                  value={form.teamMemberId}
                  onValueChange={(teamMemberId) => setForm({ ...form, teamMemberId })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Package">
                <Select
                  value={form.packageId}
                  onValueChange={(packageId) => setForm({ ...form, packageId })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No package</SelectItem>
                    {packages.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Deal">
                <Select
                  value={form.dealId}
                  onValueChange={(dealId) => setForm({ ...form, dealId })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No deal</SelectItem>
                    {deals.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select
                  value={form.status}
                  onValueChange={(status: Status) => setForm({ ...form, status })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </Field>
            <BusinessServicePicker
              services={services}
              value={form.serviceIds}
              onChange={(serviceIds) => setForm({ ...form, serviceIds })}
            />
            <DialogFooter className="shrink-0 border-t border-border bg-background pt-4">
              <Button type="submit">{editing === "new" ? "Add booking" : "Save changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function localInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { timeStyle: "short" }).format(new Date(value));
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

function StatusBadge({ status }: { status: Status }) {
  const style =
    status === "completed"
      ? "bg-emerald-50 text-emerald-700"
      : status === "cancelled" || status === "no_show"
        ? "bg-destructive/10 text-destructive"
        : status === "confirmed"
          ? "bg-gold-soft text-primary"
          : "bg-secondary text-muted-foreground";
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", style)}>
      {statuses.find((item) => item.value === status)?.label ?? status}
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
