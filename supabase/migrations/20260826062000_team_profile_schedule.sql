-- Team profile/setup fields and per-branch working hours.

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT 'all'
    CHECK (gender IN ('male', 'female', 'other', 'all')),
  ADD COLUMN IF NOT EXISTS experience_years NUMERIC(4,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS about TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS joining_date DATE,
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

CREATE TABLE IF NOT EXISTS public.team_member_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_working BOOLEAN NOT NULL DEFAULT true,
  start_time TIME NOT NULL DEFAULT '08:00',
  end_time TIME NOT NULL DEFAULT '20:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_member_id, salon_id, day_of_week),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS team_member_hours_member_salon_idx
  ON public.team_member_hours(team_member_id, salon_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_member_hours TO authenticated;
GRANT ALL ON public.team_member_hours TO service_role;

ALTER TABLE public.team_member_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own team member hours" ON public.team_member_hours;
CREATE POLICY "own team member hours" ON public.team_member_hours FOR ALL TO authenticated
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

DROP TRIGGER IF EXISTS team_member_hours_updated ON public.team_member_hours;
CREATE TRIGGER team_member_hours_updated
  BEFORE UPDATE ON public.team_member_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
