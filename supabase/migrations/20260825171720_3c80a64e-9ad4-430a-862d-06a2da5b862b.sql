-- Utility
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  phone TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  profile_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PHONE OTP (server only)
CREATE TABLE public.phone_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX phone_otps_phone_idx ON public.phone_otps (phone, created_at DESC);
GRANT ALL ON public.phone_otps TO service_role;
ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;

-- SERVICE CATALOG (public reference data)
CREATE TABLE public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE TABLE public.service_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (category_id, name)
);
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id UUID NOT NULL REFERENCES public.service_subcategories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  default_duration_mins INT NOT NULL DEFAULT 30,
  UNIQUE (subcategory_id, name)
);
GRANT SELECT ON public.service_categories, public.service_subcategories, public.services TO anon, authenticated;
GRANT ALL ON public.service_categories, public.service_subcategories, public.services TO service_role;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog public read" ON public.service_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "catalog public read" ON public.service_subcategories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "catalog public read" ON public.services FOR SELECT TO anon, authenticated USING (true);

-- SALONS
CREATE TABLE public.salons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  parent_id UUID REFERENCES public.salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  open_time TIME NOT NULL DEFAULT '08:00',
  close_time TIME NOT NULL DEFAULT '20:00',
  is_stylist BOOLEAN NOT NULL DEFAULT false,
  address TEXT,
  house_no TEXT,
  street TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  about TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salons TO authenticated;
GRANT ALL ON public.salons TO service_role;
ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own salons" ON public.salons FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER salons_updated BEFORE UPDATE ON public.salons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.owns_salon(_salon_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.salons s WHERE s.id = _salon_id AND s.owner_id = auth.uid());
$$;

CREATE TABLE public.salon_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_open BOOLEAN NOT NULL DEFAULT true,
  open_time TIME NOT NULL DEFAULT '08:00',
  close_time TIME NOT NULL DEFAULT '20:00',
  UNIQUE (salon_id, day_of_week)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salon_hours TO authenticated;
GRANT ALL ON public.salon_hours TO service_role;
ALTER TABLE public.salon_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own salon hours" ON public.salon_hours FOR ALL TO authenticated
  USING (public.owns_salon(salon_id)) WITH CHECK (public.owns_salon(salon_id));

