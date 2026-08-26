-- Verified invited team members are active staff while setup is still pending.

UPDATE public.team_members
SET is_active = true
WHERE invitation_status = 'setup_required'
  AND setup_required = true
  AND is_active = false;
