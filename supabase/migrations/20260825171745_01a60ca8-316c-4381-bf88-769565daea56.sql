REVOKE EXECUTE ON FUNCTION public.owns_salon(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_salon(UUID) TO authenticated, service_role;