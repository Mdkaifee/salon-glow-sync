import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CalendarDays, Check, CirclePlus, Loader2, RotateCw, Users } from "lucide-react";
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
import {
  deleteBooking,
  listAvailableBookingSlots,
  listBookings,
  listSalonCustomers,
  listSelectableServices,
  listTeamMembers,
  requestCustomerOtp,
  saveBooking,
  setBookingStatus,
  verifyCustomerOtpAndSave,
} from "@/lib/business.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({
    meta: [
      { title: "Bookings - Glowante Business" },
      { name: "description", content: "Book appointments from customer, service and slot." },
    ],
  }),
  component: BookingsPage,
});

type Status = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";
type BookingView = "appointment" | "customers" | "add-customer" | "verify-customer";

type BookingRecord = {
  id: string;
  customerId: string | null;
  clientName: string;
  clientPhone: string;
  startsAt: string;
  endsAt: string;
  status: Status;
  totalAmount: number;
  notes: string | null;
  teamMemberId: string | null;
  teamMemberName: string | null;
  serviceIds: string[];
  services: SelectableService[];
};

type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
};

type TeamMember = {
  id: string;
  fullName: string;
  isActive: boolean;
  setupRequired: boolean;
  branchIds: string[];
  serviceIds: string[];
};

type Slot = { startsAt: string; label: string; durationMins: number };

const statuses: { value: Status; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No show" },
];

const blankForm = {
  customerId: "",
  clientName: "",
  clientPhone: "",
  date: today(),
  startsAt: "",
  teamMemberId: "",
  status: "confirmed" as Status,
  serviceIds: [] as string[],
};

const blankCustomer = { firstName: "", lastName: "", phone: "", code: "" };

function BookingsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirmation();
  const { activeSalonId: salonId } = useSalonBranches();
  const [editing, setEditing] = useState<BookingRecord | null | "new">(null);
  const [view, setView] = useState<BookingView>("appointment");
  const [form, setForm] = useState(blankForm);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDraft, setCustomerDraft] = useState(blankCustomer);
  const getBookings = useServerFn(listBookings);
  const getCustomers = useServerFn(listSalonCustomers);
  const getServices = useServerFn(listSelectableServices);
  const getTeam = useServerFn(listTeamMembers);
  const getSlots = useServerFn(listAvailableBookingSlots);
  const sendCustomerOtp = useServerFn(requestCustomerOtp);
  const verifyCustomer = useServerFn(verifyCustomerOtpAndSave);
  const save = useServerFn(saveBooking);
  const setStatus = useServerFn(setBookingStatus);
  const remove = useServerFn(deleteBooking);

  const bookingsQuery = useQuery({
    queryKey: ["bookings", salonId],
    queryFn: () => getBookings({ data: { salonId: salonId! } }),
    enabled: Boolean(salonId),
  });
  const customersQuery = useQuery({
    queryKey: ["customers", salonId],
    queryFn: () => getCustomers({ data: { salonId: salonId! } }),
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
  const slotsQuery = useQuery({
    queryKey: ["booking-slots", salonId, form.date, form.teamMemberId, form.serviceIds, editing],
    queryFn: () =>
      getSlots({
        data: {
          salonId: salonId!,
          date: form.date,
          teamMemberId: form.teamMemberId,
          serviceIds: form.serviceIds,
          bookingId: editing && editing !== "new" ? editing.id : undefined,
        },
      }),
    enabled: Boolean(editing && salonId && form.teamMemberId && form.serviceIds.length),
  });

  const bookings = useMemo(
    () => (bookingsQuery.data ?? []) as BookingRecord[],
    [bookingsQuery.data],
  );
  const customers = useMemo(() => (customersQuery.data ?? []) as Customer[], [customersQuery.data]);
  const services = useMemo(
    () => (servicesQuery.data ?? []) as SelectableService[],
    [servicesQuery.data],
  );
  const teamMembers = useMemo(() => {
    const selected = new Set(form.serviceIds);
    return ((teamQuery.data ?? []) as TeamMember[]).filter(
      (member) =>
        member.isActive &&
        !member.setupRequired &&
        (!salonId || member.branchIds.includes(salonId)) &&
        (!selected.size ||
          [...selected].every((serviceId) => member.serviceIds.includes(serviceId))),
    );
  }, [form.serviceIds, salonId, teamQuery.data]);
  const slots = (slotsQuery.data ?? []) as Slot[];
  const selectedCustomer = customers.find((customer) => customer.id === form.customerId) ?? null;
  const todaysBookings = bookings.filter((booking) => booking.startsAt.slice(0, 10) === form.date);
  const filteredCustomers = customers.filter((customer) =>
    `${customer.fullName} ${customer.phone}`.toLowerCase().includes(customerSearch.toLowerCase()),
  );
  const canBook = Boolean(
    form.customerId && form.teamMemberId && form.startsAt && form.serviceIds.length,
  );

  function openForm(booking?: BookingRecord) {
    setView("appointment");
    setCustomerSearch("");
    setCustomerDraft(blankCustomer);
    if (booking) {
      setEditing(booking);
      setForm({
        customerId: booking.customerId ?? "",
        clientName: booking.clientName,
        clientPhone: booking.clientPhone,
        date: booking.startsAt.slice(0, 10),
        startsAt: localInputValue(new Date(booking.startsAt)),
        teamMemberId: booking.teamMemberId ?? "",
        status: booking.status,
        serviceIds: booking.serviceIds,
      });
    } else {
      setEditing("new");
      setForm({ ...blankForm, date: today() });
    }
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canBook || !selectedCustomer) return;
    try {
      await save({
        data: {
          salonId: salonId!,
          id: editing && editing !== "new" ? editing.id : undefined,
          customerId: selectedCustomer.id,
          clientName: selectedCustomer.fullName,
          clientPhone: selectedCustomer.phone,
          startsAt: new Date(form.startsAt).toISOString(),
          teamMemberId: form.teamMemberId,
          packageId: null,
          dealId: null,
          status: form.status,
          notes: "",
          serviceIds: form.serviceIds,
        },
      });
      toast.success(editing === "new" ? "Appointment booked" : "Appointment updated");
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["bookings", salonId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save booking");
    }
  }

  async function addCustomer(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await sendCustomerOtp({
        data: { salonId: salonId!, phone: customerDraft.phone },
      });
      setCustomerDraft({ ...customerDraft, phone: result.phone, code: "" });
      setView("verify-customer");
      toast.success(`OTP sent to ${result.phone}`, {
        description: "Glowante: your verification code is 123456. Valid for 10 minutes.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send OTP");
    }
  }

  async function verifyCustomerOtp(event: FormEvent) {
    event.preventDefault();
    try {
      const customer = await verifyCustomer({ data: { salonId: salonId!, ...customerDraft } });
      await queryClient.invalidateQueries({ queryKey: ["customers", salonId] });
      setForm({
        ...form,
        customerId: customer.id,
        clientName: customer.fullName,
        clientPhone: customer.phone,
      });
      setView("appointment");
      toast.success("Customer added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not verify customer");
    }
  }

  async function updateStatus(booking: BookingRecord, status: Status) {
    try {
      await setStatus({ data: { salonId: salonId!, id: booking.id, status } });
      toast.success("Booking status updated");
      await queryClient.invalidateQueries({ queryKey: ["bookings", salonId] });
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
      await queryClient.invalidateQueries({ queryKey: ["bookings", salonId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete booking");
    }
  }

  return (
    <div className="w-full px-4 py-4">
      <SalonBranchTabs className="mb-7" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl text-primary">Today&apos;s Schedule</h1>
          <span className="h-8 w-px bg-border" />
          <Input
            type="date"
            className="w-44"
            value={form.date}
            onChange={(event) => setForm({ ...form, date: event.target.value })}
          />
        </div>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => void bookingsQuery.refetch()}
        >
          <RotateCw className="size-4" /> Refresh
        </Button>
      </div>

      <div className="mt-7 overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid min-w-[980px] grid-cols-[220px_1fr] border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2 border-r border-border p-4 font-semibold text-primary">
            <Users className="size-4" /> Team
          </div>
          <div className="grid grid-cols-8 text-center text-sm text-primary">
            {timeHeaders().map((label) => (
              <div key={label} className="border-r border-border p-4 last:border-r-0">
                {label}
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-[980px]">
          {teamMembers.length ? (
            teamMembers.map((member) => (
              <div
                key={member.id}
                className="grid grid-cols-[220px_1fr] border-b border-border last:border-b-0"
              >
                <div className="flex items-center gap-3 border-r border-border p-4">
                  <span className="grid size-8 place-items-center rounded-full bg-gold-soft text-sm font-semibold text-primary">
                    {member.fullName[0]}
                  </span>
                  <div>
                    <p className="font-semibold text-primary">{member.fullName}</p>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                      Available
                    </span>
                  </div>
                </div>
                <div className="relative grid h-28 grid-cols-8">
                  {timeHeaders().map((label) => (
                    <div key={label} className="border-r border-border last:border-r-0" />
                  ))}
                  {todaysBookings
                    .filter((booking) => booking.teamMemberId === member.id)
                    .map((booking) => (
                      <button
                        key={booking.id}
                        type="button"
                        className="absolute top-4 rounded-md bg-primary px-3 py-2 text-left text-xs text-primary-foreground shadow"
                        style={bookingBlockStyle(booking)}
                        onClick={() => openForm(booking)}
                      >
                        <span className="block font-semibold">{booking.clientName}</span>
                        <span>{formatTime(booking.startsAt)}</span>
                      </button>
                    ))}
                </div>
              </div>
            ))
          ) : (
            <div className="p-10 text-center text-muted-foreground">
              Assign and activate team members to see schedule rows.
            </div>
          )}
        </div>
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="size-4" /> {todaysBookings.length} bookings for selected date
      </p>
      <button
        type="button"
        aria-label="New appointment"
        className="fixed bottom-8 right-8 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg"
        onClick={() => openForm()}
      >
        <CirclePlus className="size-6" />
      </button>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[900px] overflow-y-auto rounded-lg px-10 py-9">
          {view === "appointment" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-semibold">
                  {editing === "new" ? "New Appointment" : "Edit Appointment"}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Select customer, services, team member and available slot.
                </DialogDescription>
              </DialogHeader>
              <form className="mt-6 space-y-6" onSubmit={(event) => void submit(event)}>
                <Field label="Select Customer" required>
                  <button
                    type="button"
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border text-muted-foreground"
                    onClick={() => setView("customers")}
                  >
                    <CirclePlus className="size-4 text-primary" />
                    {selectedCustomer ? selectedCustomer.fullName : "Add Customer"}
                  </button>
                </Field>
                <Field label="Date">
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(event) =>
                      setForm({ ...form, date: event.target.value, startsAt: "" })
                    }
                  />
                </Field>
                <Field label="Select Services" required>
                  <BusinessServicePicker
                    label="Add Service"
                    services={services}
                    value={form.serviceIds}
                    onChange={(serviceIds) =>
                      setForm({ ...form, serviceIds, teamMemberId: "", startsAt: "" })
                    }
                  />
                </Field>
                <Field label="Team Member" required>
                  <Select
                    value={form.teamMemberId || undefined}
                    onValueChange={(teamMemberId) =>
                      setForm({ ...form, teamMemberId, startsAt: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Available Slots" required>
                  <div className="min-h-12 rounded-md border border-dashed border-border p-3">
                    {slotsQuery.isLoading ? (
                      <Loader2 className="mx-auto size-5 animate-spin text-primary" />
                    ) : slots.length ? (
                      <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                        {slots.map((slot) => (
                          <button
                            key={slot.startsAt}
                            type="button"
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-sm",
                              form.startsAt === slot.startsAt
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card",
                            )}
                            onClick={() => setForm({ ...form, startsAt: slot.startsAt })}
                          >
                            {slot.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No available slots</p>
                    )}
                  </div>
                </Field>
                <DialogFooter className="justify-center">
                  <Button type="submit" disabled={!canBook} className="rounded-full px-8">
                    Book Appointment
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}

          {view === "customers" && (
            <CustomerPicker
              customers={filteredCustomers}
              search={customerSearch}
              onSearch={setCustomerSearch}
              onAdd={() => setView("add-customer")}
              onBack={() => setView("appointment")}
              onSelect={(customer) => {
                setForm({
                  ...form,
                  customerId: customer.id,
                  clientName: customer.fullName,
                  clientPhone: customer.phone,
                });
                setView("appointment");
              }}
            />
          )}

          {view === "add-customer" && (
            <CustomerForm
              draft={customerDraft}
              onDraft={setCustomerDraft}
              onBack={() => setView("customers")}
              onSubmit={addCustomer}
            />
          )}

          {view === "verify-customer" && (
            <CustomerOtp
              draft={customerDraft}
              onDraft={setCustomerDraft}
              onBack={() => setView("add-customer")}
              onSubmit={verifyCustomerOtp}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerPicker({
  customers,
  search,
  onSearch,
  onAdd,
  onBack,
  onSelect,
}: {
  customers: Customer[];
  search: string;
  onSearch: (value: string) => void;
  onAdd: () => void;
  onBack: () => void;
  onSelect: (customer: Customer) => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3 text-xl">
          <button type="button" onClick={onBack} aria-label="Back">
            <ArrowLeft className="size-5 text-muted-foreground" />
          </button>
          Select Customer
        </DialogTitle>
      </DialogHeader>
      <div className="mt-4 flex gap-3 border-t border-border pt-4">
        <Input
          placeholder="Search customer..."
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
        <Button type="button" variant="outline" className="rounded-full" onClick={onAdd}>
          <CirclePlus className="size-4" /> Add Customer
        </Button>
      </div>
      <div className="mt-4 max-h-72 overflow-y-auto">
        {customers.length ? (
          <div className="divide-y divide-border rounded-lg border border-border">
            {customers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                className="flex w-full items-center justify-between p-3 text-left hover:bg-secondary"
                onClick={() => onSelect(customer)}
              >
                <span>
                  <span className="block font-medium text-foreground">{customer.fullName}</span>
                  <span className="text-sm text-muted-foreground">{customer.phone}</span>
                </span>
                <Check className="size-4 text-primary" />
              </button>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-muted-foreground">No such user found</p>
        )}
      </div>
    </>
  );
}

function CustomerForm({
  draft,
  onDraft,
  onBack,
  onSubmit,
}: {
  draft: typeof blankCustomer;
  onDraft: (draft: typeof blankCustomer) => void;
  onBack: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl">Add New Customer</DialogTitle>
      </DialogHeader>
      <form className="mt-5 space-y-6" onSubmit={onSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="First Name"
            maxLength={50}
            value={draft.firstName}
            onChange={(event) => onDraft({ ...draft, firstName: event.target.value })}
            required
          />
          <Input
            placeholder="Last Name"
            maxLength={50}
            value={draft.lastName}
            onChange={(event) => onDraft({ ...draft, lastName: event.target.value })}
            required
          />
        </div>
        <Input
          placeholder="Phone Number"
          value={draft.phone}
          onChange={(event) => onDraft({ ...draft, phone: event.target.value })}
          required
        />
        <DialogFooter className="justify-center gap-2">
          <Button type="submit">Continue</Button>
          <Button type="button" variant="outline" onClick={onBack}>
            Cancel
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function CustomerOtp({
  draft,
  onDraft,
  onBack,
  onSubmit,
}: {
  draft: typeof blankCustomer;
  onDraft: (draft: typeof blankCustomer) => void;
  onBack: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <>
      <DialogHeader className="items-center text-center">
        <DialogTitle className="text-xl">Verify Phone Number</DialogTitle>
        <DialogDescription>OTP sent to {draft.phone}</DialogDescription>
      </DialogHeader>
      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <Input
          inputMode="numeric"
          maxLength={6}
          placeholder="Enter OTP (123456)"
          value={draft.code}
          onChange={(event) =>
            onDraft({ ...draft, code: event.target.value.replace(/\D/g, "").slice(0, 6) })
          }
          required
        />
        <DialogFooter className="justify-center gap-2">
          <Button type="submit" disabled={draft.code.length !== 6}>
            Verify
          </Button>
          <Button type="button" variant="outline" onClick={onBack}>
            Cancel
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function timeHeaders() {
  return ["10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM"];
}

function localInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { timeStyle: "short" }).format(new Date(value));
}

function bookingBlockStyle(booking: BookingRecord) {
  const start = new Date(booking.startsAt);
  const end = new Date(booking.endsAt);
  const minutes = start.getHours() * 60 + start.getMinutes();
  const duration = Math.max(20, (end.getTime() - start.getTime()) / 60000);
  const dayStart = 10 * 60;
  return {
    left: `${Math.max(0, ((minutes - dayStart) / (8 * 60)) * 100)}%`,
    width: `${Math.max(8, (duration / (8 * 60)) * 100)}%`,
  };
}
