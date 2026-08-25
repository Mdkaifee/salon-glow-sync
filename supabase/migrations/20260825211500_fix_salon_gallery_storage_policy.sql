-- Supabase Storage checks policies against the object path. The client stores
-- files as <authenticated-user-id>/<salon-id>/<file>, so permit only that
-- authenticated user's folder.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('salon-images', 'salon-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "authenticated salon gallery uploads" ON storage.objects;
DROP POLICY IF EXISTS "authenticated salon gallery delete" ON storage.objects;

CREATE POLICY "authenticated salon gallery uploads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'salon-images'
  AND (storage.foldername(name))[1] = (select auth.uid()::text)
);

CREATE POLICY "authenticated salon gallery delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'salon-images'
  AND (storage.foldername(name))[1] = (select auth.uid()::text)
);
