import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Phone, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

import logo from "@/assets/glowante-logo.png";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { completeProfile, requestOtp, verifyOtp } from "@/lib/auth.functions";
import { otpSchema, phoneSchema, profileSchema } from "@/lib/validation";

export const Route = createFileRoute("/business")({
  head: () => ({
    meta: [
      { title: "Business Sign In — Glowante Salon Suite" },
      {
        name: "description",
        content:
          "Sign in to the Glowante owner suite with your mobile number to manage salons, bookings, catalog and team.",
      },
      { property: "og:title", content: "Glowante for Business" },
      {
        property: "og:description",
        content: "Mobile OTP sign in for salon owners on Glowante.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: BusinessAuth,
});

type Step = "phone" | "otp" | "profile";

function BusinessAuth() {
  const navigate = useNavigate();
  const sendOtp = useServerFn(requestOtp);
  const checkOtp = useServerFn(verifyOtp);
  const saveProfile = useServerFn(completeProfile);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/salons", replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  const expiryLabel = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(
    secondsLeft % 60,
  ).padStart(2, "0")}`;

  async function handleSendOtp(resend = false) {
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      setErrors({ phone: parsed.error.issues[0]?.message ?? "Invalid number" });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const result = await sendOtp({ data: { phone: parsed.data } });
      setSecondsLeft(result.ttlMinutes * 60);
      setStep("otp");
      setCode("");
      toast.success(resend ? "A new OTP has been sent" : "OTP sent to +91 " + parsed.data, {
        description: "Glowante: your verification code is 123456. Valid for 10 minutes.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    const parsed = otpSchema.safeParse(code);
    if (!parsed.success) {
      setErrors({ code: parsed.error.issues[0]?.message ?? "Invalid OTP" });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const result = await checkOtp({ data: { phone, code: parsed.data } });
      const { error } = await supabase.auth.signInWithPassword({
        email: result.email,
        password: result.password,
      });
      if (error) throw new Error("Could not start your session. Please try again.");
      if (result.profileCompleted) {
        toast.success("Welcome back to Glowante");
        navigate({ to: "/salons", replace: true });
        return;
      }
      setStep("profile");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleProfile() {
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await saveProfile({ data: parsed.data });
      toast.success("Profile completed");
      navigate({ to: "/salons", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col px-5 py-12">
        <div className="rounded-3xl border border-border bg-card p-7 shadow-elegant">
          <img src={logo} alt="Glowante" width={180} height={50} className="mx-auto h-11 w-auto" />

          {step === "phone" && (
            <div className="mt-7">
              <h1 className="text-center text-2xl font-semibold text-foreground">Business sign in</h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                We&apos;ll send a 6-digit code to your mobile number.
              </p>
              <div className="mt-6 space-y-2">
                <Label htmlFor="phone">Mobile number</Label>
                <div className="flex items-stretch overflow-hidden rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                  <span className="flex items-center gap-2 border-r border-input bg-secondary px-3 text-sm font-medium text-primary">
                    <span aria-hidden className="text-base leading-none">
                      🇮🇳
                    </span>
                    +91
                  </span>
                  <input
                    id="phone"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
                    onKeyDown={(event) => event.key === "Enter" && void handleSendOtp()}
                    className="w-full bg-transparent px-3 py-2.5 text-sm tracking-wide outline-none"
                  />
                </div>
                {errors["phone"] && <p className="text-sm text-destructive">{errors["phone"]}</p>}
              </div>
              <Button className="mt-6 w-full" size="lg" disabled={loading} onClick={() => void handleSendOtp()}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Phone className="size-4" />}
                Send OTP
              </Button>
            </div>
          )}

          {step === "otp" && (
            <div className="mt-7">
              <h1 className="text-center text-2xl font-semibold text-foreground">Verify your number</h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Enter the 6-digit code sent to +91 {phone}
              </p>
              <div className="mt-6 space-y-2">
                <Label htmlFor="otp">OTP</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••••"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(event) => event.key === "Enter" && void handleVerify()}
                  className="text-center text-lg tracking-[0.5em]"
                />
                {errors["code"] && <p className="text-sm text-destructive">{errors["code"]}</p>}
                <p className="text-center text-xs text-muted-foreground">
                  {secondsLeft > 0 ? `Expires in ${expiryLabel}` : "This code has expired"}
                </p>
              </div>
              <Button className="mt-5 w-full" size="lg" disabled={loading} onClick={() => void handleVerify()}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                Verify &amp; continue
              </Button>
              <div className="mt-4 flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setStep("phone")}
                >
                  <ArrowLeft className="size-4" /> Change number
                </button>
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  disabled={loading}
                  onClick={() => void handleSendOtp(true)}
                >
                  Resend OTP
                </button>
              </div>
            </div>
          )}

          {step === "profile" && (
            <div className="mt-7">
              <h1 className="text-center text-2xl font-semibold text-foreground">Complete your profile</h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Just a few details before we set up your salon.
              </p>
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    value={form.firstName}
                    maxLength={50}
                    onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                  />
                  {errors["firstName"] && <p className="text-sm text-destructive">{errors["firstName"]}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    value={form.lastName}
                    maxLength={50}
                    onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                  />
                  {errors["lastName"] && <p className="text-sm text-destructive">{errors["lastName"]}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    maxLength={255}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                  {errors["email"] && <p className="text-sm text-destructive">{errors["email"]}</p>}
                </div>
              </div>
              <Button className="mt-6 w-full" size="lg" disabled={loading} onClick={() => void handleProfile()}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <UserRound className="size-4" />}
                Save &amp; continue
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
