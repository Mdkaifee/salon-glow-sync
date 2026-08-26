-- Team, packages, deals and bookings for the web business dashboard.

CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role_title TEXT NOT NULL DEFAULT 'Stylist',
  employment_type TEXT NOT NULL DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time', 'part_time', 'contract')),
  base_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_type TEXT NOT NULL DEFAULT 'percentage'
    CHECK (commission_type IN ('percentage', 'fixed')),
  commission_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_member_branches (
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_member_id, salon_id)
);

CREATE TABLE IF NOT EXISTS public.team_member_services (
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  salon_service_id UUID NOT NULL REFERENCES public.salon_services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_member_id, salon_service_id)
);

CREATE TABLE IF NOT EXISTS public.salon_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  package_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  validity_days INT NOT NULL DEFAULT 90 CHECK (validity_days > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.salon_package_services (
  package_id UUID NOT NULL REFERENCES public.salon_packages(id) ON DELETE CASCADE,
  salon_service_id UUID NOT NULL REFERENCES public.salon_services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (package_id, salon_service_id)
);

CREATE TABLE IF NOT EXISTS public.salon_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on),
  CHECK (discount_type <> 'percentage' OR discount_value <= 100)
);

CREATE TABLE IF NOT EXISTS public.salon_deal_services (
  deal_id UUID NOT NULL REFERENCES public.salon_deals(id) ON DELETE CASCADE,
  salon_service_id UUID NOT NULL REFERENCES public.salon_services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (deal_id, salon_service_id)
);

CREATE TABLE IF NOT EXISTS public.salon_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  team_member_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  package_id UUID REFERENCES public.salon_packages(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.salon_deals(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.salon_booking_services (
  booking_id UUID NOT NULL REFERENCES public.salon_bookings(id) ON DELETE CASCADE,
  salon_service_id UUID NOT NULL REFERENCES public.salon_services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_id, salon_service_id)
);

CREATE INDEX IF NOT EXISTS team_members_owner_idx ON public.team_members(owner_id, is_active);
CREATE INDEX IF NOT EXISTS team_member_branches_salon_idx ON public.team_member_branches(salon_id);
CREATE INDEX IF NOT EXISTS team_member_services_service_idx ON public.team_member_services(salon_service_id);
CREATE INDEX IF NOT EXISTS salon_packages_salon_idx ON public.salon_packages(salon_id, is_active);
CREATE INDEX IF NOT EXISTS salon_deals_salon_idx ON public.salon_deals(salon_id, is_active, starts_on, ends_on);
CREATE INDEX IF NOT EXISTS salon_bookings_salon_starts_idx ON public.salon_bookings(salon_id, starts_at);
CREATE INDEX IF NOT EXISTS salon_bookings_team_starts_idx ON public.salon_bookings(team_member_id, starts_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.team_members,
  public.team_member_branches,
  public.team_member_services,
  public.salon_packages,
  public.salon_package_services,
  public.salon_deals,
  public.salon_deal_services,
  public.salon_bookings,
  public.salon_booking_services
TO authenticated;

GRANT ALL ON
  public.team_members,
  public.team_member_branches,
  public.team_member_services,
  public.salon_packages,
  public.salon_package_services,
  public.salon_deals,
  public.salon_deal_services,
  public.salon_bookings,
  public.salon_booking_services
TO service_role;

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_member_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_member_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_package_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_deal_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_booking_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own team members" ON public.team_members;
CREATE POLICY "own team members" ON public.team_members FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "own team branch assignments" ON public.team_member_branches;
CREATE POLICY "own team branch assignments" ON public.team_member_branches FOR ALL TO authenticated
  USING (
    public.owns_salon(salon_id)
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = team_member_id AND tm.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.owns_salon(salon_id)
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = team_member_id AND tm.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "own team service assignments" ON public.team_member_services;
CREATE POLICY "own team service assignments" ON public.team_member_services FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.team_members tm
      JOIN public.salon_services ss ON ss.id = salon_service_id
      WHERE tm.id = team_member_id
        AND tm.owner_id = auth.uid()
        AND public.owns_salon(ss.salon_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.team_members tm
      JOIN public.salon_services ss ON ss.id = salon_service_id
      WHERE tm.id = team_member_id
        AND tm.owner_id = auth.uid()
        AND public.owns_salon(ss.salon_id)
    )
  );

DROP POLICY IF EXISTS "own salon packages" ON public.salon_packages;
CREATE POLICY "own salon packages" ON public.salon_packages FOR ALL TO authenticated
  USING (public.owns_salon(salon_id)) WITH CHECK (public.owns_salon(salon_id));

DROP POLICY IF EXISTS "own package services" ON public.salon_package_services;
CREATE POLICY "own package services" ON public.salon_package_services FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.salon_packages sp
      JOIN public.salon_services ss ON ss.id = salon_service_id
      WHERE sp.id = package_id
        AND public.owns_salon(sp.salon_id)
        AND public.owns_salon(ss.salon_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.salon_packages sp
      JOIN public.salon_services ss ON ss.id = salon_service_id
      WHERE sp.id = package_id
        AND public.owns_salon(sp.salon_id)
        AND public.owns_salon(ss.salon_id)
    )
  );

DROP POLICY IF EXISTS "own salon deals" ON public.salon_deals;
CREATE POLICY "own salon deals" ON public.salon_deals FOR ALL TO authenticated
  USING (public.owns_salon(salon_id)) WITH CHECK (public.owns_salon(salon_id));

DROP POLICY IF EXISTS "own deal services" ON public.salon_deal_services;
CREATE POLICY "own deal services" ON public.salon_deal_services FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.salon_deals sd
      JOIN public.salon_services ss ON ss.id = salon_service_id
      WHERE sd.id = deal_id
        AND public.owns_salon(sd.salon_id)
        AND public.owns_salon(ss.salon_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.salon_deals sd
      JOIN public.salon_services ss ON ss.id = salon_service_id
      WHERE sd.id = deal_id
        AND public.owns_salon(sd.salon_id)
        AND public.owns_salon(ss.salon_id)
    )
  );

DROP POLICY IF EXISTS "own salon bookings" ON public.salon_bookings;
CREATE POLICY "own salon bookings" ON public.salon_bookings FOR ALL TO authenticated
  USING (public.owns_salon(salon_id)) WITH CHECK (public.owns_salon(salon_id));

DROP POLICY IF EXISTS "own booking services" ON public.salon_booking_services;
CREATE POLICY "own booking services" ON public.salon_booking_services FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.salon_bookings sb
      JOIN public.salon_services ss ON ss.id = salon_service_id
      WHERE sb.id = booking_id
        AND public.owns_salon(sb.salon_id)
        AND public.owns_salon(ss.salon_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.salon_bookings sb
      JOIN public.salon_services ss ON ss.id = salon_service_id
      WHERE sb.id = booking_id
        AND public.owns_salon(sb.salon_id)
        AND public.owns_salon(ss.salon_id)
    )
  );

DROP TRIGGER IF EXISTS team_members_updated ON public.team_members;
CREATE TRIGGER team_members_updated
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS salon_packages_updated ON public.salon_packages;
CREATE TRIGGER salon_packages_updated
  BEFORE UPDATE ON public.salon_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS salon_deals_updated ON public.salon_deals;
CREATE TRIGGER salon_deals_updated
  BEFORE UPDATE ON public.salon_deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS salon_bookings_updated ON public.salon_bookings;
CREATE TRIGGER salon_bookings_updated
  BEFORE UPDATE ON public.salon_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
