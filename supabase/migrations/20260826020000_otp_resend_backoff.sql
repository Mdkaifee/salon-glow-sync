CREATE TABLE IF NOT EXISTS public.otp_resend_limits (
  phone TEXT PRIMARY KEY,
  resend_count INT NOT NULL DEFAULT 0 CHECK (resend_count >= 0),
  next_resend_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.otp_resend_limits TO service_role;
ALTER TABLE public.otp_resend_limits ENABLE ROW LEVEL SECURITY;
