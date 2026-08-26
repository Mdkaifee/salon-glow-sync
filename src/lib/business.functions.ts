/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const id = z.string().uuid();
const optionalId = id.nullable().optional();
const salonIdInput = z.object({ salonId: id });
const DEV_OTP = "123456";
const OTP_TTL_MINUTES = 10;
const SLOT_STEP_MINUTES = 10;
const INVITE_TTL_DAYS = 7;

const phoneInput = z.string().trim().min(7).max(20);
const tokenInput = z.string().trim().min(12).max(120);
const nullableDate = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? null : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
);

function needsTeamProfileSetup(member: {
  gender?: string | null | undefined;
  address?: string | null | undefined;
  career_start_date?: string | null | undefined;
  careerStartDate?: string | null | undefined;
  experience_years?: number | string | null | undefined;
  experienceYears?: number | string | null | undefined;
}) {
  const careerDate = member.career_start_date ?? member.careerStartDate;
  const experience = member.experience_years ?? member.experienceYears;
  const hasExperience =
    experience !== undefined && experience !== null && Number(experience) > 0;
  const hasCareerDate = Boolean(careerDate && String(careerDate).trim());
  return (
    !member.gender ||
    member.gender === "all" ||
    !member.address?.trim() ||
    (!hasCareerDate && !hasExperience)
  );
}

async function requireCompletedTeamProfile(supabase: any, member: any, ownerId: string) {
  if (!needsTeamProfileSetup(member)) return;
  await supabase
    .from("team_members")
    .update({ setup_required: true, invitation_status: "setup_required" })
    .eq("id", member.id)
    .eq("owner_id", ownerId);
  throw new Error(
    "Complete gender, address, and career start date / experience before assigning branches or services.",
  );
}

const teamMemberInput = z.object({
  salonId: id,
  id: id.optional(),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().max(160).nullable().optional().or(z.literal("")),
  roleTitle: z.string().trim().min(2).max(80),
  roles: z.array(z.string().trim().min(2).max(80)).min(1).default(["salon_stylist"]),
  gender: z.enum(["male", "female", "other", "all"]).default("all"),
  experienceYears: z.number().min(0).max(80).default(0),
  about: z.string().trim().max(500).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  joiningDate: nullableDate,
  careerStartDate: nullableDate,
  profileImageUrl: z.string().trim().url().max(500).nullable().optional().or(z.literal("")),
  employmentType: z.enum(["full_time", "part_time", "contract"]).default("full_time"),
  payType: z
    .enum(["monthly_salary", "salary_commission", "commission_only"])
    .default("monthly_salary"),
  effectiveFrom: nullableDate,
  compensationLater: z.boolean().default(false),
  baseSalary: z.number().min(0).max(10000000).default(0),
  commissionType: z.enum(["percentage", "fixed"]).default("percentage"),
  commissionValue: z.number().min(0).max(10000000).default(0),
  notes: z.string().trim().max(500).nullable().optional(),
});

const inviteTeamMemberInput = z.object({
  salonId: id,
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(1).max(50),
  phone: phoneInput.optional().or(z.literal("")),
  email: z.string().trim().email().max(160),
  message: z.string().trim().max(200).optional().or(z.literal("")),
  appOrigin: z.string().url().optional(),
});

const serviceIdsInput = z.object({
  salonId: id,
  teamMemberId: id,
  serviceIds: z.array(id),
  onlineBookingEnabled: z.boolean().optional(),
});

const teamScheduleInput = z.object({
  salonId: id,
  teamMemberId: id,
  hours: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        isWorking: z.boolean(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    )
    .length(7),
});

const branchIdsInput = z.object({
  salonId: id,
  teamMemberId: id,
  branchIds: z.array(id),
});

const packageInput = z
  .object({
    salonId: id,
    id: id.optional(),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).nullable().optional(),
    pricingOption: z.enum(["discount", "fixed"]).default("fixed"),
    originalPrice: z.number().min(0).max(10000000).default(0),
    packagePrice: z.number().min(0).max(10000000),
    discountType: z.enum(["percentage", "fixed"]).default("percentage"),
    discountValue: z.number().min(0).max(10000000).default(0),
    maxDiscountAmount: z.number().min(0).max(10000000).nullable().optional(),
    terms: z.string().trim().max(50).nullable().optional(),
    durationCount: z.number().int().min(1).max(3650).default(1),
    durationUnit: z.enum(["day", "week", "month", "year"]).default("month"),
    gender: z.enum(["male", "female", "other", "all"]).default("all"),
    validityDays: z.number().int().min(1).max(3650).default(90),
    serviceIds: z.array(id).min(1),
  })
  .superRefine((value, ctx) => {
    if (value.discountType === "percentage" && value.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountValue"],
        message: "Percentage discounts cannot exceed 100.",
      });
    }
  });

const dealInput = z
  .object({
    salonId: id,
    id: id.optional(),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).nullable().optional(),
    pricingOption: z.enum(["discount", "fixed"]).default("discount"),
    originalPrice: z.number().min(0).max(10000000).default(0),
    offeredPrice: z.number().min(0).max(10000000).default(0),
    discountType: z.enum(["percentage", "fixed"]),
    discountValue: z.number().min(0).max(10000000),
    maxDiscountAmount: z.number().min(0).max(10000000).nullable().optional(),
    terms: z.string().trim().max(50).nullable().optional(),
    durationCount: z.number().int().min(1).max(3650).default(1),
    durationUnit: z.enum(["day", "week", "month", "year"]).default("month"),
    gender: z.enum(["male", "female", "other", "all"]).default("all"),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    serviceIds: z.array(id).min(1),
  })
  .superRefine((value, ctx) => {
    if (value.discountType === "percentage" && value.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountValue"],
        message: "Percentage discounts cannot exceed 100.",
      });
    }
    if (value.endsOn < value.startsOn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsOn"],
        message: "End date must be on or after the start date.",
      });
    }
  });

const bookingStatus = z.enum([
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
]);
const bookingInput = z.object({
  salonId: id,
  id: id.optional(),
  customerId: optionalId,
  clientName: z.string().trim().min(2).max(120),
  clientPhone: z.string().trim().min(5).max(30),
  startsAt: z.string().datetime(),
  teamMemberId: optionalId,
  packageId: optionalId,
  dealId: optionalId,
  status: bookingStatus.default("pending"),
  notes: z.string().trim().max(500).nullable().optional(),
  serviceIds: z.array(id).min(1),
  serviceTeamMemberIds: z.record(id, id).optional().default({}),
});

const customerInput = z.object({
  salonId: id,
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(1).max(50),
  phone: phoneInput,
});

const customerOtpInput = z.object({
  salonId: id,
  phone: phoneInput,
});

const startJobInput = z.object({
  salonId: id,
  id,
  otp: z.string().trim().length(6),
});

const completeJobInput = z.object({
  salonId: id,
  id,
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(500),
});

const verifyCustomerOtpInput = customerInput.extend({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});

const teamInviteOtpInput = z.object({
  token: tokenInput,
  phone: phoneInput,
});

const verifyTeamInviteOtpInput = teamInviteOtpInput.extend({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});

const slotInput = z.object({
  salonId: id,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  teamMemberId: id.optional(),
  serviceIds: z.array(id).min(1),
  serviceTeamMemberIds: z.record(id, id).optional().default({}),
  bookingId: id.optional(),
});

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizePhone(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  return `+${digits}`;
}

