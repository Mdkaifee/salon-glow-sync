-- Incomplete staff profiles cannot receive branch or service assignments.
-- Existing records are brought into the same setup-required state as newly
-- created owner stylists and verified invitations.
UPDATE public.team_members
SET
  setup_required = true,
  invitation_status = 'setup_required'
WHERE invitation_status <> 'invited'
  AND (
    gender IS NULL
    OR gender = 'all'
    OR COALESCE(BTRIM(address), '') = ''
    OR career_start_date IS NULL
  );
