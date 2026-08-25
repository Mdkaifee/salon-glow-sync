-- Ensure every predefined category offers at least five searchable service types.
-- The inserts are idempotent, so this safely upgrades databases that already
-- contain the original starter catalogue.

INSERT INTO public.service_subcategories (category_id, name, sort_order)
SELECT category.id, seed.name, seed.sort_order
FROM public.service_categories AS category
JOIN (
  VALUES
    ('Hair', 'Curling & Perming', 4),
    ('Hair', 'Hair Extensions', 5),
    ('Facial', 'Hydrating Facial', 3),
    ('Facial', 'Anti-Aging Facial', 4),
    ('Facial', 'Acne Treatment', 5),
    ('Manicure & Pedicure', 'Nail Care', 3),
    ('Manicure & Pedicure', 'Gel Manicure', 4),
    ('Manicure & Pedicure', 'Foot Care', 5),
    ('Nails', 'Nail Repair', 3),
    ('Nails', 'Nail Polish', 4),
    ('Nails', 'Nail Removal', 5),
    ('Threading', 'Eyebrow Shaping', 3),
    ('Threading', 'Upper Lip Threading', 4),
    ('Threading', 'Body Threading', 5),
    ('Massage', 'Deep Tissue Massage', 3),
    ('Massage', 'Aromatherapy Massage', 4),
    ('Massage', 'Foot Massage', 5),
    ('Shave', 'Beard Shaping', 2),
    ('Shave', 'Hot Towel Shave', 3),
    ('Shave', 'Head Shave', 4),
    ('Shave', 'Luxury Shave', 5),
    ('Spa', 'Hair Spa', 3),
    ('Spa', 'Detox Spa', 4),
    ('Spa', 'Couple Spa', 5),
    ('Makeup', 'Engagement Makeup', 3),
    ('Makeup', 'Reception Makeup', 4),
    ('Makeup', 'Eye Makeup', 5),
    ('Body', 'Body Scrub', 3),
    ('Body', 'Back Treatment', 4),
    ('Body', 'Body Contouring', 5)
) AS seed(category_name, name, sort_order)
  ON seed.category_name = category.name
ON CONFLICT (category_id, name) DO NOTHING;

INSERT INTO public.services (subcategory_id, name, default_price, default_duration_mins)
SELECT subcategory.id, seed.name, seed.default_price, seed.default_duration_mins
FROM public.service_categories AS category
JOIN public.service_subcategories AS subcategory ON subcategory.category_id = category.id
JOIN (
  VALUES
    ('Hair', 'Curling & Perming', 'Soft Curls', 1499, 75),
    ('Hair', 'Hair Extensions', 'Hair Extension Consultation', 499, 30),
    ('Facial', 'Hydrating Facial', 'Hydra Glow Facial', 1299, 60),
    ('Facial', 'Anti-Aging Facial', 'Collagen Renewal Facial', 1799, 75),
    ('Facial', 'Acne Treatment', 'Clarifying Acne Facial', 1199, 60),
    ('Manicure & Pedicure', 'Nail Care', 'Nail Strengthening Treatment', 399, 30),
    ('Manicure & Pedicure', 'Gel Manicure', 'Classic Gel Manicure', 799, 45),
    ('Manicure & Pedicure', 'Foot Care', 'Foot Care Ritual', 699, 45),
    ('Nails', 'Nail Repair', 'Single Nail Repair', 149, 20),
    ('Nails', 'Nail Polish', 'Classic Nail Polish', 299, 25),
    ('Nails', 'Nail Removal', 'Gel Nail Removal', 399, 30),
    ('Threading', 'Eyebrow Shaping', 'Eyebrow Shaping', 99, 20),
    ('Threading', 'Upper Lip Threading', 'Upper Lip Threading', 49, 10),
    ('Threading', 'Body Threading', 'Full Face Threading', 299, 35),
    ('Massage', 'Deep Tissue Massage', 'Deep Tissue Massage', 2499, 75),
    ('Massage', 'Aromatherapy Massage', 'Aromatherapy Massage', 2199, 60),
    ('Massage', 'Foot Massage', 'Relaxing Foot Massage', 799, 30),
    ('Shave', 'Beard Shaping', 'Precision Beard Shaping', 249, 25),
    ('Shave', 'Hot Towel Shave', 'Classic Hot Towel Shave', 349, 30),
    ('Shave', 'Head Shave', 'Head Shave', 299, 25),
    ('Shave', 'Luxury Shave', 'Luxury Shave Ritual', 599, 45),
    ('Spa', 'Hair Spa', 'Nourishing Hair Spa', 1099, 60),
    ('Spa', 'Detox Spa', 'Detox Body Spa', 2799, 90),
    ('Spa', 'Couple Spa', 'Couple Relaxation Spa', 4999, 120),
    ('Makeup', 'Engagement Makeup', 'Engagement Makeup', 4499, 90),
    ('Makeup', 'Reception Makeup', 'Reception Makeup', 5999, 120),
    ('Makeup', 'Eye Makeup', 'Signature Eye Makeup', 1499, 45),
    ('Body', 'Body Scrub', 'Full Body Scrub', 1499, 60),
    ('Body', 'Back Treatment', 'Back Cleansing Treatment', 1199, 45),
    ('Body', 'Body Contouring', 'Body Contouring Session', 2999, 75)
) AS seed(category_name, subcategory_name, name, default_price, default_duration_mins)
  ON seed.category_name = category.name
 AND seed.subcategory_name = subcategory.name
ON CONFLICT (subcategory_id, name) DO NOTHING;

-- Give each salon its own editable copy of the selected predefined
-- subcategories. Existing services continue to reference the source records,
-- while the app resolves them through these branch-owned rows.
INSERT INTO public.salon_subcategories (
  salon_id,
  salon_category_id,
  source_subcategory_id,
  name,
  sort_order
)
SELECT
  salon_category.salon_id,
  salon_category.id,
  source_subcategory.id,
  source_subcategory.name,
  source_subcategory.sort_order
FROM public.salon_categories AS salon_category
JOIN public.service_subcategories AS source_subcategory
  ON source_subcategory.category_id = salon_category.category_id
WHERE salon_category.category_id IS NOT NULL
ON CONFLICT (salon_category_id, name) DO NOTHING;

-- Add a full five-service starter range to every seeded subcategory. Some
-- subcategories already have a matching Classic service; the existing service
-- plus the remaining variants still leaves each subcategory with at least five.
INSERT INTO public.services (subcategory_id, name, default_price, default_duration_mins)
SELECT
  subcategory.id,
  CONCAT(template.name_prefix, ' ', subcategory.name),
  template.default_price,
  template.default_duration_mins
FROM public.service_subcategories AS subcategory
CROSS JOIN (
  VALUES
    ('Essential', 299, 30),
    ('Classic', 499, 45),
    ('Signature', 799, 60),
    ('Deluxe', 1199, 75),
    ('Premium', 1599, 90)
) AS template(name_prefix, default_price, default_duration_mins)
ON CONFLICT (subcategory_id, name) DO NOTHING;