function fullName(firstName: string, lastName: string) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function minutesToTime(totalMinutes: number) {
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(
    totalMinutes % 60,
  ).padStart(2, "0")}`;
}

function timeToMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.slice(0, 5).split(":");
  return Number(hours) * 60 + Number(minutes);
}

// This app currently serves India-based salons only, so booking wall-clock
// time is fixed to IST (UTC+5:30) rather than derived from the server
// runtime's timezone, which is unreliable (e.g. Cloudflare Workers runs UTC
// regardless of where the request originated).
const SALON_UTC_OFFSET_MINUTES = 330;

function toSalonLocalShifted(instant: Date) {
  return new Date(instant.getTime() + SALON_UTC_OFFSET_MINUTES * 60_000);
}

function salonLocalDateKey(instant: Date) {
  const shifted = toSalonLocalShifted(instant);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function salonLocalMinutes(instant: Date) {
  const shifted = toSalonLocalShifted(instant);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

// Inverse of toSalonLocalShifted: given a salon-local (IST) date and minutes
// since midnight, returns the true UTC instant in milliseconds. Used to
// compare candidate booking segments against stored booking instants
// (which are correct UTC), without depending on the server runtime's
// notion of "local" time.
function salonLocalToUtcMs(date: string, minutes: number) {
  const parts = date.split("-").map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return Date.UTC(year, month - 1, day, hours, mins, 0) - SALON_UTC_OFFSET_MINUTES * 60_000;
}

function formatSlotLabel(startsAt: string, durationMins: number) {
  const date = new Date(startsAt);
  const end = new Date(date.getTime() + durationMins * 60_000);
  const formatter = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });
  return `${formatter.format(date)} - ${formatter.format(end)}`;
}

function localDateTime(date: string, minutes: number) {
  return `${date}T${minutesToTime(minutes)}`;
}

function isoFromLocal(date: string, minutes: number) {
  return new Date(`${localDateTime(date, minutes)}:00`).toISOString();
}

function dayOfWeekForDate(date: string) {
  return (new Date(`${date}T00:00:00`).getDay() + 6) % 7;
}

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

async function requireSalonAccess(supabase: any, salonId: string) {
  const { data, error } = await supabase
    .from("salons")
    .select("id, name")
    .eq("id", salonId)
    .single();
  if (error || !data) throw new Error("Could not access this salon.");
  return data;
}

function timeRangeOverlaps(startA: string, endA: string, startB: string, endB: string) {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(endA) > timeToMinutes(startB);
}

async function assertNoTeamScheduleConflicts(
  supabase: any,
  teamMemberId: string,
  salonId: string,
  hours: Array<{ dayOfWeek: number; isWorking: boolean; startTime: string; endTime: string }>,
) {
  const workingHours = hours.filter((hour) => hour.isWorking);
  if (!workingHours.length) return;
  const { data: existingHours, error } = await supabase
    .from("team_member_hours")
    .select("salon_id, day_of_week, is_working, start_time, end_time, salons(name)")
    .eq("team_member_id", teamMemberId)
    .neq("salon_id", salonId)
    .eq("is_working", true);
  if (error) throw new Error("Could not verify schedule conflicts.");
  const conflict = workingHours
    .map((hour) => {
      const overlapping = (existingHours ?? []).find(
        (existing: any) =>
          existing.day_of_week === hour.dayOfWeek &&
          timeRangeOverlaps(
            hour.startTime,
            hour.endTime,
            String(existing.start_time).slice(0, 5),
            String(existing.end_time).slice(0, 5),
          ),
      );
      return overlapping ? { hour, overlapping } : null;
    })
    .find(Boolean);
  if (conflict) {
    const branchName = conflict.overlapping.salons?.name ?? "another branch";
    throw new Error(
      `Schedule conflicts with ${branchName} on ${dayNames[conflict.hour.dayOfWeek]} (${conflict.hour.startTime}-${conflict.hour.endTime}).`,
    );
  }
}

function appOrigin(inputOrigin?: string) {
  return (
    process.env["PUBLIC_APP_URL"] ??
    process.env["APP_ORIGIN"] ??
    process.env["SITE_URL"] ??
    inputOrigin ??
    ""
  ).replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

async function sendTeamInviteEmail({
  to,
  firstName,
  salonName,
  inviteUrl,
  message,
  expiresAt,
}: {
  to: string;
  firstName: string;
  salonName: string;
  inviteUrl: string;
  message: string | null;
  expiresAt: string;
}) {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM_EMAIL"];
  if (!apiKey || !from) {
    throw new Error(
      "Configure RESEND_API_KEY and RESEND_FROM_EMAIL in Lovable to send invitation emails.",
    );
  }

  const expiry = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(expiresAt));
  const safeFirstName = escapeHtml(firstName);
  const safeSalonName = escapeHtml(salonName);
  const safeMessage = message ? escapeHtml(message) : null;
  const safeInviteUrl = escapeHtml(inviteUrl);
  const safeExpiry = escapeHtml(expiry);
  const text = [
    `Hi ${firstName},`,
    "",
    `You have been invited to join ${salonName} on Glowante.`,
    message ? `Message from salon: ${message}` : "",
    `Verify your mobile number here: ${inviteUrl}`,
    `This invitation expires on ${expiry}.`,
  ]
    .filter(Boolean)
    .join("\n");
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#1f2937">
      <h2 style="color:#7c5a0a">Join ${safeSalonName} on Glowante</h2>
      <p>Hi ${safeFirstName},</p>
      <p>You have been invited as a team member. Verify your mobile number to continue setup.</p>
      ${safeMessage ? `<p><strong>Message from salon:</strong> ${safeMessage}</p>` : ""}
      <p><a href="${safeInviteUrl}" style="display:inline-block;background:#7c5a0a;color:#ffffff;padding:12px 18px;border-radius:999px;text-decoration:none">Verify Team Member</a></p>
      <p style="font-size:13px;color:#6b7280">This invitation expires on ${safeExpiry}.</p>
    </div>
  `;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: `Verify your team invitation for ${salonName}`,
      text,
      html,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || "Could not send the team invitation email.");
  }
}

async function loadServices(supabase: any, salonId: string, serviceIds: string[]) {
  if (!serviceIds.length) return [];
  const { data, error } = await supabase
    .from("salon_services")
    .select("id, name, price, duration_mins")
    .eq("salon_id", salonId)
    .in("id", serviceIds);
  if (error) throw new Error("Could not verify the selected services.");
  if ((data ?? []).length !== serviceIds.length)
    throw new Error("One or more selected services do not belong to this branch.");
  return data ?? [];
}

function buildBookingAssignments(
  services: any[],
  serviceIds: string[],
  serviceTeamMemberIds: Record<string, string>,
  fallbackTeamMemberId?: string | null,
) {
  const serviceById = new Map(services.map((service) => [service.id, service]));
  return serviceIds.map((serviceId) => {
    const service = serviceById.get(serviceId);
    const teamMemberId = serviceTeamMemberIds[serviceId] ?? fallbackTeamMemberId ?? null;
    if (!service) throw new Error("One or more selected services do not belong to this branch.");
    if (!teamMemberId) throw new Error("Select a team member for every selected service.");
    return {
      serviceId,
      teamMemberId,
      durationMins: Math.max(Number(service.duration_mins ?? 0), 15),
      price: Number(service.price ?? 0),
    };
  });
}

