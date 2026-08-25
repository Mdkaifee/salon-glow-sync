import { z } from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, { message: "Enter a valid 10-digit Indian mobile number" });

export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, { message: "Enter the 6-digit OTP" });

export const profileSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, { message: "First name must be at least 2 characters" })
    .max(50, { message: "First name must be under 50 characters" })
    .regex(/^[A-Za-z][A-Za-z\s'-]*$/, { message: "Only letters are allowed" }),
  lastName: z
    .string()
    .trim()
    .min(1, { message: "Last name is required" })
    .max(50, { message: "Last name must be under 50 characters" })
    .regex(/^[A-Za-z][A-Za-z\s'-]*$/, { message: "Only letters are allowed" }),
  email: z
    .string()
    .trim()
    .email({ message: "Enter a valid email address" })
    .max(255, { message: "Email must be under 255 characters" }),
});

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, { message: "Invalid time" });

export const salonDetailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Salon name must be at least 2 characters" })
    .max(80, { message: "Salon name must be under 80 characters" }),
  phone: phoneSchema,
  openTime: timeSchema,
  closeTime: timeSchema,
  isStylist: z.boolean(),
  address: z.string().trim().min(4, { message: "Address is required" }).max(300),
  houseNo: z.string().trim().max(60).optional().or(z.literal("")),
  street: z.string().trim().max(120).optional().or(z.literal("")),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  about: z
    .string()
    .trim()
    .min(2, { message: "About us must be at least 2 characters" })
    .max(250, { message: "About us must be under 250 letters" }),
});

export const salonHourSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isOpen: z.boolean(),
  openTime: timeSchema,
  closeTime: timeSchema,
});

export const createSalonSchema = salonDetailsSchema.extend({
  parentId: z.string().uuid().nullable().optional(),
  hours: z.array(salonHourSchema).length(7),
  categoryIds: z.array(z.string().uuid()).min(1, { message: "Select at least one service category" }),
});

export const updateSalonSchema = salonDetailsSchema.extend({
  id: z.string().uuid(),
  hours: z.array(salonHourSchema).length(7),
});

export type SalonDetailsInput = z.infer<typeof salonDetailsSchema>;
export type SalonHourInput = z.infer<typeof salonHourSchema>;
export type CreateSalonInput = z.infer<typeof createSalonSchema>;
export type UpdateSalonInput = z.infer<typeof updateSalonSchema>;

export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
