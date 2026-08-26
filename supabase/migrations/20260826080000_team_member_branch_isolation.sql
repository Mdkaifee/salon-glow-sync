-- Ensure existing owner stylist records and unassigned team members are properly linked to branches

-- 1. Update owner stylists to have both 'salon_owner' and 'salon_stylist' roles
UPDATE public.team_members
SET
  roles = ARRAY['salon_owner', 'salon_stylist']::TEXT[],
  role_title = 'Salon Owner, Salon Stylist'
WHERE source = 'owner_stylist'
  AND (
    NOT (roles @> ARRAY['salon_owner']::TEXT[])
    OR NOT (roles @> ARRAY['salon_stylist']::TEXT[])
    OR role_title = 'Stylist'
  );

-- 2. Ensure any team members without an entry in team_member_branches are assigned to their owner's primary salon
INSERT INTO public.team_member_branches (team_member_id, salon_id)
SELECT tm.id, s.id
FROM public.team_members tm
JOIN public.salons s ON s.owner_id = tm.owner_id AND s.parent_id IS NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM public.team_member_branches tmb
  WHERE tmb.team_member_id = tm.id
)
ON CONFLICT (team_member_id, salon_id) DO NOTHING;
