-- Presentation and pricing fields used by the package/deal creation flow.

ALTER TABLE public.salon_packages
  ADD COLUMN IF NOT EXISTS pricing_option TEXT NOT NULL DEFAULT 'fixed'
    CHECK (pricing_option IN ('discount', 'fixed')),
  ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offered_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'percentage'
    CHECK (discount_type IN ('percentage', 'fixed')),
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS terms TEXT,
  ADD COLUMN IF NOT EXISTS duration_count INT NOT NULL DEFAULT 1 CHECK (duration_count > 0),
  ADD COLUMN IF NOT EXISTS duration_unit TEXT NOT NULL DEFAULT 'month'
    CHECK (duration_unit IN ('day', 'week', 'month', 'year')),
  ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT 'all'
    CHECK (gender IN ('male', 'female', 'other', 'all'));

ALTER TABLE public.salon_deals
  ADD COLUMN IF NOT EXISTS pricing_option TEXT NOT NULL DEFAULT 'discount'
    CHECK (pricing_option IN ('discount', 'fixed')),
  ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offered_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS terms TEXT,
  ADD COLUMN IF NOT EXISTS duration_count INT NOT NULL DEFAULT 1 CHECK (duration_count > 0),
  ADD COLUMN IF NOT EXISTS duration_unit TEXT NOT NULL DEFAULT 'month'
    CHECK (duration_unit IN ('day', 'week', 'month', 'year')),
  ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT 'all'
    CHECK (gender IN ('male', 'female', 'other', 'all'));

UPDATE public.salon_packages
SET
  offered_price = CASE WHEN offered_price = 0 THEN package_price ELSE offered_price END,
  original_price = CASE WHEN original_price = 0 THEN package_price ELSE original_price END
WHERE package_price > 0;

UPDATE public.salon_deals
SET
  original_price = CASE WHEN original_price = 0 THEN discount_value ELSE original_price END,
  offered_price = CASE WHEN offered_price = 0 THEN discount_value ELSE offered_price END
WHERE discount_value > 0;
