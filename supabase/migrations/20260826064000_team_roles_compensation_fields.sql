-- Team setup role and compensation fields used by the web setup flow.

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT ARRAY['salon_stylist']::TEXT[],
  ADD COLUMN IF NOT EXISTS career_start_date DATE,
  ADD COLUMN IF NOT EXISTS pay_type TEXT NOT NULL DEFAULT 'monthly_salary'
    CHECK (pay_type IN ('monthly_salary', 'salary_commission', 'commission_only')),
  ADD COLUMN IF NOT EXISTS effective_from DATE,
  ADD COLUMN IF NOT EXISTS compensation_later BOOLEAN NOT NULL DEFAULT false;