CREATE TABLE public.salon_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  UNIQUE (salon_id, category_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salon_categories TO authenticated;
GRANT ALL ON public.salon_categories TO service_role;
ALTER TABLE public.salon_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own salon categories" ON public.salon_categories FOR ALL TO authenticated
  USING (public.owns_salon(salon_id)) WITH CHECK (public.owns_salon(salon_id));

CREATE TABLE public.salon_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.service_subcategories(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_mins INT NOT NULL DEFAULT 30,
  description TEXT,
  commission_type TEXT NOT NULL DEFAULT 'Percentage',
  commission_value NUMERIC(10,2) NOT NULL DEFAULT 5,
  max_amount NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salon_services TO authenticated;
GRANT ALL ON public.salon_services TO service_role;
ALTER TABLE public.salon_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own salon services" ON public.salon_services FOR ALL TO authenticated
  USING (public.owns_salon(salon_id)) WITH CHECK (public.owns_salon(salon_id));
CREATE TRIGGER salon_services_updated BEFORE UPDATE ON public.salon_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SEED CATALOG
INSERT INTO public.service_categories (name, slug, sort_order) VALUES
 ('Hair','hair',1), ('Men''s Grooming','mens-grooming',2), ('Facial','facial',3),
 ('Manicure & Pedicure','manicure-pedicure',4), ('Nails','nails',5), ('Threading','threading',6),
 ('Massage','massage',7), ('Shave','shave',8), ('Spa','spa',9), ('Makeup','makeup',10), ('Body','body',11);

INSERT INTO public.service_subcategories (category_id, name, sort_order)
SELECT c.id, s.name, s.ord FROM public.service_categories c
JOIN (VALUES
 ('Hair','Haircut & Styling',1),('Hair','Color & Treatment',2),('Hair','Hair Spa',3),
 ('Men''s Grooming','Beard & Shaving',1),('Men''s Grooming','Color & Treatment',2),('Men''s Grooming','Face & Skin',3),('Men''s Grooming','Haircut & Styling',4),('Men''s Grooming','Massage',5),('Men''s Grooming','Packages',6),
 ('Facial','Clean Up',1),('Facial','Advanced Facial',2),
 ('Manicure & Pedicure','Manicure',1),('Manicure & Pedicure','Pedicure',2),
 ('Nails','Nail Extensions',1),('Nails','Nail Art',2),
 ('Threading','Face Threading',1),('Threading','Waxing',2),
 ('Massage','Body Massage',1),('Massage','Head Massage',2),
 ('Shave','Classic Shave',1),
 ('Spa','Body Spa',1),('Spa','Foot Spa',2),
 ('Makeup','Party Makeup',1),('Makeup','Bridal Makeup',2),
 ('Body','Body Polishing',1),('Body','Body Wraps',2)
) AS s(cat, name, ord) ON s.cat = c.name;

INSERT INTO public.services (subcategory_id, name, default_price, default_duration_mins)
SELECT sc.id, v.name, v.price, v.mins
FROM public.service_subcategories sc
JOIN public.service_categories c ON c.id = sc.category_id
JOIN (VALUES
 ('Men''s Grooming','Beard & Shaving','Beard Trim',149,15),
 ('Men''s Grooming','Beard & Shaving','Beard Color / Tint',299,30),
 ('Men''s Grooming','Beard & Shaving','Beard Styling & Shaping',249,20),
 ('Men''s Grooming','Beard & Shaving','Beard Color',299,25),
 ('Men''s Grooming','Color & Treatment','Anti-Hairfall Treatment',999,45),
 ('Men''s Grooming','Color & Treatment','Global Hair Color',1299,60),
 ('Men''s Grooming','Face & Skin','Charcoal Facial',899,60),
 ('Men''s Grooming','Face & Skin','Express Face Massage',249,15),
 ('Men''s Grooming','Haircut & Styling','Classic Haircut',249,30),
 ('Men''s Grooming','Haircut & Styling','Hair Wash & Blow Dry',199,20),
 ('Men''s Grooming','Massage','Head Massage',299,20),
 ('Men''s Grooming','Packages','Complete Grooming Package',1599,110),
 ('Hair','Haircut & Styling','Ladies Haircut',599,45),
 ('Hair','Haircut & Styling','Blow Dry',399,30),
 ('Hair','Color & Treatment','Root Touch Up',999,45),
 ('Hair','Color & Treatment','Keratin Treatment',3999,120),
 ('Hair','Hair Spa','Hair Spa Basic',899,45),
 ('Facial','Clean Up','Fruit Clean Up',599,30),
 ('Facial','Advanced Facial','Gold Facial',1499,60),
 ('Manicure & Pedicure','Manicure','Classic Manicure',499,30),
 ('Manicure & Pedicure','Pedicure','Classic Pedicure',599,40),
 ('Nails','Nail Extensions','Acrylic Extensions',1999,90),
 ('Nails','Nail Art','Nail Art (per nail)',99,10),
 ('Threading','Face Threading','Eyebrow Threading',49,10),
 ('Threading','Waxing','Full Arms Wax',399,30),
 ('Massage','Body Massage','Swedish Massage',1999,60),
 ('Massage','Head Massage','Oil Head Massage',399,30),
 ('Shave','Classic Shave','Classic Razor Shave',199,20),
 ('Spa','Body Spa','Aroma Body Spa',2499,75),
 ('Spa','Foot Spa','Foot Spa Ritual',799,40),
 ('Makeup','Party Makeup','Party Makeup',2499,60),
 ('Makeup','Bridal Makeup','Bridal Makeup HD',9999,150),
 ('Body','Body Polishing','Full Body Polishing',2999,90),
 ('Body','Body Wraps','Detox Body Wrap',2499,75)
) AS v(cat, sub, name, price, mins) ON v.cat = c.name AND v.sub = sc.name;