async function loadBusyBookingsForTeamMembers(
  supabase: any,
  salonId: string,
  date: string,
  teamMemberIds: string[],
  bookingId?: string,
) {
  const uniqueTeamMemberIds = [...new Set(teamMemberIds)];
  if (!uniqueTeamMemberIds.length)
    return new Map<string, Array<{ startsAt: number; endsAt: number }>>();
  const dayStart = new Date(salonLocalToUtcMs(date, 0)).toISOString();
  const dayEnd = new Date(salonLocalToUtcMs(date, 24 * 60)).toISOString();
  const [
    { data: primaryBookings, error: primaryError },
    { data: serviceLinks, error: linksError },
  ] = await Promise.all([
    supabase
      .from("salon_bookings")
      .select("id, team_member_id, starts_at, ends_at, status")
      .eq("salon_id", salonId)
      .in("team_member_id", uniqueTeamMemberIds)
      .gte("starts_at", dayStart)
      .lt("starts_at", dayEnd),
    supabase
      .from("salon_booking_services")
      .select("booking_id, team_member_id")
      .in("team_member_id", uniqueTeamMemberIds),
  ]);
  if (primaryError || linksError) throw new Error("Could not verify team availability.");

  const linkedBookingIds = [
    ...new Set((serviceLinks ?? []).map((link: any) => link.booking_id).filter(Boolean)),
  ];
  const linkedBookings = linkedBookingIds.length
    ? await supabase
        .from("salon_bookings")
        .select("id, starts_at, ends_at, status")
        .eq("salon_id", salonId)
        .in("id", linkedBookingIds)
        .gte("starts_at", dayStart)
        .lt("starts_at", dayEnd)
    : { data: [], error: null };
  if (linkedBookings.error) throw new Error("Could not verify team availability.");

  const busy = new Map<string, Array<{ startsAt: number; endsAt: number }>>();
  const addBusy = (teamMemberId: string, booking: any) => {
    if (!teamMemberId || booking.id === bookingId) return;
    if (["cancelled", "no_show"].includes(booking.status)) return;
    const existing = busy.get(teamMemberId) ?? [];
    existing.push({
      startsAt: new Date(booking.starts_at).getTime(),
      endsAt: new Date(booking.ends_at).getTime(),
    });
    busy.set(teamMemberId, existing);
  };

  for (const booking of primaryBookings ?? []) {
    addBusy(booking.team_member_id, booking);
  }
  const linkedBookingById = new Map(
    (linkedBookings.data ?? []).map((booking: any) => [booking.id, booking]),
  );
  for (const link of serviceLinks ?? []) {
    const booking = linkedBookingById.get(link.booking_id);
    if (booking) addBusy(link.team_member_id, booking);
  }
  return busy;
}

async function loadBookingTeamConstraints(
  supabase: any,
  userId: string,
  salonId: string,
  date: string,
  assignments: Array<{ serviceId: string; teamMemberId: string }>,
  bookingId?: string,
) {
  const teamMemberIds = [...new Set(assignments.map((assignment) => assignment.teamMemberId))];
  const serviceIds = [...new Set(assignments.map((assignment) => assignment.serviceId))];
  const dayOfWeek = dayOfWeekForDate(date);
  const [
    { data: branchHours, error: branchError },
    { data: members, error: membersError },
    { data: branchAssignments, error: branchAssignmentsError },
    { data: serviceAssignments, error: serviceAssignmentsError },
    { data: teamHours, error: teamHoursError },
  ] = await Promise.all([
    supabase
      .from("salon_hours")
      .select("is_open, open_time, close_time")
      .eq("salon_id", salonId)
      .eq("day_of_week", dayOfWeek)
      .maybeSingle(),
    supabase
      .from("team_members")
      .select("id, is_active, online_booking_enabled")
      .eq("owner_id", userId)
      .in("id", teamMemberIds),
    supabase
      .from("team_member_branches")
      .select("team_member_id")
      .eq("salon_id", salonId)
      .in("team_member_id", teamMemberIds),
    supabase
      .from("team_member_services")
      .select("team_member_id, salon_service_id")
      .in("team_member_id", teamMemberIds)
      .in("salon_service_id", serviceIds),
    supabase
      .from("team_member_hours")
      .select("team_member_id, is_working, start_time, end_time")
      .eq("salon_id", salonId)
      .eq("day_of_week", dayOfWeek)
      .in("team_member_id", teamMemberIds),
  ]);
  if (branchError) throw new Error("Could not verify salon working hours.");
  if (membersError) throw new Error("Could not verify team members.");
  if (branchAssignmentsError) throw new Error("Could not verify branch assignments.");
  if (serviceAssignmentsError) throw new Error("Could not verify team service assignments.");
  if (teamHoursError) throw new Error("Could not verify team member working hours.");
  if (!branchHours?.is_open) throw new Error("The salon is closed on the selected date.");

  const memberById = new Map((members ?? []).map((member: any) => [member.id, member]));
  const branchAssigned = new Set((branchAssignments ?? []).map((row: any) => row.team_member_id));
  const serviceAssigned = new Set(
    (serviceAssignments ?? []).map((row: any) => `${row.team_member_id}:${row.salon_service_id}`),
  );
  const teamHoursByMember = new Map((teamHours ?? []).map((row: any) => [row.team_member_id, row]));

  for (const assignment of assignments) {
    const member = memberById.get(assignment.teamMemberId) as any;
    if (!member?.is_active || member.online_booking_enabled === false) {
      throw new Error("One selected team member is not available for booking.");
    }
    if (!branchAssigned.has(assignment.teamMemberId)) {
      throw new Error("One selected team member is not assigned to this branch.");
    }
    if (!serviceAssigned.has(`${assignment.teamMemberId}:${assignment.serviceId}`)) {
      throw new Error("One selected team member is not assigned to their selected service.");
    }
  }

  return {
    branchHours,
    busyByTeamMember: await loadBusyBookingsForTeamMembers(
      supabase,
      salonId,
      date,
      teamMemberIds,
      bookingId,
    ),
    hoursFor(teamMemberId: string) {
      const override = teamHoursByMember.get(teamMemberId) as any;
      return override
        ? {
            is_open: override.is_working,
            open_time: override.start_time,
            close_time: override.end_time,
          }
        : branchHours;
    },
  };
}

function validateBookingAssignmentSegments(
  assignments: Array<{ teamMemberId: string; durationMins: number }>,
  date: string,
  startsAtMinutes: number,
  constraints: Awaited<ReturnType<typeof loadBookingTeamConstraints>>,
) {
  let offset = 0;
  for (const assignment of assignments) {
    const segmentStart = startsAtMinutes + offset;
    const segmentEnd = segmentStart + assignment.durationMins;
    const hours = constraints.hoursFor(assignment.teamMemberId);
    if (
      !hours?.is_open ||
      segmentStart < timeToMinutes(hours.open_time) ||
      segmentEnd > timeToMinutes(hours.close_time)
    ) {
      throw new Error("Selected slot is outside one team member's working hours.");
    }
    const segmentStartMs = salonLocalToUtcMs(date, segmentStart);
    const segmentEndMs = salonLocalToUtcMs(date, segmentEnd);
    const overlaps = (constraints.busyByTeamMember.get(assignment.teamMemberId) ?? []).some(
      (booking) => segmentStartMs < booking.endsAt && segmentEndMs > booking.startsAt,
    );
    if (overlaps) throw new Error("This slot is no longer available for one selected team member.");
    offset += assignment.durationMins;
  }
}

async function replaceLinks(
  supabase: any,
  table: string,
  parentColumn: string,
  parentId: string,
  serviceIds: string[],
) {
  const { error: deleteError } = await supabase.from(table).delete().eq(parentColumn, parentId);
  if (deleteError) throw new Error("Could not reset existing service assignments.");
  if (!serviceIds.length) return;
  const { error } = await supabase
    .from(table)
    .insert(
      serviceIds.map((serviceId) => ({ [parentColumn]: parentId, salon_service_id: serviceId })),
    );
  if (error) throw new Error("Could not save service assignments.");
}

async function replaceTeamBranches(supabase: any, teamMemberId: string, branchIds: string[]) {
  const { error: deleteError } = await supabase
    .from("team_member_branches")
    .delete()
    .eq("team_member_id", teamMemberId);
  if (deleteError) throw new Error("Could not reset branch assignments.");
  if (!branchIds.length) return;
  const { error } = await supabase
    .from("team_member_branches")
    .insert(branchIds.map((salonId) => ({ team_member_id: teamMemberId, salon_id: salonId })));
  if (error) throw new Error("Could not save branch assignments.");
}

export const listTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => salonIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { data: branchAssignments, error: branchError } = await (context.supabase as any)
      .from("team_member_branches")
      .select("team_member_id")
      .eq("salon_id", data.salonId);
    if (branchError) throw new Error("Could not load team branch assignments.");
    const memberIds = Array.from(
      new Set((branchAssignments ?? []).map((row: any) => row.team_member_id).filter(Boolean)),
    );
    if (!memberIds.length) return [];

    const { data: members, error } = await (context.supabase as any)
      .from("team_members")
      .select(
        "id, user_id, first_name, last_name, full_name, phone, email, role_title, roles, gender, experience_years, about, address, joining_date, career_start_date, profile_image_url, employment_type, pay_type, effective_from, compensation_later, base_salary, commission_type, commission_value, notes, is_active, invitation_status, setup_required, source, invited_at, verified_at, online_booking_enabled, created_at",
      )
      .eq("owner_id", context.userId)
      .in("id", memberIds)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load team members.");
    const [branchRows, serviceRows, invitationRows] = await Promise.all([
      (context.supabase as any)
        .from("team_member_branches")
        .select("team_member_id, salon_id, salons(id, name, parent_id)")
        .in("team_member_id", memberIds),
      (context.supabase as any)
        .from("team_member_services")
        .select(
          "team_member_id, salon_service_id, salon_services(id, name, price, duration_mins, salon_categories(name), salon_subcategories(name), service_subcategories(name))",
        )
        .in("team_member_id", memberIds),
      (context.supabase as any)
        .from("team_member_invitations")
        .select("team_member_id, token, status, expires_at")
        .in("team_member_id", memberIds)
        .eq("status", "invited")
        .order("created_at", { ascending: false }),
    ]);
    if (branchRows.error || serviceRows.error) throw new Error("Could not load team assignments.");
    return (members ?? []).map((member: any) => ({
      id: member.id,
      userId: member.user_id,
      firstName: member.first_name,
      lastName: member.last_name,
      fullName: member.full_name,
      phone: member.phone,
      email: member.email,
      roleTitle: member.role_title,
      roles: member.roles ?? ["salon_stylist"],
      gender: member.gender ?? "all",
      experienceYears: Number(member.experience_years ?? 0),
      about: member.about,
      address: member.address,
      joiningDate: member.joining_date,
      careerStartDate: member.career_start_date,
      profileImageUrl: member.profile_image_url,
      employmentType: member.employment_type,
      payType: member.pay_type ?? "monthly_salary",
      effectiveFrom: member.effective_from,
      compensationLater: Boolean(member.compensation_later),
      baseSalary: Number(member.base_salary ?? 0),
      commissionType: member.commission_type,
      commissionValue: Number(member.commission_value ?? 0),
      notes: member.notes,
      isActive: Boolean(member.is_active),
      invitationStatus:
        member.invitation_status === "invited"
          ? "invited"
          : Boolean(member.setup_required) || needsTeamProfileSetup(member)
            ? "setup_required"
            : "active",
      setupRequired: Boolean(member.setup_required) || needsTeamProfileSetup(member),
      source: member.source ?? "manual",
      createdAt: member.created_at ?? null,
      invitedAt: member.invited_at,
      inviteToken:
        (invitationRows.data ?? []).find((inv: any) => inv.team_member_id === member.id)?.token ??
        null,
      expiresAt:
        (invitationRows.data ?? []).find((inv: any) => inv.team_member_id === member.id)
          ?.expires_at ?? null,
      verifiedAt: member.verified_at,
      onlineBookingEnabled: member.online_booking_enabled ?? true,
      branchIds: (branchRows.data ?? [])
        .filter((row: any) => row.team_member_id === member.id)
        .map((row: any) => row.salon_id),
      branches: (branchRows.data ?? [])
        .filter((row: any) => row.team_member_id === member.id)
        .map((row: any) => row.salons)
        .filter(Boolean),
      serviceIds: (serviceRows.data ?? [])
        .filter((row: any) => row.team_member_id === member.id)
        .map((row: any) => row.salon_service_id),
      services: (serviceRows.data ?? [])
        .filter((row: any) => row.team_member_id === member.id && row.salon_services)
        .map((row: any) => {
          const s = row.salon_services;
          return {
            id: s.id,
            name: s.name,
            price: Number(s.price ?? 0),
            durationMins: Number(s.duration_mins ?? 30),
            categoryName: s.salon_categories?.name ?? "Services",
            subcategoryName:
              s.salon_subcategories?.name ?? s.service_subcategories?.name ?? "Services",
          };
        }),
    }));
  });

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inviteTeamMemberInput.parse(input))
  .handler(async ({ data, context }) => {
    const salon = await requireSalonAccess(context.supabase as any, data.salonId);
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const phone = data.phone ? normalizePhone(data.phone) : null;
    const origin = appOrigin(data.appOrigin);
    if (!origin) throw new Error("Could not determine the app URL for the invitation email.");
    const inviteUrl = `${origin}/team-invite?token=${encodeURIComponent(token)}`;
    const row = {
      owner_id: context.userId,
      first_name: data.firstName,
      last_name: data.lastName,
      full_name: fullName(data.firstName, data.lastName),
      phone,
      email: data.email,
      role_title: "Stylist",
      employment_type: "full_time",
      base_salary: 0,
      commission_type: "percentage",
      commission_value: 5,
      notes: cleanText(data.message),
      is_active: false,
      invitation_status: "invited",
      setup_required: true,
      source: "invite",
      invited_at: new Date().toISOString(),
    };
    const memberResult = await (context.supabase as any)
      .from("team_members")
      .insert(row)
      .select("id")
      .single();
    if (memberResult.error || !memberResult.data)
      throw new Error("Could not create the team invitation.");
    await replaceTeamBranches(context.supabase as any, memberResult.data.id, [data.salonId]);
    const invitationResult = await (context.supabase as any)
      .from("team_member_invitations")
      .insert({
        team_member_id: memberResult.data.id,
        salon_id: data.salonId,
        owner_id: context.userId,
        first_name: data.firstName,
        last_name: data.lastName,
        phone,
        email: data.email,
        message: cleanText(data.message),
        token,
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (invitationResult.error || !invitationResult.data) {
      await (context.supabase as any).from("team_members").delete().eq("id", memberResult.data.id);
      throw new Error("Could not save the invitation.");
    }

    let emailSent = false;
    let emailError: string | null = null;
    try {
      await sendTeamInviteEmail({
        to: data.email,
        firstName: data.firstName,
        salonName: salon.name,
        inviteUrl,
        message: cleanText(data.message),
        expiresAt,
      });
      emailSent = true;
    } catch (error) {
      emailError = error instanceof Error ? error.message : "Could not send invitation email";
      console.warn("Team invitation created, but email could not be sent:", emailError);
    }

    return {
      sentTo: data.email,
      expiresAt,
      token,
      inviteUrl,
      emailSent,
      emailError,
    };
  });

export const getTeamInvitation = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ token: tokenInput }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invitation, error } = await (supabaseAdmin as any)
      .from("team_member_invitations")
      .select("id, first_name, last_name, phone, email, status, expires_at, salons(name)")
      .eq("token", data.token)
      .maybeSingle();
    if (error || !invitation) throw new Error("This invitation link is invalid.");
    return {
      firstName: invitation.first_name,
      lastName: invitation.last_name,
      phone: invitation.phone,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expires_at,
      salonName: invitation.salons?.name ?? "Glowante salon",
      expired: new Date(invitation.expires_at).getTime() < Date.now(),
    };
  });

