import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Phone, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getTeamInvitation,
  requestTeamInviteOtp,
  verifyTeamInviteOtp,
} from "@/lib/business.functions";

export const Route = createFileRoute("/team-invite")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Team Invitation - Glowante" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: TeamInvitePage,
});

function TeamInvitePage() {
  const { token } = Route.useSearch();
  const fetchInvitation = useServerFn(getTeamInvitation);
  const sendOtp = useServerFn(requestTeamInviteOtp);
  const verifyOtp = useServerFn(verifyTeamInviteOtp);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const invitationQuery = useQuery({
    queryKey: ["team-invite", token],
    queryFn: () => fetchInvitation({ data: { token: token! } }),
    enabled: Boolean(token),
  });
  const invitation = invitationQuery.data;
  const effectivePhone = phone || invitation?.phone || "";

  async function requestOtp() {
    if (!token) return;
    setLoading(true);
    try {
      await sendOtp({ data: { token, phone: effectivePhone } });
      setPhone(effectivePhone);
      setOtpSent(true);
      toast.success(`OTP sent to ${effectivePhone}`, {
        description: "Glowante: your verification code is 123456. Valid for 10 minutes.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    if (!token) return;
    setLoading(true);
    try {
      await verifyOtp({ data: { token, phone: effectivePhone, code } });
      setDone(true);
      toast.success("Phone verified");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not verify OTP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto flex max-w-xl flex-col px-5 py-12">
        <div className="rounded-3xl border border-border bg-card p-7 shadow-elegant">
          {!token ? (
            <State
              title="Invalid invitation"
              body="This team invitation link is missing a token."
            />
          ) : invitationQuery.isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : invitationQuery.isError || !invitation ? (
            <State title="Invalid invitation" body="This invitation link could not be opened." />
          ) : invitation.expired || invitation.status !== "invited" ? (
            <State
              title={invitation.expired ? "Invitation expired" : "Invitation already used"}
              body="Ask the salon owner to send a fresh invitation."
            />
          ) : done ? (
            <State
              title="Setup required"
              body="Your phone is verified. The salon owner can now assign your branch and services."
            />
          ) : (
            <>
              <h1 className="text-center text-2xl font-semibold text-foreground">
                Join {invitation.salonName}
              </h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Invitation for {invitation.firstName} {invitation.lastName} at {invitation.email}
              </p>
              <div className="mt-7 space-y-5">
                <div className="space-y-2">
                  <Label>Mobile number</Label>
                  <Input
                    value={effectivePhone}
                    placeholder="9876543210"
                    onChange={(event) => setPhone(event.target.value)}
                    disabled={otpSent}
                  />
                </div>
                {otpSent && (
                  <div className="space-y-2">
                    <Label>OTP</Label>
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Enter OTP (123456)"
                      value={code}
                      onChange={(event) =>
                        setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                    />
                  </div>
                )}
                <Button
                  className="w-full"
                  size="lg"
                  disabled={loading || !effectivePhone || (otpSent && code.length !== 6)}
                  onClick={() => (otpSent ? void verify() : void requestOtp())}
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : otpSent ? (
                    <ShieldCheck className="size-4" />
                  ) : (
                    <Phone className="size-4" />
                  )}
                  {otpSent ? "Verify & Join" : "Send OTP"}
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function State({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-10 text-center">
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-muted-foreground">{body}</p>
    </div>
  );
}
