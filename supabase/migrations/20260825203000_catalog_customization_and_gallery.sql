-- Salon catalogues are copies of the global starter catalogue. Keeping these
-- fields on the salon records makes every imported item editable afterwards.
ALTER TABLE public.service_categories ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE public.service_categories
SET image_url = CASE slug
  WHEN 'hair' THEN 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=240&q=85'
  WHEN 'mens-grooming' THEN 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=240&q=85'
  WHEN 'facial' THEN 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=240&q=85'
  WHEN 'manicure-pedicure' THEN 'https://images.unsplash.com/photo-1610992015732-2449b76344bc?auto=format&fit=crop&w=240&q=85'
  WHEN 'nails' THEN 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=240&q=85'
  WHEN 'threading' THEN 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=240&q=85'
  WHEN 'massage' THEN 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=240&q=85'
  WHEN 'shave' THEN 'https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?auto=format&fit=crop&w=240&q=85'
  WHEN 'spa' THEN 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=240&q=85'
  WHEN 'makeup' THEN 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=240&q=85'
  WHEN 'body' THEN 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=240&q=85'
END
WHERE image_url IS NULL;

ALTER TABLE public.salon_categories
  ALTER COLUMN category_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS salon_categories_salon_id_category_id_key;
ALTER TABLE public.salon_categories
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS appointment_color TEXT NOT NULL DEFAULT 'blue',
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_predefined BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

UPDATE public.salon_categories sc
SET name = c.name,
    image_url = c.image_url,
    is_predefined = true,
    sort_order = c.sort_order
FROM public.service_categories c
WHERE sc.category_id = c.id AND sc.name IS NULL;
ALTER TABLE public.salon_categories ALTER COLUMN name SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS salon_categories_predefined_once
  ON public.salon_categories(salon_id, category_id) WHERE category_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.salon_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  salon_category_id UUID NOT NULL REFERENCES public.salon_categories(id) ON DELETE CASCADE,
  source_subcategory_id UUID REFERENCES public.service_subcategories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(salon_category_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salon_subcategories TO authenticated;
GRANT ALL ON public.salon_subcategories TO service_role;
ALTER TABLE public.salon_subcategories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own salon subcategories" ON public.salon_subcategories;
CREATE POLICY "own salon subcategories" ON public.salon_subcategories FOR ALL TO authenticated
  USING (public.owns_salon(salon_id)) WITH CHECK (public.owns_salon(salon_id));
DROP TRIGGER IF EXISTS salon_subcategories_updated ON public.salon_subcategories;
CREATE TRIGGER salon_subcategories_updated BEFORE UPDATE ON public.salon_subcategories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.salon_services
  ADD COLUMN IF NOT EXISTS salon_category_id UUID REFERENCES public.salon_categories(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS salon_subcategory_id UUID REFERENCES public.salon_subcategories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS salon_services_salon_category_idx ON public.salon_services(salon_id, salon_category_id);

CREATE TABLE IF NOT EXISTS public.salon_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salon_images TO authenticated;
GRANT ALL ON public.salon_images TO service_role;
ALTER TABLE public.salon_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own salon images" ON public.salon_images;
CREATE POLICY "own salon images" ON public.salon_images FOR ALL TO authenticated
  USING (public.owns_salon(salon_id)) WITH CHECK (public.owns_salon(salon_id));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('salon-images', 'salon-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];
-- Storage object ownership is represented differently across Supabase
-- versions. Authorise the folder convention used by the app instead.
DROP POLICY IF EXISTS "authenticated salon gallery uploads" ON storage.objects;
CREATE POLICY "authenticated salon gallery uploads" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'salon-images'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );
DROP POLICY IF EXISTS "authenticated salon gallery delete" ON storage.objects;
CREATE POLICY "authenticated salon gallery delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'salon-images'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );
