import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { otpSchema, phoneSchema, profileSchema } from "./validation";

const OTP_TTL_MINUTES = 10;
/** Fixed development OTP until an SMS provider is connected. */
const DEV_OTP = "123456";

function syntheticEmail(phone: string) {
  return `p91${phone}@phone.glowante.app`;
}

/** Step 1 - create (or refresh) an OTP for a phone number. */
export const requestOtp = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) => z.object({ phone: phoneSchema }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();

    const { error } = await supabaseAdmin.from("phone_otps").insert({
      phone: data.phone,
      code: DEV_OTP,
      expires_at: expiresAt,
    });
    if (error) throw new Error("Could not send OTP. Please try again.");

    // SMS delivery placeholder: message body would be
    // `Glowante: your verification code is ${DEV_OTP}. Valid for 10 minutes.`
    return { expiresAt, ttlMinutes: OTP_TTL_MINUTES };
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

    const email = syntheticEmail(data.phone);
    const password = crypto.randomUUID() + crypto.randomUUID();

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id, profile_completed")
      .eq("phone", data.phone)
      .maybeSingle();

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
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, phone, first_name, last_name, email, profile_completed")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Could not load your profile.");
    return data;
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
