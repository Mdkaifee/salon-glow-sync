ALTER TABLE public.salon_services
  ADD COLUMN IF NOT EXISTS passive_wait_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS busy_start_mins INT,
  ADD COLUMN IF NOT EXISTS passive_wait_mins INT,
  ADD COLUMN IF NOT EXISTS busy_end_mins INT;

ALTER TABLE public.salon_services
  DROP CONSTRAINT IF EXISTS salon_services_passive_wait_duration_check;

ALTER TABLE public.salon_services
  ADD CONSTRAINT salon_services_passive_wait_duration_check CHECK (
    (NOT passive_wait_enabled AND busy_start_mins IS NULL AND passive_wait_mins IS NULL AND busy_end_mins IS NULL)
    OR (
      passive_wait_enabled
      AND busy_start_mins >= 1
      AND passive_wait_mins >= 0
      AND busy_end_mins >= 1
      AND busy_start_mins + passive_wait_mins + busy_end_mins = duration_mins
    )
  ) NOT VALID;
