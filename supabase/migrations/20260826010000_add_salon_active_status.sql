ALTER TABLE public.salons
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS salons_owner_active_idx
  ON public.salons(owner_id, is_active);
