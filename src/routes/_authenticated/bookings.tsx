import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Eye,
  Loader2,
  Plus,
  RotateCw,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
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
  completeBookingJob,
  deleteBooking,
  listAvailableBookingSlots,
  listBookings,
  listSalonCustomers,
  listSelectableServices,
  listTeamMemberSchedule,
  listTeamMembers,
  requestCustomerOtp,
  saveBooking,
  setBookingStatus,
  startBookingJob,
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
type BookingView = "details" | "appointment" | "customers" | "add-customer" | "verify-customer";

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
  serviceTeamMemberIds: Record<string, string>;
  services: SelectableService[];
  startedAt: string | null;
  completedAt: string | null;
  rating: number | null;
  reviewComment: string | null;
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
  phone: string | null;
  email: string | null;
  roleTitle: string | null;
  experienceYears: number;
  profileImageUrl: string | null;
  isActive: boolean;
  setupRequired: boolean;
  branchIds: string[];
  serviceIds: string[];
  services: { id: string; name: string }[];
};

const DEFAULT_DAY_START_MINUTES = 9 * 60;
const DEFAULT_DAY_END_MINUTES = 21 * 60;
const SLOT_MINUTES = 10;
const SLOT_WIDTH = 64;
const ROW_HEIGHT = 96;

