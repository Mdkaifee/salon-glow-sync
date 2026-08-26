-- Draft/active/inactive lifecycle for packages and deals.

ALTER TABLE public.salon_packages
  ADD COLUMN IF NOT EXISTS status TEXT
    CHECK (status IN ('draft', 'active', 'inactive'));

UPDATE public.salon_packages
SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END
WHERE status IS NULL;

ALTER TABLE public.salon_packages
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.salon_deals
  ADD COLUMN IF NOT EXISTS status TEXT
    CHECK (status IN ('draft', 'active', 'inactive'));

UPDATE public.salon_deals
SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END
WHERE status IS NULL;

ALTER TABLE public.salon_deals
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN status SET NOT NULL;

CREATE INDEX IF NOT EXISTS salon_packages_salon_status_idx
  ON public.salon_packages(salon_id, status);

CREATE INDEX IF NOT EXISTS salon_deals_salon_status_idx
  ON public.salon_deals(salon_id, status);
