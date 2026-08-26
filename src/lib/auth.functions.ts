import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { otpSchema, phoneSchema, profileSchema } from "./validation";

const OTP_TTL_MINUTES = 10;
const RESEND_DELAYS_MINUTES = [2, 5, 10, 30, 60, 24 * 60] as const;
/** Fixed development OTP until an SMS provider is connected. */
const DEV_OTP = "123456";

function syntheticEmail(phone: string) {
  return `p${phone.replace(/\D/g, "")}@phone.glowante.app`;
}

function formatWait(milliseconds: number) {
  const minutes = Math.max(1, Math.ceil(milliseconds / 60_000));
  if (minutes >= 60) return `${Math.ceil(minutes / 60)} hour${minutes >= 120 ? "s" : ""}`;
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/** Step 1 - create (or refresh) an OTP for a phone number. */
export const requestOtp = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) => z.object({ phone: phoneSchema }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = Date.now();
    const { data: resendLimit, error: resendLimitError } = await supabaseAdmin
      .from("otp_resend_limits")
      .select("resend_count, next_resend_at")
      .eq("phone", data.phone)
      .maybeSingle();
    if (resendLimitError) throw new Error("Could not check the OTP resend limit. Please try again.");
    const nextAllowedAt = resendLimit?.next_resend_at ? new Date(resendLimit.next_resend_at).getTime() : 0;
    if (nextAllowedAt > now) throw new Error(`Please wait ${formatWait(nextAllowedAt - now)} before requesting another OTP.`);

    const resendCount = (resendLimit?.resend_count ?? 0) + 1;
    const cooldownMinutes = RESEND_DELAYS_MINUTES[Math.min(resendCount - 1, RESEND_DELAYS_MINUTES.length - 1)]!;
    const resendAvailableAt = new Date(now + cooldownMinutes * 60_000).toISOString();
    const expiresAt = new Date(now + OTP_TTL_MINUTES * 60_000).toISOString();

    const { error: limitUpdateError } = await supabaseAdmin.from("otp_resend_limits").upsert({
      phone: data.phone,
      resend_count: resendCount,
      next_resend_at: resendAvailableAt,
      updated_at: new Date(now).toISOString(),
    });
    if (limitUpdateError) throw new Error("Could not set the OTP resend limit. Please try again.");

    const { error } = await supabaseAdmin.from("phone_otps").insert({
      phone: data.phone,
      code: DEV_OTP,
      expires_at: expiresAt,
    });
    if (error) throw new Error("Could not send OTP. Please try again.");

    // SMS delivery placeholder: message body would be
    // `Glowante: your verification code is ${DEV_OTP}. Valid for 10 minutes.`
    return { expiresAt, ttlMinutes: OTP_TTL_MINUTES, resendAvailableAt, resendDelaySeconds: cooldownMinutes * 60 };
  });

/**
 * Step 2 - verify the OTP. Returns one-time credentials so the browser can
 * establish its own session with the auth server.
 */
export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string; code: string }) =>
    z.object({ phone: phoneSchema, code: otpSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: otp } = await supabaseAdmin
      .from("phone_otps")
      .select("id, code, expires_at, consumed_at")
      .eq("phone", data.phone)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otp) throw new Error("No active OTP. Please request a new one.");
    if (new Date(otp.expires_at).getTime() < Date.now())
      throw new Error("This OTP has expired. Please resend a new one.");
    if (otp.code !== data.code) throw new Error("Incorrect OTP. Please check and try again.");

    await supabaseAdmin
      .from("phone_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", otp.id);

    await supabaseAdmin.from("otp_resend_limits").delete().eq("phone", data.phone);

    const email = syntheticEmail(data.phone);
    const password = crypto.randomUUID() + crypto.randomUUID();

    let { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id, profile_completed")
      .eq("phone", data.phone)
      .maybeSingle();

    // Upgrade existing India-only account records to E.164 at their next login.
    if (!existing && data.phone.startsWith("+91")) {
      const legacyPhone = data.phone.slice(3);
      const { data: legacyProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, profile_completed")
        .eq("phone", legacyPhone)
        .maybeSingle();
      if (legacyProfile) {
        existing = legacyProfile;
        await supabaseAdmin.from("profiles").update({ phone: data.phone }).eq("id", legacyProfile.id);
      }
    }

    let userId = existing?.id ?? null;
    let isNewUser = false;

    if (!userId) {
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        phone_confirm: false,
        user_metadata: { phone: data.phone },
      });
      if (createError || !created.user) throw new Error("Could not sign you in. Please try again.");
      userId = created.user.id;
      isNewUser = true;

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({ id: userId, phone: data.phone, profile_completed: false });
      if (profileError) throw new Error("Could not create your profile. Please try again.");
    } else {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
      });
      if (updateError) throw new Error("Could not sign you in. Please try again.");
    }

    return {
      email,
      password,
      isNewUser,
      profileCompleted: existing?.profile_completed ?? false,
    };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [
      { data, error },
      { count: ownedSalonCount, error: salonError },
      { data: teamRows, error: teamError },
    ] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("id, phone, first_name, last_name, email, profile_completed")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("salons")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", context.userId),
      (context.supabase as any)
        .from("team_members")
        .select("roles")
        .or(`user_id.eq.${context.userId},owner_id.eq.${context.userId}`),
    ]);
    if (error) throw new Error("Could not load your profile.");
    if (salonError || teamError) throw new Error("Could not load your access roles.");
    if (!data) return null;

    const rolesSet = new Set<string>();
    if ((ownedSalonCount ?? 0) > 0) {
      rolesSet.add("salon_owner");
    }
    for (const member of teamRows ?? []) {
      for (const role of member.roles ?? []) {
        rolesSet.add(role);
      }
    }
    if (rolesSet.size === 0) {
      rolesSet.add("app_user");
    }

    return {
      ...data,
      roles: Array.from(rolesSet),
    };
  });

export const completeProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        profile_completed: true,
      })
      .eq("id", context.userId);
    if (error) throw new Error("Could not save your profile. Please try again.");
    return { ok: true };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error("Could not delete your account. Please try again.");
    return { ok: true };
  });