const STATUS_META: Record<Status, { label: string; className: string }> = {
  pending: { label: "Pending", className: "text-sky-600" },
  confirmed: { label: "Confirmed", className: "text-emerald-600" },
  in_progress: { label: "In progress", className: "text-amber-600" },
  completed: { label: "Completed", className: "text-emerald-700" },
  cancelled: { label: "Cancelled", className: "text-destructive" },
  no_show: { label: "No show", className: "text-destructive" },
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
  serviceTeamMemberIds: {} as Record<string, string>,
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
  const [viewingMember, setViewingMember] = useState<TeamMember | null>(null);
  const [assignToMember, setAssignToMember] = useState<TeamMember | null>(null);
  const [startingJob, setStartingJob] = useState<BookingRecord | null>(null);
  const [startOtp, setStartOtp] = useState("");
  const [finishingJob, setFinishingJob] = useState<BookingRecord | null>(null);
  const [finishRating, setFinishRating] = useState(0);
  const [finishComment, setFinishComment] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const getBookings = useServerFn(listBookings);
  const getCustomers = useServerFn(listSalonCustomers);
  const getServices = useServerFn(listSelectableServices);
  const getTeam = useServerFn(listTeamMembers);
  const getSalonSchedule = useServerFn(listTeamMemberSchedule);
  const getSlots = useServerFn(listAvailableBookingSlots);
  const sendCustomerOtp = useServerFn(requestCustomerOtp);
  const verifyCustomer = useServerFn(verifyCustomerOtpAndSave);
  const save = useServerFn(saveBooking);
  const setStatus = useServerFn(setBookingStatus);
  const remove = useServerFn(deleteBooking);
  const startJob = useServerFn(startBookingJob);
  const finishJob = useServerFn(completeBookingJob);

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
  const salonScheduleQuery = useQuery({
    queryKey: ["salon-hours", salonId],
    queryFn: () => getSalonSchedule({ data: { salonId: salonId! } }),
    enabled: Boolean(salonId),
  });
  const assignedTeamMemberIds = useMemo(
    () => form.serviceIds.map((serviceId) => form.serviceTeamMemberIds[serviceId]).filter(Boolean),
    [form.serviceIds, form.serviceTeamMemberIds],
  );
  const primaryTeamMemberId = assignedTeamMemberIds[0] ?? "";
  const serviceTeamComplete = Boolean(
    form.serviceIds.length &&
    form.serviceIds.every((serviceId) => form.serviceTeamMemberIds[serviceId]),
  );
  const slotsQuery = useQuery({
    queryKey: [
      "booking-slots",
      salonId,
      form.date,
      form.serviceIds,
      form.serviceTeamMemberIds,
      editing,
    ],
    queryFn: () =>
      getSlots({
        data: {
          salonId: salonId!,
          date: form.date,
          teamMemberId: primaryTeamMemberId,
          serviceIds: form.serviceIds,
          serviceTeamMemberIds: form.serviceTeamMemberIds,
          bookingId: editing && editing !== "new" ? editing.id : undefined,
        },
      }),
    enabled: Boolean(editing && salonId && serviceTeamComplete),
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
  const teamMembers = useMemo(
    () =>
      ((teamQuery.data ?? []) as TeamMember[]).filter(
        (member) =>
          member.isActive &&
          !member.setupRequired &&
          (!salonId || member.branchIds.includes(salonId)),
      ),
    [salonId, teamQuery.data],
  );
  const dayOfWeek = useMemo(() => dayOfWeekForDate(form.date), [form.date]);
  const todaySchedule = useMemo(
    () => (salonScheduleQuery.data ?? []).find((day) => day.dayOfWeek === dayOfWeek),
    [salonScheduleQuery.data, dayOfWeek],
  );
  const salonClosedToday = Boolean(todaySchedule && !todaySchedule.isWorking);
  const todaysBookings = useMemo(
    () => bookings.filter((booking) => localDateFromIso(booking.startsAt) === form.date),
    [bookings, form.date],
  );
  // A booking whose team member was removed/deactivated since it was made
  // won't render as a card on any row — exclude it here too so the count
  // always matches the cards actually shown.
  const visibleTodaysBookings = useMemo(
    () =>
      todaysBookings.filter((booking) =>
        bookingTeamMemberIds(booking).some((id) => teamMembers.some((member) => member.id === id)),
      ),
    [todaysBookings, teamMembers],
  );
  const scheduleStartMinutes = todaySchedule?.isWorking
    ? timeToMinutes(todaySchedule.startTime)
    : DEFAULT_DAY_START_MINUTES;
  const scheduleEndMinutes = todaySchedule?.isWorking
    ? timeToMinutes(todaySchedule.endTime)
    : DEFAULT_DAY_END_MINUTES;
  // Bookings outside the salon's configured hours (edge cases, or hours
  // changed after the booking was made) must still be visible on the grid
  // instead of silently rendering off-screen.
  const dayStartMinutes = todaysBookings.reduce((min, booking) => {
    const start = new Date(booking.startsAt);
    return Math.min(min, start.getHours() * 60 + start.getMinutes());
  }, scheduleStartMinutes);
  const dayEndMinutes = todaysBookings.reduce((max, booking) => {
    const end = new Date(booking.endsAt);
    return Math.max(max, end.getHours() * 60 + end.getMinutes());
  }, scheduleEndMinutes);
  const timelineSlots = useMemo(
    () => timeSlots(dayStartMinutes, dayEndMinutes),
    [dayStartMinutes, dayEndMinutes],
  );

  function scrollTimeline(direction: -1 | 1) {
    scrollRef.current?.scrollBy({ left: direction * SLOT_WIDTH * 6, behavior: "smooth" });
  }
  const selectedServices = useMemo(
    () => services.filter((service) => form.serviceIds.includes(service.id)),
    [form.serviceIds, services],
  );
  const membersByService = useMemo(() => {
    const map = new Map<string, TeamMember[]>();
    for (const service of services) {
      map.set(
        service.id,
        teamMembers.filter((member) => member.serviceIds.includes(service.id)),
      );
    }
    return map;
  }, [services, teamMembers]);
  const slots = (slotsQuery.data ?? []) as Slot[];
  const selectedCustomer = customers.find((customer) => customer.id === form.customerId) ?? null;
  const filteredCustomers = customers.filter((customer) =>
    `${customer.fullName} ${customer.phone}`.toLowerCase().includes(customerSearch.toLowerCase()),
  );
  const canBook = Boolean(form.customerId && serviceTeamComplete && form.startsAt);

  function updateServices(serviceIds: string[]) {
    if (assignToMember) {
      setForm({
        ...form,
        serviceIds,
        serviceTeamMemberIds: Object.fromEntries(
          serviceIds.map((serviceId) => [serviceId, assignToMember.id]),
        ),
        teamMemberId: assignToMember.id,
        startsAt: "",
      });
      return;
    }
    const nextAssignments = serviceIds.reduce<Record<string, string>>((next, serviceId) => {
      const currentTeamMemberId = form.serviceTeamMemberIds[serviceId];
      const stillAvailable = Boolean(
        currentTeamMemberId &&
        (membersByService.get(serviceId) ?? []).some((member) => member.id === currentTeamMemberId),
      );
      if (stillAvailable && currentTeamMemberId) next[serviceId] = currentTeamMemberId;
      return next;
    }, {});
    setForm({
      ...form,
      serviceIds,
      serviceTeamMemberIds: nextAssignments,
      teamMemberId: Object.values(nextAssignments)[0] ?? "",
      startsAt: "",
    });
  }

  function updateServiceTeamMember(serviceId: string, teamMemberId: string) {
    const serviceTeamMemberIds = { ...form.serviceTeamMemberIds, [serviceId]: teamMemberId };
    setForm({
      ...form,
      serviceTeamMemberIds,
      teamMemberId: form.serviceIds.map((id) => serviceTeamMemberIds[id]).find(Boolean) ?? "",
      startsAt: "",
    });
  }

  function closeDialog() {
    setEditing(null);
    setAssignToMember(null);
  }

  function openForm(booking?: BookingRecord, lockedMember?: TeamMember) {
    setView("appointment");
    setCustomerSearch("");
    setCustomerDraft(blankCustomer);
    setAssignToMember(booking ? null : (lockedMember ?? null));
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
        serviceTeamMemberIds:
          Object.keys(booking.serviceTeamMemberIds ?? {}).length > 0
            ? booking.serviceTeamMemberIds
            : Object.fromEntries(
                booking.serviceIds.map((serviceId) => [serviceId, booking.teamMemberId ?? ""]),
              ),
      });
    } else {
      setEditing("new");
      setForm({ ...blankForm, date: form.date || today() });
    }
  }

  function openDetails(booking: BookingRecord) {
    setEditing(booking);
    setView("details");
  }

  function openStartJob(booking: BookingRecord) {
    setStartOtp("");
    setStartingJob(booking);
    toast.message("Dev mode", { description: "Verification code is 123456." });
  }

  async function submitStartJob(event: FormEvent) {
    event.preventDefault();
    if (!startingJob) return;
    try {
      await startJob({ data: { salonId: salonId!, id: startingJob.id, otp: startOtp } });
      toast.success("Job started");
      setStartingJob(null);
      closeDialog();
      await queryClient.invalidateQueries({ queryKey: ["bookings", salonId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start job");
    }
  }

  function openFinishJob(booking: BookingRecord) {
    setFinishRating(0);
    setFinishComment("");
    setFinishingJob(booking);
  }

  async function submitFinishJob(event: FormEvent) {
    event.preventDefault();
    if (!finishingJob || !finishRating || !finishComment.trim()) return;
    try {
      await finishJob({
        data: {
          salonId: salonId!,
          id: finishingJob.id,
          rating: finishRating,
          comment: finishComment.trim(),
        },
      });
      toast.success("Appointment completed");
      setFinishingJob(null);
      closeDialog();
      await queryClient.invalidateQueries({ queryKey: ["bookings", salonId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not finish job");
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
          teamMemberId: primaryTeamMemberId,
          packageId: null,
          dealId: null,
          status: form.status,
          notes: "",
          serviceIds: form.serviceIds,
          serviceTeamMemberIds: form.serviceTeamMemberIds,
        },
      });
      toast.success(editing === "new" ? "Appointment booked" : "Appointment updated");
      closeDialog();
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
      closeDialog();
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
      closeDialog();
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

      <div className="mt-7 flex items-stretch gap-2 rounded-lg border border-border bg-card p-2">
        {salonClosedToday ? (
          <div className="flex-1 p-10 text-center text-muted-foreground">
            The salon is closed on the selected date.
          </div>
        ) : (
          <>
            <button
              type="button"
              aria-label="Scroll earlier"
              onClick={() => scrollTimeline(-1)}
              className="grid size-8 shrink-0 place-items-center self-center rounded-full border border-border text-muted-foreground hover:text-primary"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div ref={scrollRef} className="flex-1 overflow-x-auto">
              <div style={{ width: 220 + timelineSlots.length * SLOT_WIDTH }}>
                <div className="flex border-b border-border bg-secondary/30">
                  <div className="sticky left-0 z-10 flex w-[220px] shrink-0 items-center gap-2 border-r border-border bg-secondary p-4 font-semibold text-primary">
                    <Users className="size-4" /> Team
                  </div>
                  {timelineSlots.map((slot) => (
                    <div
                      key={slot.minutes}
                      style={{ width: SLOT_WIDTH }}
                      className="shrink-0 border-r border-border p-2 text-center text-xs text-primary last:border-r-0"
                    >
                      {slot.label}
                    </div>
                  ))}
                </div>
                {teamMembers.length ? (
                  teamMembers.map((member) => (
                    <div key={member.id} className="flex border-b border-border last:border-b-0">
                      <div className="sticky left-0 z-10 flex w-[220px] shrink-0 items-center gap-2 border-r border-border bg-card p-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold-soft text-sm font-semibold text-primary">
                          {member.fullName[0]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-primary">{member.fullName}</p>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                            Available
                          </span>
                        </div>
                        <button
                          type="button"
                          aria-label={`View ${member.fullName}`}
                          className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-primary"
                          onClick={() => setViewingMember(member)}
                        >
                          <Eye className="size-4" />
                        </button>
                      </div>
                      <div
                        className="relative"
                        style={{ width: timelineSlots.length * SLOT_WIDTH, height: ROW_HEIGHT }}
                      >
                        {timelineSlots.map((slot) => (
                          <div
                            key={slot.minutes}
                            style={{
                              left: (slot.minutes - dayStartMinutes) * (SLOT_WIDTH / SLOT_MINUTES),
                              width: SLOT_WIDTH,
                            }}
                            className="group absolute inset-y-0 flex items-center justify-center border-r border-border last:border-r-0"
                          >
                            {!todaysBookings
                              .filter((booking) => bookingTeamMemberIds(booking).includes(member.id))
                              .some((booking) => timeSlotOverlapsBooking(slot.minutes, booking)) && (
                              <button
                                type="button"
                                aria-label={`New appointment for ${member.fullName}`}
                                className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-primary/90"
                                onClick={() => openForm(undefined, member)}
                              >
                                <Plus className="size-5" strokeWidth={2.5} />
                              </button>
                            )}
                          </div>
                        ))}
                        {todaysBookings
                          .filter((booking) => bookingTeamMemberIds(booking).includes(member.id))
                          .map((booking) => (
                            <button
                              key={booking.id}
                              type="button"
                              className="absolute top-3 rounded-md border border-primary/30 bg-card px-3 py-2 text-left shadow-sm"
                              style={bookingBlockStyle(booking, dayStartMinutes)}
                              onClick={() => openDetails(booking)}
                            >
                              <span
                                className={cn(
                                  "block text-[11px] font-medium",
                                  STATUS_META[booking.status].className,
                                )}
                              >
                                {STATUS_META[booking.status].label}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {formatClock(booking.startsAt)} - {formatClock(booking.endsAt)}
                              </span>
                              <span className="block truncate text-sm font-semibold text-primary">
                                {booking.clientName}
                              </span>
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
            <button
              type="button"
              aria-label="Scroll later"
              onClick={() => scrollTimeline(1)}
              className="grid size-8 shrink-0 place-items-center self-center rounded-full border border-border text-muted-foreground hover:text-primary"
            >
              <ChevronRight className="size-4" />
            </button>
          </>
        )}
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="size-4" /> {visibleTodaysBookings.length}{" "}
        {visibleTodaysBookings.length === 1 ? "booking" : "bookings"} for today
      </p>
      <button
        type="button"
        aria-label="New appointment"
        className="fixed bottom-8 right-8 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
        onClick={() => openForm()}
      >
        <Plus className="size-8" strokeWidth={2.5} />
      </button>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[900px] overflow-y-auto rounded-lg px-10 py-9">
          {view === "details" && editing && editing !== "new" && (
            <BookingDetails
              booking={editing}
              onConfirm={() => void updateStatus(editing, "confirmed")}
              onCancel={() => void updateStatus(editing, "cancelled")}
              onNoShow={() => void updateStatus(editing, "no_show")}
              onStartJob={() => openStartJob(editing)}
              onFinishJob={() => openFinishJob(editing)}
              onEdit={() => openForm(editing)}
              onDelete={() => void handleDelete(editing)}
            />
          )}

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
                {assignToMember && (
                  <div className="flex items-center justify-between rounded-md border border-primary/30 bg-gold-soft px-3 py-2 text-sm">
                    <span>
                      Assigning to <strong>{assignToMember.fullName}</strong>
                    </span>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline"
                      onClick={() => setAssignToMember(null)}
                    >
                      Change
                    </button>
                  </div>
                )}
                <Field label="Select Services" required>
                  <BusinessServicePicker
                    label="Add Service"
                    services={
                      assignToMember
                        ? services.filter((service) =>
                            assignToMember.serviceIds.includes(service.id),
                          )
                        : services
                    }
                    value={form.serviceIds}
                    onChange={updateServices}
                    emptyText={
                      assignToMember
                        ? `${assignToMember.fullName} has no services assigned yet.`
                        : "Add services in Catalog before selecting services here."
                    }
                  />
                </Field>
                {!assignToMember && (
                  <Field label="Team Member" required>
                    <div className="space-y-3">
                      {selectedServices.length ? (
                        selectedServices.map((service) => {
                          const availableMembers = membersByService.get(service.id) ?? [];
                          return (
                            <div
                              key={service.id}
                              className="grid gap-2 rounded-md border border-border bg-card p-3 sm:grid-cols-[1fr_280px]"
                            >
                              <div>
                                <p className="font-medium text-foreground">{service.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {service.durationMins} mins
                                </p>
                              </div>
                              <Select
                                disabled={!availableMembers.length}
                                {...(form.serviceTeamMemberIds[service.id]
                                  ? { value: form.serviceTeamMemberIds[service.id] }
                                  : {})}
                                onValueChange={(teamMemberId) =>
                                  updateServiceTeamMember(service.id, teamMemberId)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={
                                      availableMembers.length
                                        ? "Select team member"
                                        : "No team member available"
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableMembers.map((member) => (
                                    <SelectItem key={member.id} value={member.id}>
                                      {member.fullName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                          Select services before assigning team members.
                        </div>
                      )}
                    </div>
                  </Field>
                )}
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
                            {formatClock(slot.startsAt)}
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

      <Dialog
        open={Boolean(viewingMember)}
        onOpenChange={(open) => !open && setViewingMember(null)}
      >
        <DialogContent className="max-w-md rounded-lg px-8 py-7">
          {viewingMember && <TeamMemberDetail member={viewingMember} />}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(startingJob)} onOpenChange={(open) => !open && setStartingJob(null)}>
        <DialogContent className="max-w-sm rounded-lg px-8 py-7">
          {startingJob && (
            <form className="space-y-5" onSubmit={(event) => void submitStartJob(event)}>
              <DialogHeader>
                <DialogTitle className="text-xl">Enter OTP</DialogTitle>
                <DialogDescription>
                  Ask {startingJob.clientName} for their verification code to start this job.
                </DialogDescription>
              </DialogHeader>
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                className="text-center text-lg tracking-[0.5em]"
                value={startOtp}
                onChange={(event) => setStartOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                autoFocus
                required
              />
              <DialogFooter className="justify-center gap-2">
                <Button
                  type="submit"
                  disabled={startOtp.length !== 6}
                  className="rounded-full px-8"
                >
                  Submit
                </Button>
                <Button type="button" variant="outline" onClick={() => setStartingJob(null)}>
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(finishingJob)} onOpenChange={(open) => !open && setFinishingJob(null)}>
        <DialogContent className="max-w-sm rounded-lg px-8 py-7">
          {finishingJob && (
            <form className="space-y-5" onSubmit={(event) => void submitFinishJob(event)}>
              <DialogHeader>
                <DialogTitle className="text-xl">Finish Job</DialogTitle>
                <DialogDescription>{finishingJob.clientName}</DialogDescription>
              </DialogHeader>
              <div>
                <Label>How was the service?</Label>
                <div className="mt-2 flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      aria-label={`${rating} star`}
                      onClick={() => setFinishRating(rating)}
                      className={cn(
                        "grid size-10 place-items-center rounded-full border text-lg",
                        rating <= finishRating
                          ? "border-primary bg-gold-soft text-primary"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {rating <= finishRating ? "★" : "☆"}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Comment">
                <textarea
                  maxLength={300}
                  rows={4}
                  placeholder="Write comment"
                  className="w-full rounded-md border border-border bg-card p-3 text-sm"
                  value={finishComment}
                  onChange={(event) => setFinishComment(event.target.value)}
                />
              </Field>
              <DialogFooter className="justify-center gap-2">
                <Button
                  type="submit"
                  disabled={!finishRating || !finishComment.trim()}
                  className="rounded-full px-8"
                >
                  Submit Review
                </Button>
                <Button type="button" variant="outline" onClick={() => setFinishingJob(null)}>
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookingDetails({
  booking,
  onConfirm,
  onCancel,
  onNoShow,
  onStartJob,
  onFinishJob,
  onEdit,
  onDelete,
}: {
  booking: BookingRecord;
  onConfirm: () => void;
  onCancel: () => void;
  onNoShow: () => void;
  onStartJob: () => void;
  onFinishJob: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[booking.status];
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const startsAt = new Date(booking.startsAt).getTime();
  const endsAt = new Date(booking.endsAt).getTime();
  const canStartJob = booking.status === "confirmed" && currentTime >= startsAt && currentTime < endsAt;
  const canMarkNoShow = booking.status === "confirmed" && currentTime >= endsAt;
  return (
    <>
      <DialogHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <DialogTitle className="text-2xl font-semibold">{booking.clientName}</DialogTitle>
            <DialogDescription>{booking.clientPhone}</DialogDescription>
          </div>
          <span
            className={cn(
              "rounded-full bg-secondary px-3 py-1 text-xs font-semibold",
              meta.className,
            )}
          >
            {meta.label}
          </span>
        </div>
      </DialogHeader>
      <div className="mt-6 space-y-3 text-sm">
        <DetailRow label="Date" value={formatDateLabel(booking.startsAt)} />
        <DetailRow
          label="Time"
          value={`${formatClock(booking.startsAt)} - ${formatClock(booking.endsAt)}`}
        />
        <DetailRow label="Team member" value={booking.teamMemberName || "Unassigned"} />
        <DetailRow label="Total" value={`₹${booking.totalAmount.toFixed(0)}`} />
        {booking.notes && <DetailRow label="Notes" value={booking.notes} />}
        <div>
          <span className="mb-2 block text-muted-foreground">Services</span>
          <div className="flex flex-wrap gap-2">
            {booking.services.map((service) => (
              <span
                key={service.id}
                className="rounded-full bg-secondary px-3 py-1 text-xs text-foreground"
              >
                {service.name}
              </span>
            ))}
          </div>
        </div>
        {booking.status === "completed" && booking.rating && (
          <div className="rounded-md border border-border bg-secondary/40 p-3">
            <span className="block text-xs text-muted-foreground">Review</span>
            <span className="mt-1 block text-primary">
              {"★".repeat(booking.rating)}
              {"☆".repeat(5 - booking.rating)}
            </span>
            {booking.reviewComment && (
              <p className="mt-1 text-sm text-foreground">{booking.reviewComment}</p>
            )}
          </div>
        )}
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {booking.status === "pending" && (
          <Button className="rounded-full px-6" onClick={onConfirm}>
            Confirm
          </Button>
        )}
        {booking.status === "confirmed" && (
          <Button
            className="rounded-full px-6"
            onClick={onStartJob}
            disabled={!canStartJob}
            title={
              currentTime < startsAt
                ? "Available at the scheduled start time"
                : "This appointment has ended"
            }
          >
            Start Job
          </Button>
        )}
        {booking.status === "confirmed" && (
          <Button
            variant="outline"
            className="rounded-full px-6"
            onClick={onNoShow}
            disabled={!canMarkNoShow}
            title="Available after the scheduled end time"
          >
            No Show
          </Button>
        )}
        {booking.status === "in_progress" && (
          <Button className="rounded-full px-6" onClick={onFinishJob}>
            Finish Job
          </Button>
        )}
        {/* Booking cancellation is intentionally disabled for now.
        {(booking.status === "pending" || booking.status === "confirmed") && (
          <Button variant="outline" className="rounded-full px-6" onClick={onCancel}>
            Cancel Booking
          </Button>
        )} */}
      </div>
      {/* Booking edit and delete controls are intentionally disabled for now.
      <div className="mt-3 flex justify-center gap-4 text-xs">
        <button type="button" className="text-muted-foreground underline" onClick={onEdit}>
          Edit details
        </button>
        <button type="button" className="text-destructive underline" onClick={onDelete}>
          Delete booking
        </button>
      </div> */}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function TeamMemberDetail({ member }: { member: TeamMember }) {
  return (
    <>
      <DialogHeader className="items-center text-center">
        <span className="grid size-14 place-items-center rounded-full bg-gold-soft text-lg font-semibold text-primary">
          {member.fullName[0]}
        </span>
        <DialogTitle className="mt-2 text-xl">{member.fullName}</DialogTitle>
        <DialogDescription>{member.roleTitle || "Team member"}</DialogDescription>
      </DialogHeader>
      <div className="mt-5 space-y-3 text-sm">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <span className="text-muted-foreground">Phone</span>
          <span className="font-medium text-foreground">{member.phone || "—"}</span>
        </div>
        <div className="flex items-center justify-between border-b border-border pb-2">
          <span className="text-muted-foreground">Email</span>
          <span className="font-medium text-foreground">{member.email || "—"}</span>
        </div>
        <div className="flex items-center justify-between border-b border-border pb-2">
          <span className="text-muted-foreground">Experience</span>
          <span className="font-medium text-foreground">{member.experienceYears} yrs</span>
        </div>
        <div>
          <span className="mb-2 block text-muted-foreground">Services</span>
          {member.services.length ? (
            <div className="flex flex-wrap gap-2">
              {member.services.map((service) => (
                <span
                  key={service.id}
                  className="rounded-full bg-secondary px-3 py-1 text-xs text-foreground"
                >
                  {service.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No services assigned</p>
          )}
        </div>
      </div>
    </>
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

function timeSlots(startMinutes: number, endMinutes: number) {
  const slots: { minutes: number; label: string }[] = [];
  for (let minutes = startMinutes; minutes < endMinutes; minutes += SLOT_MINUTES) {
    slots.push({ minutes, label: slotLabel(minutes) });
  }
  return slots;
}

function dayOfWeekForDate(date: string) {
  return (new Date(`${date}T00:00:00`).getDay() + 6) % 7;
}

function timeToMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.slice(0, 5).split(":");
  return Number(hours) * 60 + Number(minutes);
}

function slotLabel(minutes: number) {
  const hour24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 || 12;
  return mins === 0 ? `${hour} ${suffix}` : `${hour}:${String(mins).padStart(2, "0")} ${suffix}`;
}

function localInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function localDateFromIso(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatClock(value: string) {
  const date = new Date(value);
  const hour24 = date.getHours();
  const suffix = hour24 >= 12 ? "pm" : "am";
  const hour = hour24 % 12 || 12;
  return `${hour}:${String(date.getMinutes()).padStart(2, "0")} ${suffix}`;
}

function bookingTeamMemberIds(booking: BookingRecord) {
  return [
    ...new Set(
      [booking.teamMemberId, ...Object.values(booking.serviceTeamMemberIds ?? {})].filter(Boolean),
    ),
  ];
}

function bookingBlockStyle(booking: BookingRecord, dayStartMinutes: number) {
  const start = new Date(booking.startsAt);
  const end = new Date(booking.endsAt);
  const minutes = start.getHours() * 60 + start.getMinutes();
  const duration = Math.max(SLOT_MINUTES, (end.getTime() - start.getTime()) / 60000);
  const pxPerMinute = SLOT_WIDTH / SLOT_MINUTES;
  return {
    left: `${Math.max(0, (minutes - dayStartMinutes) * pxPerMinute)}px`,
    width: `${Math.max(SLOT_WIDTH, duration * pxPerMinute)}px`,
  };
}

function timeSlotOverlapsBooking(slotStartMinutes: number, booking: BookingRecord) {
  const startsAt = new Date(booking.startsAt);
  const endsAt = new Date(booking.endsAt);
  const bookingStartMinutes = startsAt.getHours() * 60 + startsAt.getMinutes();
  const bookingEndMinutes = endsAt.getHours() * 60 + endsAt.getMinutes();
  return slotStartMinutes < bookingEndMinutes && slotStartMinutes + SLOT_MINUTES > bookingStartMinutes;
}
