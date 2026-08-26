-- Per-service team member assignment for bookings.

ALTER TABLE public.salon_booking_services
  ADD COLUMN IF NOT EXISTS team_member_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS salon_booking_services_team_idx
  ON public.salon_booking_services(team_member_id);