export const requestTeamInviteOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => teamInviteOtpInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invitation, error } = await (supabaseAdmin as any)
      .from("team_member_invitations")
      .select("id, status, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (error || !invitation) throw new Error("This invitation link is invalid.");
    if (invitation.status !== "invited") throw new Error("This invitation has already been used.");
    if (new Date(invitation.expires_at).getTime() < Date.now())
      throw new Error("This invitation has expired.");
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();
    const { error: otpError } = await (supabaseAdmin as any).from("team_invite_otps").insert({
      invitation_id: invitation.id,
      phone: normalizePhone(data.phone),
      code: DEV_OTP,
      expires_at: expiresAt,
    });
    if (otpError) throw new Error("Could not send team verification OTP.");
    return { expiresAt, ttlMinutes: OTP_TTL_MINUTES };
  });

export const verifyTeamInviteOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => verifyTeamInviteOtpInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = normalizePhone(data.phone);
    const { data: invitation, error } = await (supabaseAdmin as any)
      .from("team_member_invitations")
      .select("id, team_member_id, status, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (error || !invitation) throw new Error("This invitation link is invalid.");
    if (invitation.status !== "invited") throw new Error("This invitation has already been used.");
    if (new Date(invitation.expires_at).getTime() < Date.now())
      throw new Error("This invitation has expired.");
    const { data: otp } = await (supabaseAdmin as any)
      .from("team_invite_otps")
      .select("id, code, expires_at, consumed_at")
      .eq("invitation_id", invitation.id)
      .eq("phone", phone)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!otp) throw new Error("No active OTP. Please request a new one.");
    if (new Date(otp.expires_at).getTime() < Date.now()) throw new Error("This OTP has expired.");
    if (otp.code !== data.code) throw new Error("Incorrect OTP.");
    const now = new Date().toISOString();
    await (supabaseAdmin as any).from("team_invite_otps").update({ consumed_at: now }).eq("id", otp.id);
    await (supabaseAdmin as any)
      .from("team_member_invitations")
      .update({ status: "verified", verified_at: now, phone })
      .eq("id", invitation.id);
    await (supabaseAdmin as any)
      .from("team_members")
      .update({
        phone,
        verified_at: now,
        invitation_status: "setup_required",
        setup_required: true,
        is_active: true,
      })
      .eq("id", invitation.team_member_id);
    return { ok: true };
  });

export const saveTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => teamMemberInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const profileNeedsSetup = needsTeamProfileSetup(data);
    const row: any = {
      owner_id: context.userId,
      full_name: data.fullName,
      phone: data.phone ? normalizePhone(data.phone) : null,
      email: cleanText(data.email),
      role_title: data.roleTitle,
      roles: data.roles,
      gender: data.gender,
      experience_years: data.experienceYears,
      about: cleanText(data.about),
      address: cleanText(data.address),
      joining_date: data.joiningDate || null,
      career_start_date: data.careerStartDate || null,
      profile_image_url: cleanText(data.profileImageUrl),
      employment_type: data.employmentType,
      pay_type: data.payType,
      effective_from: data.effectiveFrom || null,
      compensation_later: data.compensationLater,
      base_salary: data.baseSalary,
      commission_type: data.commissionType,
      commission_value: data.commissionValue,
      notes: cleanText(data.notes),
      setup_required: profileNeedsSetup,
      invitation_status: profileNeedsSetup ? "setup_required" : "active",
    };
    if (!data.id) {
      row.source = "manual";
      row.is_active = !profileNeedsSetup;
    } else if (!profileNeedsSetup) {
      row.is_active = true;
    }
    const result = data.id
      ? await (context.supabase as any)
          .from("team_members")
          .update(row)
          .eq("id", data.id)
          .eq("owner_id", context.userId)
          .select("id")
          .single()
      : await (context.supabase as any).from("team_members").insert(row).select("id").single();
    if (result.error || !result.data)
      throw new Error(data.id ? "Could not update team member." : "Could not add team member.");
    if (!data.id)
      await replaceTeamBranches(context.supabase as any, result.data.id, [data.salonId]);
    return { id: result.data.id };
  });

export const setTeamMemberActiveStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ salonId: id, id, isActive: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { data: member, error: memberError } = await (context.supabase as any)
      .from("team_members")
      .select("id, invitation_status, gender, address, career_start_date")
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .single();
    if (memberError || !member) throw new Error("Could not find this team member.");
    if (member.invitation_status === "invited") {
      throw new Error("Team member must verify the invitation before status changes.");
    }
    const { error } = await (context.supabase as any)
      .from("team_members")
      .update({ is_active: data.isActive })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error("Could not update team member status.");
    return { ok: true };
  });

export const deleteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ salonId: id, id }).parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { error } = await (context.supabase as any)
      .from("team_members")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error("Could not delete team member.");
    return { ok: true };
  });

export const cancelTeamInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ salonId: id, id }).parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    await (context.supabase as any)
      .from("team_member_invitations")
      .delete()
      .eq("team_member_id", data.id)
      .eq("owner_id", context.userId);
    const { error } = await (context.supabase as any)
      .from("team_members")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .eq("invitation_status", "invited");
    if (error) throw new Error("Could not cancel team invitation.");
    return { ok: true };
  });

export const assignTeamMemberServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => serviceIdsInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    await loadServices(context.supabase as any, data.salonId, data.serviceIds);
    const { data: member, error } = await (context.supabase as any)
      .from("team_members")
      .select("id, invitation_status, gender, address, career_start_date, experience_years")
      .eq("id", data.teamMemberId)
      .eq("owner_id", context.userId)
      .single();
    if (error || !member) throw new Error("Could not find this team member.");
    if (member.invitation_status === "invited") {
      throw new Error("Team member must verify the invitation before assignment.");
    }
    await requireCompletedTeamProfile(context.supabase as any, member, context.userId);
    const { data: branchServices, error: branchServicesError } = await (context.supabase as any)
      .from("salon_services")
      .select("id")
      .eq("salon_id", data.salonId);
    if (branchServicesError) throw new Error("Could not load this branch's services.");
    const branchServiceIds = (branchServices ?? []).map((service: any) => service.id);
    if (branchServiceIds.length) {
      const { error: deleteError } = await (context.supabase as any)
        .from("team_member_services")
        .delete()
        .eq("team_member_id", data.teamMemberId)
        .in("salon_service_id", branchServiceIds);
      if (deleteError) throw new Error("Could not reset service assignments.");
    }
    if (data.serviceIds.length) {
      const { error: insertError } = await (context.supabase as any)
        .from("team_member_services")
        .insert(
          data.serviceIds.map((serviceId) => ({
            team_member_id: data.teamMemberId,
            salon_service_id: serviceId,
          })),
        );
      if (insertError) throw new Error("Could not save service assignments.");
    }
    await (context.supabase as any)
      .from("team_members")
      .update({
        setup_required: false,
        invitation_status: "active",
        is_active: true,
        online_booking_enabled: data.onlineBookingEnabled ?? true,
      })
      .eq("id", data.teamMemberId)
      .eq("owner_id", context.userId);
    return { ok: true };
  });

export const assignTeamMemberBranches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => branchIdsInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { data: member, error: memberError } = await (context.supabase as any)
      .from("team_members")
      .select("id, invitation_status, gender, address, career_start_date, experience_years")
      .eq("id", data.teamMemberId)
      .eq("owner_id", context.userId)
      .single();
    if (memberError || !member) throw new Error("Could not find this team member.");
    if (member.invitation_status === "invited") {
      throw new Error("Team member must verify the invitation before assignment.");
    }
    await requireCompletedTeamProfile(context.supabase as any, member, context.userId);
    if (data.branchIds.length) {
      const { data: salons, error } = await (context.supabase as any)
        .from("salons")
        .select("id")
        .in("id", data.branchIds);
      if (error || (salons ?? []).length !== data.branchIds.length)
        throw new Error("One or more selected branches are not available.");
    }
    await replaceTeamBranches(context.supabase as any, data.teamMemberId, data.branchIds);
    return { ok: true };
  });

