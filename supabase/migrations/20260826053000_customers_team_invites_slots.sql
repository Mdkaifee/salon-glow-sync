-- Customer OTP booking flow and team invitation/setup state.

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS invitation_status TEXT NOT NULL DEFAULT 'active'
    CHECK (invitation_status IN ('invited', 'setup_required', 'active')),
  ADD COLUMN IF NOT EXISTS setup_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'invite', 'owner_stylist')),
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS online_booking_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS team_members_owner_user_idx
  ON public.team_members(owner_id, user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.team_member_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT NOT NULL,
  message TEXT,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'verified', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_invite_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES public.team_member_invitations(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.salon_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (salon_id, phone)
);

CREATE TABLE IF NOT EXISTS public.customer_phone_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.salon_bookings
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.salon_customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS team_member_invitations_owner_idx
  ON public.team_member_invitations(owner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS team_member_invitations_token_idx
  ON public.team_member_invitations(token);
CREATE INDEX IF NOT EXISTS team_invite_otps_invitation_idx
  ON public.team_invite_otps(invitation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS salon_customers_salon_idx
  ON public.salon_customers(salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_phone_otps_phone_idx
  ON public.customer_phone_otps(salon_id, phone, created_at DESC);
CREATE INDEX IF NOT EXISTS salon_bookings_customer_idx
  ON public.salon_bookings(customer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.team_member_invitations,
  public.salon_customers
TO authenticated;

GRANT ALL ON
  public.team_member_invitations,
  public.team_invite_otps,
  public.salon_customers,
  public.customer_phone_otps
TO service_role;

ALTER TABLE public.team_member_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invite_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_phone_otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own team invitations" ON public.team_member_invitations;
CREATE POLICY "own team invitations" ON public.team_member_invitations FOR ALL TO authenticated
  USING (owner_id = auth.uid() AND public.owns_salon(salon_id))
  WITH CHECK (owner_id = auth.uid() AND public.owns_salon(salon_id));

DROP POLICY IF EXISTS "own salon customers" ON public.salon_customers;
CREATE POLICY "own salon customers" ON public.salon_customers FOR ALL TO authenticated
  USING (public.owns_salon(salon_id)) WITH CHECK (public.owns_salon(salon_id));

DROP TRIGGER IF EXISTS team_member_invitations_updated ON public.team_member_invitations;
CREATE TRIGGER team_member_invitations_updated
  BEFORE UPDATE ON public.team_member_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS salon_customers_updated ON public.salon_customers;
CREATE TRIGGER salon_customers_updated
  BEFORE UPDATE ON public.salon_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