export const listTeamMemberSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ salonId: id, teamMemberId: id.optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    if (data.teamMemberId) {
      const { data: member, error: memberError } = await (context.supabase as any)
        .from("team_members")
        .select("id")
        .eq("id", data.teamMemberId)
        .eq("owner_id", context.userId)
        .single();
      if (memberError || !member) throw new Error("Could not find this team member.");
    }
    const [{ data: salonHours, error: salonError }, { data: memberHours, error: memberError }] =
      await Promise.all([
        (context.supabase as any)
          .from("salon_hours")
          .select("day_of_week, is_open, open_time, close_time")
          .eq("salon_id", data.salonId),
        data.teamMemberId
          ? (context.supabase as any)
              .from("team_member_hours")
              .select("day_of_week, is_working, start_time, end_time")
              .eq("team_member_id", data.teamMemberId)
              .eq("salon_id", data.salonId)
          : { data: [], error: null },
      ]);
    if (salonError) throw new Error("Could not load branch schedule.");
    if (memberError) throw new Error("Could not load team member schedule.");
    return Array.from({ length: 7 }, (_, dayOfWeek) => {
      const override = (memberHours ?? []).find((row: any) => row.day_of_week === dayOfWeek);
      const branch = (salonHours ?? []).find((row: any) => row.day_of_week === dayOfWeek);
      return {
        dayOfWeek,
        isWorking: override ? override.is_working : Boolean(branch?.is_open),
        startTime: String(override?.start_time ?? branch?.open_time ?? "08:00").slice(0, 5),
        endTime: String(override?.end_time ?? branch?.close_time ?? "20:00").slice(0, 5),
        source: override ? "team" : "branch",
      };
    });
  });

export const saveTeamMemberSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => teamScheduleInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const invalid = data.hours.find((hour) => hour.isWorking && hour.startTime >= hour.endTime);
    if (invalid) throw new Error("Each working day needs an end time after the start time.");
    const { data: member, error: memberError } = await (context.supabase as any)
      .from("team_members")
      .select("id, invitation_status")
      .eq("id", data.teamMemberId)
      .eq("owner_id", context.userId)
      .single();
    if (memberError || !member) throw new Error("Could not find this team member.");
    if (member.invitation_status === "invited") {
      throw new Error("Team member must verify the invitation before schedule setup.");
    }
    await assertNoTeamScheduleConflicts(
      context.supabase as any,
      data.teamMemberId,
      data.salonId,
      data.hours,
    );
    const { error } = await (context.supabase as any).from("team_member_hours").upsert(
      data.hours.map((hour) => ({
        team_member_id: data.teamMemberId,
        salon_id: data.salonId,
        day_of_week: hour.dayOfWeek,
        is_working: hour.isWorking,
        start_time: hour.startTime,
        end_time: hour.endTime,
      })),
      { onConflict: "team_member_id,salon_id,day_of_week" },
    );
    if (error) throw new Error("Could not save team member schedule.");
    return { ok: true };
  });

export const listSelectableServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => salonIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { data: services, error } = await (context.supabase as any)
      .from("salon_services")
      .select(
        "id, name, price, duration_mins, salon_categories(name), salon_subcategories(name), service_subcategories(name)",
      )
      .eq("salon_id", data.salonId)
      .order("name");
    if (error) throw new Error("Could not load services.");
    return (services ?? []).map((service: any) => ({
      id: service.id,
      name: service.name,
      price: Number(service.price ?? 0),
      durationMins: Number(service.duration_mins ?? 0),
      categoryName: service.salon_categories?.name ?? "Services",
      subcategoryName:
        service.salon_subcategories?.name ?? service.service_subcategories?.name ?? "Services",
    }));
  });

export const listPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => salonIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { data: packages, error } = await (context.supabase as any)
      .from("salon_packages")
      .select(
        "id, name, description, pricing_option, original_price, package_price, offered_price, discount_type, discount_value, max_discount_amount, terms, duration_count, duration_unit, gender, validity_days, is_active, status, created_at",
      )
      .eq("salon_id", data.salonId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load packages.");
    const packageIds = (packages ?? []).map((item: any) => item.id);
    const links = packageIds.length
      ? await (context.supabase as any)
          .from("salon_package_services")
          .select("package_id, salon_service_id, salon_services(id, name, price, duration_mins)")
          .in("package_id", packageIds)
      : { data: [], error: null };
    if (links.error) throw new Error("Could not load package services.");
    return (packages ?? []).map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      pricingOption: item.pricing_option ?? "fixed",
      originalPrice: Number(item.original_price ?? item.package_price ?? 0),
      packagePrice: Number(item.package_price ?? 0),
      offeredPrice: Number(item.offered_price ?? item.package_price ?? 0),
      discountType: item.discount_type ?? "percentage",
      discountValue: Number(item.discount_value ?? 0),
      maxDiscountAmount:
        item.max_discount_amount === null || item.max_discount_amount === undefined
          ? null
          : Number(item.max_discount_amount),
      terms: item.terms,
      durationCount: item.duration_count ?? item.validity_days ?? 1,
      durationUnit: item.duration_unit ?? "month",
      gender: item.gender ?? "all",
      validityDays: item.validity_days,
      isActive: Boolean(item.is_active),
      status: item.status ?? (item.is_active ? "active" : "inactive"),
      serviceIds: (links.data ?? [])
        .filter((link: any) => link.package_id === item.id)
        .map((link: any) => link.salon_service_id),
      services: (links.data ?? [])
        .filter((link: any) => link.package_id === item.id)
        .map((link: any) =>
          link.salon_services
            ? {
                id: link.salon_services.id,
                name: link.salon_services.name,
                price: Number(link.salon_services.price ?? 0),
                durationMins: Number(link.salon_services.duration_mins ?? 0),
              }
            : null,
        )
        .filter(Boolean),
    }));
  });

export const savePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => packageInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    await loadServices(context.supabase as any, data.salonId, data.serviceIds);
    const row = {
      salon_id: data.salonId,
      name: data.name,
      description: cleanText(data.description),
      pricing_option: data.pricingOption,
      original_price: data.originalPrice,
      package_price: data.packagePrice,
      offered_price: data.packagePrice,
      discount_type: data.discountType,
      discount_value: data.discountValue,
      max_discount_amount: data.maxDiscountAmount ?? null,
      terms: cleanText(data.terms),
      duration_count: data.durationCount,
      duration_unit: data.durationUnit,
      gender: data.gender,
      validity_days: data.validityDays,
    };
    const result = data.id
      ? await (context.supabase as any)
          .from("salon_packages")
          .update(row)
          .eq("id", data.id)
          .eq("salon_id", data.salonId)
          .select("id")
          .single()
      : await (context.supabase as any)
          .from("salon_packages")
          .insert({ ...row, is_active: false, status: "draft" })
          .select("id")
          .single();
    if (result.error || !result.data)
      throw new Error(data.id ? "Could not update package." : "Could not add package.");
    await replaceLinks(
      context.supabase as any,
      "salon_package_services",
      "package_id",
      result.data.id,
      data.serviceIds,
    );
    return { id: result.data.id };
  });

export const setPackageActiveStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ salonId: id, id, isActive: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { error } = await (context.supabase as any)
      .from("salon_packages")
      .update({ is_active: data.isActive, status: data.isActive ? "active" : "inactive" })
      .eq("id", data.id)
      .eq("salon_id", data.salonId);
    if (error) throw new Error("Could not update package status.");
    return { ok: true };
  });

export const deletePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ salonId: id, id }).parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { error } = await (context.supabase as any)
      .from("salon_packages")
      .delete()
      .eq("id", data.id)
      .eq("salon_id", data.salonId);
    if (error) throw new Error("Could not delete package.");
    return { ok: true };
  });

export const listDeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => salonIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { data: deals, error } = await (context.supabase as any)
      .from("salon_deals")
      .select(
        "id, name, description, pricing_option, original_price, offered_price, discount_type, discount_value, max_discount_amount, terms, duration_count, duration_unit, gender, starts_on, ends_on, is_active, status, created_at",
      )
      .eq("salon_id", data.salonId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load deals.");
    const dealIds = (deals ?? []).map((deal: any) => deal.id);
    const links = dealIds.length
      ? await (context.supabase as any)
          .from("salon_deal_services")
          .select("deal_id, salon_service_id, salon_services(id, name, price, duration_mins)")
          .in("deal_id", dealIds)
      : { data: [], error: null };
    if (links.error) throw new Error("Could not load deal services.");
    return (deals ?? []).map((deal: any) => ({
      id: deal.id,
      name: deal.name,
      description: deal.description,
      pricingOption: deal.pricing_option ?? "discount",
      originalPrice: Number(deal.original_price ?? 0),
      offeredPrice: Number(deal.offered_price ?? 0),
      discountType: deal.discount_type,
      discountValue: Number(deal.discount_value ?? 0),
      maxDiscountAmount:
        deal.max_discount_amount === null || deal.max_discount_amount === undefined
          ? null
          : Number(deal.max_discount_amount),
      terms: deal.terms,
      durationCount: deal.duration_count ?? 1,
      durationUnit: deal.duration_unit ?? "month",
      gender: deal.gender ?? "all",
      startsOn: deal.starts_on,
      endsOn: deal.ends_on,
      isActive: Boolean(deal.is_active),
      status: deal.status ?? (deal.is_active ? "active" : "inactive"),
      serviceIds: (links.data ?? [])
        .filter((link: any) => link.deal_id === deal.id)
        .map((link: any) => link.salon_service_id),
      services: (links.data ?? [])
        .filter((link: any) => link.deal_id === deal.id)
        .map((link: any) =>
          link.salon_services
            ? {
                id: link.salon_services.id,
                name: link.salon_services.name,
                price: Number(link.salon_services.price ?? 0),
                durationMins: Number(link.salon_services.duration_mins ?? 0),
              }
            : null,
        )
        .filter(Boolean),
    }));
  });

export const saveDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => dealInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    await loadServices(context.supabase as any, data.salonId, data.serviceIds);
    const row = {
      salon_id: data.salonId,
      name: data.name,
      description: cleanText(data.description),
      pricing_option: data.pricingOption,
      original_price: data.originalPrice,
      offered_price: data.offeredPrice,
      discount_type: data.discountType,
      discount_value: data.discountValue,
      max_discount_amount: data.maxDiscountAmount ?? null,
      terms: cleanText(data.terms),
      duration_count: data.durationCount,
      duration_unit: data.durationUnit,
      gender: data.gender,
      starts_on: data.startsOn,
      ends_on: data.endsOn,
    };
    const result = data.id
      ? await (context.supabase as any)
          .from("salon_deals")
          .update(row)
          .eq("id", data.id)
          .eq("salon_id", data.salonId)
          .select("id")
          .single()
      : await (context.supabase as any)
          .from("salon_deals")
          .insert({ ...row, is_active: false, status: "draft" })
          .select("id")
          .single();
    if (result.error || !result.data)
      throw new Error(data.id ? "Could not update deal." : "Could not add deal.");
    await replaceLinks(
      context.supabase as any,
      "salon_deal_services",
      "deal_id",
      result.data.id,
      data.serviceIds,
    );
    return { id: result.data.id };
  });

export const setDealActiveStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ salonId: id, id, isActive: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { error } = await (context.supabase as any)
      .from("salon_deals")
      .update({ is_active: data.isActive, status: data.isActive ? "active" : "inactive" })
      .eq("id", data.id)
      .eq("salon_id", data.salonId);
    if (error) throw new Error("Could not update deal status.");
    return { ok: true };
  });

export const deleteDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ salonId: id, id }).parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { error } = await (context.supabase as any)
      .from("salon_deals")
      .delete()
      .eq("id", data.id)
      .eq("salon_id", data.salonId);
    if (error) throw new Error("Could not delete deal.");
    return { ok: true };
  });

export const listSalonCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => salonIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { data: customers, error } = await (context.supabase as any)
      .from("salon_customers")
      .select("id, first_name, last_name, phone, phone_verified_at, created_at")
      .eq("salon_id", data.salonId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load customers.");
    return (customers ?? []).map((customer: any) => ({
      id: customer.id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      fullName: fullName(customer.first_name, customer.last_name),
      phone: customer.phone,
      phoneVerifiedAt: customer.phone_verified_at,
      createdAt: customer.created_at,
    }));
  });

export const requestCustomerOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => customerOtpInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = normalizePhone(data.phone);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();
    const { error } = await (supabaseAdmin as any).from("customer_phone_otps").insert({
      salon_id: data.salonId,
      phone,
      code: DEV_OTP,
      expires_at: expiresAt,
    });
    if (error) throw new Error("Could not send customer OTP.");
    return { phone, expiresAt, ttlMinutes: OTP_TTL_MINUTES };
  });

export const verifyCustomerOtpAndSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => verifyCustomerOtpInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = normalizePhone(data.phone);
    const { data: otp } = await (supabaseAdmin as any)
      .from("customer_phone_otps")
      .select("id, code, expires_at, consumed_at")
      .eq("salon_id", data.salonId)
      .eq("phone", phone)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!otp) throw new Error("No active OTP. Please request a new one.");
    if (new Date(otp.expires_at).getTime() < Date.now()) throw new Error("This OTP has expired.");
    if (otp.code !== data.code) throw new Error("Incorrect OTP.");
    const now = new Date().toISOString();
    await (supabaseAdmin as any).from("customer_phone_otps").update({ consumed_at: now }).eq("id", otp.id);
    const { data: customer, error } = await (supabaseAdmin as any)
      .from("salon_customers")
      .upsert(
        {
          salon_id: data.salonId,
          first_name: data.firstName,
          last_name: data.lastName,
          phone,
          phone_verified_at: now,
        },
        { onConflict: "salon_id,phone" },
      )
      .select("id, first_name, last_name, phone, phone_verified_at, created_at")
      .single();
    if (error || !customer) throw new Error("Could not save customer.");
    return {
      id: customer.id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      fullName: fullName(customer.first_name, customer.last_name),
      phone: customer.phone,
      phoneVerifiedAt: customer.phone_verified_at,
      createdAt: customer.created_at,
    };
  });

export const listAvailableBookingSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => slotInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const services = await loadServices(context.supabase as any, data.salonId, data.serviceIds);
    const assignments = buildBookingAssignments(
      services,
      data.serviceIds,
      data.serviceTeamMemberIds,
      data.teamMemberId,
    );
    const durationMins = assignments.reduce((sum, assignment) => sum + assignment.durationMins, 0);
    let constraints: Awaited<ReturnType<typeof loadBookingTeamConstraints>>;
    try {
      constraints = await loadBookingTeamConstraints(
        context.supabase as any,
        context.userId,
        data.salonId,
        data.date,
        assignments,
        data.bookingId,
      );
    } catch {
      return [];
    }
    const open = timeToMinutes(constraints.branchHours.open_time);
    const close = timeToMinutes(constraints.branchHours.close_time);
    const slots = [];
    for (let minutes = open; minutes + durationMins <= close; minutes += SLOT_STEP_MINUTES) {
      try {
        validateBookingAssignmentSegments(assignments, data.date, minutes, constraints);
        const startsAt = isoFromLocal(data.date, minutes);
        slots.push({
          startsAt: localDateTime(data.date, minutes),
          label: formatSlotLabel(startsAt, durationMins),
          durationMins,
        });
      } catch {
        // This candidate is not available for at least one assigned team member.
      }
    }
    return slots;
  });

export const listBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => salonIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { data: bookings, error } = await (context.supabase as any)
      .from("salon_bookings")
      .select(
        "id, customer_id, client_name, client_phone, starts_at, ends_at, status, total_amount, notes, team_member_id, package_id, deal_id, started_at, completed_at, rating, review_comment, team_members(id, full_name), salon_packages(id, name), salon_deals(id, name)",
      )
      .eq("salon_id", data.salonId)
      .order("starts_at", { ascending: true });
    if (error) throw new Error("Could not load bookings.");
    const bookingIds = (bookings ?? []).map((booking: any) => booking.id);
    const links = bookingIds.length
      ? await (context.supabase as any)
          .from("salon_booking_services")
          .select(
            "booking_id, salon_service_id, team_member_id, salon_services(id, name, price, duration_mins)",
          )
          .in("booking_id", bookingIds)
      : { data: [], error: null };
    if (links.error) throw new Error("Could not load booking services.");
    return (bookings ?? []).map((booking: any) => ({
      id: booking.id,
      customerId: booking.customer_id,
      clientName: booking.client_name,
      clientPhone: booking.client_phone,
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
      status: booking.status,
      totalAmount: Number(booking.total_amount ?? 0),
      notes: booking.notes,
      teamMemberId: booking.team_member_id,
      teamMemberName: booking.team_members?.full_name ?? null,
      packageId: booking.package_id,
      packageName: booking.salon_packages?.name ?? null,
      dealId: booking.deal_id,
      dealName: booking.salon_deals?.name ?? null,
      startedAt: booking.started_at,
      completedAt: booking.completed_at,
      rating: booking.rating,
      reviewComment: booking.review_comment,
      serviceIds: (links.data ?? [])
        .filter((link: any) => link.booking_id === booking.id)
        .map((link: any) => link.salon_service_id),
      serviceTeamMemberIds: Object.fromEntries(
        (links.data ?? [])
          .filter((link: any) => link.booking_id === booking.id && link.team_member_id)
          .map((link: any) => [link.salon_service_id, link.team_member_id]),
      ),
      services: (links.data ?? [])
        .filter((link: any) => link.booking_id === booking.id)
        .map((link: any) => link.salon_services)
        .filter(Boolean),
    }));
  });

export const saveBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bookingInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const services = await loadServices(context.supabase as any, data.salonId, data.serviceIds);
    const assignments = buildBookingAssignments(
      services,
      data.serviceIds,
      data.serviceTeamMemberIds,
      data.teamMemberId,
    );
    const totalMins = assignments.reduce((sum, assignment) => sum + assignment.durationMins, 0);
    const totalAmount = services.reduce(
      (sum: number, service: any) => sum + Number(service.price ?? 0),
      0,
    );
    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(startsAt.getTime() + Math.max(totalMins, 15) * 60000);
    const date = salonLocalDateKey(startsAt);
    const selectedMinutes = salonLocalMinutes(startsAt);
    const constraints = await loadBookingTeamConstraints(
      context.supabase as any,
      context.userId,
      data.salonId,
      date,
      assignments,
      data.id,
    );
    const branchOpen = timeToMinutes(constraints.branchHours.open_time);
    if ((selectedMinutes - branchOpen) % SLOT_STEP_MINUTES !== 0) {
      throw new Error("Selected slot is no longer available.");
    }
    validateBookingAssignmentSegments(assignments, date, selectedMinutes, constraints);
    if (data.customerId) {
      const { data: customer, error: customerError } = await (context.supabase as any)
        .from("salon_customers")
        .select("id")
        .eq("id", data.customerId)
        .eq("salon_id", data.salonId)
        .maybeSingle();
      if (customerError || !customer) throw new Error("Select a valid customer.");
    }
    const row = {
      salon_id: data.salonId,
      customer_id: data.customerId ?? null,
      client_name: data.clientName,
      client_phone: data.clientPhone,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      team_member_id: assignments[0]?.teamMemberId ?? data.teamMemberId ?? null,
      package_id: data.packageId ?? null,
      deal_id: data.dealId ?? null,
      status: data.status,
      notes: cleanText(data.notes),
      total_amount: totalAmount,
    };
    const result = data.id
      ? await (context.supabase as any)
          .from("salon_bookings")
          .update(row)
          .eq("id", data.id)
          .eq("salon_id", data.salonId)
          .select("id")
          .single()
      : await (context.supabase as any).from("salon_bookings").insert(row).select("id").single();
    if (result.error || !result.data)
      throw new Error(data.id ? "Could not update booking." : "Could not add booking.");
    const { error: deleteLinksError } = await (context.supabase as any)
      .from("salon_booking_services")
      .delete()
      .eq("booking_id", result.data.id);
    if (deleteLinksError) throw new Error("Could not reset existing service assignments.");
    const { error: insertLinksError } = await (context.supabase as any)
      .from("salon_booking_services")
      .insert(
        assignments.map((assignment) => ({
          booking_id: result.data.id,
          salon_service_id: assignment.serviceId,
          team_member_id: assignment.teamMemberId,
        })),
      );
    if (insertLinksError) throw new Error("Could not save service assignments.");
    return { id: result.data.id };
  });

export const setBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ salonId: id, id, status: bookingStatus }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    if (data.status === "no_show") {
      const { data: booking, error: bookingError } = await (context.supabase as any)
        .from("salon_bookings")
        .select("id, status, ends_at")
        .eq("id", data.id)
        .eq("salon_id", data.salonId)
        .single();
      if (bookingError || !booking) throw new Error("Could not find this booking.");
      if (booking.status !== "confirmed") {
        throw new Error("Only a confirmed booking can be marked as no show.");
      }
      if (Date.now() < new Date(booking.ends_at).getTime()) {
        throw new Error("A booking can be marked as no show only after its scheduled end time.");
      }
    }
    const { error } = await (context.supabase as any)
      .from("salon_bookings")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("salon_id", data.salonId);
    if (error) throw new Error("Could not update booking status.");
    return { ok: true };
  });

export const deleteBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ salonId: id, id }).parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { error } = await (context.supabase as any)
      .from("salon_bookings")
      .delete()
      .eq("id", data.id)
      .eq("salon_id", data.salonId);
    if (error) throw new Error("Could not delete booking.");
    return { ok: true };
  });

export const startBookingJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => startJobInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { data: booking, error: bookingError } = await (context.supabase as any)
      .from("salon_bookings")
      .select("id, status, starts_at, ends_at")
      .eq("id", data.id)
      .eq("salon_id", data.salonId)
      .single();
    if (bookingError || !booking) throw new Error("Could not find this booking.");
    if (booking.status !== "confirmed") {
      throw new Error("Only a confirmed booking can be started.");
    }
    const now = Date.now();
    if (now < new Date(booking.starts_at).getTime()) {
      throw new Error("This job can be started only at its scheduled start time.");
    }
    if (now >= new Date(booking.ends_at).getTime()) {
      throw new Error("This job can no longer be started because the appointment has ended.");
    }
    if (data.otp !== DEV_OTP) throw new Error("Invalid OTP.");
    const { error } = await (context.supabase as any)
      .from("salon_bookings")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("salon_id", data.salonId);
    if (error) throw new Error("Could not start this job.");
    return { ok: true };
  });

export const completeBookingJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => completeJobInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { data: booking, error: bookingError } = await (context.supabase as any)
      .from("salon_bookings")
      .select("id, status")
      .eq("id", data.id)
      .eq("salon_id", data.salonId)
      .single();
    if (bookingError || !booking) throw new Error("Could not find this booking.");
    if (booking.status !== "in_progress") {
      throw new Error("Only a job in progress can be finished.");
    }
    const { error } = await (context.supabase as any)
      .from("salon_bookings")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        rating: data.rating,
        review_comment: data.comment,
      })
      .eq("id", data.id)
      .eq("salon_id", data.salonId);
    if (error) throw new Error("Could not finish this job.");
    return { ok: true };
  });
