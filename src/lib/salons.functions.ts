import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createSalonSchema, updateSalonSchema } from "./validation";

const id = z.string().uuid();
const salonId = z.object({ salonId: id });
const categoryInput = z.object({ salonId: id, name: z.string().trim().min(2).max(80), description: z.string().trim().max(100).nullable().optional(), appointmentColor: z.string().trim().max(32) });
const subcategoryInput = z.object({ salonId: id, salonCategoryId: id, name: z.string().trim().min(2).max(80), description: z.string().trim().max(100).nullable().optional() });
const serviceInput = z.object({ salonId: id, id: id.optional(), salonCategoryId: id, salonSubcategoryId: id.nullable().optional(), sourceSubcategoryId: id.nullable().optional(), name: z.string().trim().min(2).max(120), description: z.string().trim().max(300).nullable().optional(), price: z.number().min(0).max(10000000), durationMins: z.number().int().min(1).max(1440), commissionType: z.enum(["percentage", "fixed"]), commissionValue: z.number().min(0).max(10000000), maxAmount: z.number().min(0).max(10000000).nullable().optional() });

// A client-safe fallback means the category picker keeps working even while a
// newly deployed Supabase migration is still being applied.
const CATEGORY_IMAGES: Record<string, string> = {
  hair: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=240&q=85",
  "mens-grooming": "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=240&q=85",
  facial: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=240&q=85",
  "manicure-pedicure": "https://images.unsplash.com/photo-1610992015732-2449b76344bc?auto=format&fit=crop&w=240&q=85",
  nails: "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=240&q=85",
  threading: "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=240&q=85",
  massage: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=240&q=85",
  shave: "https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?auto=format&fit=crop&w=240&q=85",
  spa: "https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=240&q=85",
  makeup: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=240&q=85",
  body: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=240&q=85",
};

/** Copies only global starter data into the salon-owned, editable tables. */
async function seedPredefinedCatalog(supabase: any, salonIdValue: string, selectedIds: string[]) {
  const withImages = await supabase.from("service_categories").select("id, name, slug, image_url, sort_order").in("id", selectedIds);
  const fallback = withImages.error
    ? await supabase.from("service_categories").select("id, name, slug, sort_order").in("id", selectedIds)
    : null;
  const sourceCategories = (withImages.error ? fallback?.data : withImages.data) ?? [];
  if ((withImages.error && fallback?.error) || sourceCategories.length !== selectedIds.length) {
    throw new Error("Could not load the selected predefined services. Please refresh the page and select the categories again.");
  }
  const categoryRows = sourceCategories.map((category: any) => ({
    salon_id: salonIdValue,
    category_id: category.id,
    name: category.name,
    image_url: category.image_url ?? CATEGORY_IMAGES[category.slug] ?? null,
    is_predefined: true,
    sort_order: category.sort_order,
  }));
  let categoryInsert = await supabase
    .from("salon_categories")
    .insert(categoryRows)
    .select("id, category_id");

  // A connected project that has not yet run the catalogue migration only has
  // `salon_id` and `category_id`. Fall back only for that schema mismatch.
  if (categoryInsert.error && /column|schema cache|image_url|is_predefined|sort_order|name/i.test(categoryInsert.error.message ?? "")) {
    categoryInsert = await supabase
      .from("salon_categories")
      .insert(sourceCategories.map((category: any) => ({ salon_id: salonIdValue, category_id: category.id })))
      .select("id, category_id");
  }
  const { data: categories, error: categoriesError } = categoryInsert;
  if (categoriesError || !categories) {
    throw new Error(`Could not save the selected services${categoriesError?.message ? `: ${categoriesError.message}` : "."}`);
  }
  const categoryMap = new Map(categories.map((c: any) => [c.category_id, c.id]));
  const { data: sourceSubs, error: sourceSubError } = await supabase.from("service_subcategories").select("id, category_id, name, sort_order").in("category_id", selectedIds);
  if (sourceSubError) throw new Error("Could not load predefined subcategories.");
  const subIds = (sourceSubs ?? []).map((s: any) => s.id);
  if (!subIds.length) return;
  const { data: sourceServices, error: sourceServiceError } = await supabase.from("services").select("id, name, default_price, default_duration_mins, subcategory_id").in("subcategory_id", subIds);
  if (sourceServiceError) throw new Error("Could not load predefined services.");
  const sourceSubMap = new Map<string, any>((sourceSubs ?? []).map((s: any) => [s.id, s]));
  const rows = (sourceServices ?? []).map((s: any) => {
    return { salon_id: salonIdValue, service_id: s.id, category_id: sourceSubMap.get(s.subcategory_id)?.category_id, subcategory_id: s.subcategory_id, name: s.name, price: s.default_price, duration_mins: s.default_duration_mins, commission_type: "Percentage", commission_value: 5, max_amount: null };
  });
  if (rows.length) {
    const { error } = await supabase.from("salon_services").insert(rows);
    if (error) throw new Error("Could not set up the salon catalog.");
  }
}

export const listServiceCategories = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const withImages = await context.supabase.from("service_categories").select("id, name, slug, sort_order, image_url").order("sort_order");
  if (!withImages.error) return (withImages.data ?? []).map((category) => ({ ...category, image_url: category.image_url ?? CATEGORY_IMAGES[category.slug] ?? null }));
  // `image_url` is introduced by the latest migration. Do not hide all
  // predefined services if deployment reaches the app before the migration.
  const fallback = await context.supabase.from("service_categories").select("id, name, slug, sort_order").order("sort_order");
  if (fallback.error) throw new Error("Could not load service categories.");
  return (fallback.data ?? []).map((category) => ({ ...category, image_url: CATEGORY_IMAGES[category.slug] ?? null }));
});

export const listSalons = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const activeQuery = await context.supabase.from("salons").select("id, name, phone, parent_id, address, house_no, street, about, open_time, close_time, is_active, is_stylist, latitude, longitude, created_at").order("created_at", { ascending: true });
  if (!activeQuery.error) return activeQuery.data ?? [];
  const legacyQuery = await context.supabase.from("salons").select("id, name, phone, parent_id, address, house_no, street, about, open_time, close_time, is_stylist, latitude, longitude, created_at").order("created_at", { ascending: true });
  if (legacyQuery.error) throw new Error("Could not load your salons.");
  return (legacyQuery.data ?? []).map((salon) => ({ ...salon, is_active: true }));
});

export const getSalonHours = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((input: { salonId: string }) => salonId.parse(input)).handler(async ({ data, context }) => {
  const { data: hours, error } = await context.supabase.from("salon_hours").select("day_of_week, is_open, open_time, close_time").eq("salon_id", data.salonId).order("day_of_week");
  if (error) throw new Error("Could not load working hours.");
  return hours ?? [];
});

export const createSalon = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => createSalonSchema.parse(input)).handler(async ({ data, context }) => {
  const { data: salon, error } = await context.supabase.from("salons").insert({ owner_id: context.userId, parent_id: data.parentId ?? null, name: data.name, phone: data.phone, open_time: data.openTime, close_time: data.closeTime, is_stylist: data.isStylist, address: data.address, house_no: data.houseNo || null, street: data.street || null, about: data.about, latitude: data.latitude ?? null, longitude: data.longitude ?? null }).select("id").single();
  if (error || !salon) throw new Error("Could not save the salon. Please try again.");
  const { error: hoursError } = await context.supabase.from("salon_hours").insert(data.hours.map((h) => ({ salon_id: salon.id, day_of_week: h.dayOfWeek, is_open: h.isOpen, open_time: h.openTime, close_time: h.closeTime })));
  if (hoursError) throw new Error("Could not save the working hours.");
  try {
    await seedPredefinedCatalog(context.supabase, salon.id, data.categoryIds);
  } catch (seedError) {
    // Avoid leaving an incomplete salon/branch behind when its starter catalog
    // cannot be created. Related hours and partial catalog rows cascade.
    await context.supabase.from("salons").delete().eq("id", salon.id);
    throw seedError;
  }
  return { id: salon.id };
});

export const updateSalon = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => updateSalonSchema.parse(input)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("salons").update({ name: data.name, phone: data.phone, open_time: data.openTime, close_time: data.closeTime, is_stylist: data.isStylist, address: data.address, house_no: data.houseNo || null, street: data.street || null, about: data.about, latitude: data.latitude ?? null, longitude: data.longitude ?? null }).eq("id", data.id);
  if (error) throw new Error("Could not update the salon.");
  for (const h of data.hours) {
    const { error: hourError } = await context.supabase.from("salon_hours").upsert({ salon_id: data.id, day_of_week: h.dayOfWeek, is_open: h.isOpen, open_time: h.openTime, close_time: h.closeTime }, { onConflict: "salon_id,day_of_week" });
    if (hourError) throw new Error("Could not update working hours.");
  }
  return { ok: true };
});

export const deleteSalon = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: { id: string }) => z.object({ id }).parse(input)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("salons").delete().eq("id", data.id);
  if (error) throw new Error("Could not delete the salon.");
  return { ok: true };
});

export const setSalonActiveStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id, isActive: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("salons").update({ is_active: data.isActive }).eq("id", data.id);
    if (error) throw new Error("Could not update the salon status.");
    return { ok: true };
  });

export const getSalonCatalog = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((input: { salonId: string }) => salonId.parse(input)).handler(async ({ data, context }) => {
  const [{ data: categories, error: categoryError }, { data: subcategories, error: subError }, { data: services, error: serviceError }] = await Promise.all([
    context.supabase.from("salon_categories").select("id, category_id, name, description, appointment_color, image_url, is_predefined, sort_order").eq("salon_id", data.salonId).order("sort_order"),
    context.supabase.from("salon_subcategories").select("id, salon_category_id, source_subcategory_id, name, description, sort_order").eq("salon_id", data.salonId).order("sort_order"),
    context.supabase.from("salon_services").select("id, name, price, duration_mins, description, commission_type, commission_value, max_amount, category_id, subcategory_id, salon_category_id, salon_subcategory_id").eq("salon_id", data.salonId).order("name"),
  ]);
  // Fall back to the original catalogue schema until the current Supabase
  // migrations have been applied. This keeps newly created salons usable.
  if (categoryError || subError || serviceError) {
    const [{ data: legacyCategories, error: legacyCategoryError }, { data: legacyServices, error: legacyServiceError }] = await Promise.all([
      context.supabase.from("salon_categories").select("category_id, service_categories!inner(id, name, slug, sort_order)").eq("salon_id", data.salonId),
      context.supabase.from("salon_services").select("id, name, price, duration_mins, description, commission_type, commission_value, max_amount, category_id, subcategory_id, service_subcategories(name)").eq("salon_id", data.salonId).order("name"),
    ]);
    if (legacyCategoryError || legacyServiceError) throw new Error("Could not load this salon catalog.");
    const legacyCategoryMap = new Map((legacyCategories ?? []).map((row: any) => [row.category_id, row.service_categories]));
    return {
      categories: (legacyCategories ?? []).map((row: any) => {
        const category = row.service_categories as { id: string; name: string; slug: string; sort_order: number };
        return { id: category.id, sourceCategoryId: category.id, name: category.name, description: null, appointmentColor: "blue", imageUrl: CATEGORY_IMAGES[category.slug] ?? null, isPredefined: true, sortOrder: category.sort_order };
      }),
      subcategories: [],
      services: (legacyServices ?? []).map((service: any) => ({
        id: service.id,
        name: service.name,
        price: Number(service.price),
        durationMins: service.duration_mins,
        description: service.description,
        commissionType: String(service.commission_type).toLowerCase() === "fixed" ? "fixed" : "percentage",
        commissionValue: Number(service.commission_value),
        maxAmount: service.max_amount === null ? null : Number(service.max_amount),
        categoryId: service.category_id,
        subcategoryId: service.subcategory_id,
        subcategoryName: (service.service_subcategories as { name: string } | null)?.name ?? "Other",
      })),
    };
  }
  const sourceCategoryIds = (categories ?? []).flatMap((c) => c.category_id ? [c.category_id] : []);
  const sourceSubIds = (services ?? []).flatMap((s) => s.subcategory_id ? [s.subcategory_id] : []);
  const [{ data: sourceCategories }, { data: sourceSubs }] = await Promise.all([
    sourceCategoryIds.length ? context.supabase.from("service_categories").select("id, image_url").in("id", sourceCategoryIds) : Promise.resolve({ data: [] as any[] }),
    sourceSubIds.length ? context.supabase.from("service_subcategories").select("id, category_id, name, sort_order").in("id", sourceSubIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const catBySource = new Map((categories ?? []).flatMap((c) => c.category_id ? [[c.category_id, c.id] as const] : []));
  const sourceCatById = new Map((sourceCategories ?? []).map((c) => [c.id, c]));
  const localSubBySource = new Map((subcategories ?? []).flatMap((s) => s.source_subcategory_id ? [[s.source_subcategory_id, s] as const] : []));
  const sourceSubById = new Map((sourceSubs ?? []).map((s) => [s.id, s]));
  const inheritedSubs = (sourceSubs ?? []).filter((s) => !localSubBySource.has(s.id)).map((s) => ({ id: s.id, salonCategoryId: catBySource.get(s.category_id), sourceSubcategoryId: s.id, name: s.name, description: null, sortOrder: s.sort_order, isPredefined: true }));
  return {
    categories: (categories ?? []).map((c) => ({ id: c.id, sourceCategoryId: c.category_id, name: c.name, description: c.description, appointmentColor: c.appointment_color, imageUrl: c.image_url ?? sourceCatById.get(c.category_id ?? "")?.image_url ?? null, isPredefined: c.is_predefined, sortOrder: c.sort_order })),
    subcategories: [...(subcategories ?? []).map((s) => ({ id: s.id, salonCategoryId: s.salon_category_id, sourceSubcategoryId: s.source_subcategory_id, name: s.name, description: s.description, sortOrder: s.sort_order, isPredefined: Boolean(s.source_subcategory_id) })), ...inheritedSubs],
    services: (services ?? []).map((s) => ({ id: s.id, name: s.name, price: Number(s.price), durationMins: s.duration_mins, description: s.description, commissionType: s.commission_type === "fixed" ? "fixed" : "percentage", commissionValue: Number(s.commission_value), maxAmount: s.max_amount === null ? null : Number(s.max_amount), categoryId: s.salon_category_id ?? catBySource.get(s.category_id ?? "") ?? null, subcategoryId: s.salon_subcategory_id ?? s.subcategory_id, subcategoryName: s.salon_subcategory_id ? (subcategories ?? []).find((sub) => sub.id === s.salon_subcategory_id)?.name ?? "Other" : sourceSubById.get(s.subcategory_id ?? "")?.name ?? "Other" })),
  };
});

export const replaceSalonPredefinedCatalog = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: { salonId: string; categoryIds: string[] }) => z.object({ salonId: id, categoryIds: z.array(id).min(1) }).parse(input)).handler(async ({ data, context }) => {
  const { error: servicesError } = await context.supabase.from("salon_services").delete().eq("salon_id", data.salonId);
  if (servicesError) throw new Error("Could not reset the current services.");
  const { error: categoriesError } = await context.supabase.from("salon_categories").delete().eq("salon_id", data.salonId);
  if (categoriesError) throw new Error("Could not reset the current categories.");
  await seedPredefinedCatalog(context.supabase, data.salonId, data.categoryIds);
  return { ok: true };
});

export const createCatalogCategory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => categoryInput.parse(input)).handler(async ({ data, context }) => {
  const { data: last } = await context.supabase.from("salon_categories").select("sort_order").eq("salon_id", data.salonId).order("sort_order", { ascending: false }).limit(1);
  const { error } = await context.supabase.from("salon_categories").insert({ salon_id: data.salonId, name: data.name, description: data.description || null, appointment_color: data.appointmentColor, is_predefined: false, sort_order: (last?.[0]?.sort_order ?? 0) + 1 });
  if (error) throw new Error("Could not add category. It may already exist.");
  return { ok: true };
});
export const updateCatalogCategory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => categoryInput.extend({ id }).parse(input)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("salon_categories").update({ name: data.name, description: data.description || null, appointment_color: data.appointmentColor }).eq("id", data.id).eq("salon_id", data.salonId);
  if (error) throw new Error("Could not update category.");
  return { ok: true };
});
export const deleteCatalogCategory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ salonId: id, id }).parse(input)).handler(async ({ data, context }) => {
  const { data: category, error: lookupError } = await context.supabase.from("salon_categories").select("category_id").eq("id", data.id).eq("salon_id", data.salonId).single();
  if (lookupError || !category) throw new Error("Could not find category.");
  const { error: localServiceError } = await context.supabase.from("salon_services").delete().eq("salon_id", data.salonId).eq("salon_category_id", data.id);
  if (localServiceError) throw new Error("Could not remove category services.");
  if (category.category_id) {
    const { error: legacyServiceError } = await context.supabase.from("salon_services").delete().eq("salon_id", data.salonId).eq("category_id", category.category_id);
    if (legacyServiceError) throw new Error("Could not remove category services.");
  }
  const { error } = await context.supabase.from("salon_categories").delete().eq("id", data.id).eq("salon_id", data.salonId);
  if (error) throw new Error("Could not delete category.");
  return { ok: true };
});
export const createCatalogSubcategory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => subcategoryInput.parse(input)).handler(async ({ data, context }) => {
  const { data: last } = await context.supabase.from("salon_subcategories").select("sort_order").eq("salon_category_id", data.salonCategoryId).order("sort_order", { ascending: false }).limit(1);
  const { error } = await context.supabase.from("salon_subcategories").insert({ salon_id: data.salonId, salon_category_id: data.salonCategoryId, name: data.name, description: data.description || null, sort_order: (last?.[0]?.sort_order ?? 0) + 1 });
  if (error) throw new Error("Could not add subcategory. It may already exist.");
  return { ok: true };
});
export const updateCatalogSubcategory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => subcategoryInput.extend({ id }).parse(input)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("salon_subcategories").update({ name: data.name, description: data.description || null }).eq("id", data.id).eq("salon_id", data.salonId);
  if (error) throw new Error("Could not update subcategory.");
  return { ok: true };
});
export const deleteCatalogSubcategory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ salonId: id, id }).parse(input)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("salon_subcategories").delete().eq("id", data.id).eq("salon_id", data.salonId);
  if (error) throw new Error("Could not delete subcategory.");
  return { ok: true };
});
export const saveCatalogService = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => serviceInput.parse(input)).handler(async ({ data, context }) => {
  const row = { salon_category_id: data.salonCategoryId, salon_subcategory_id: data.salonSubcategoryId ?? null, subcategory_id: data.sourceSubcategoryId ?? null, name: data.name, description: data.description || null, price: data.price, duration_mins: data.durationMins, commission_type: data.commissionType, commission_value: data.commissionValue, max_amount: data.maxAmount ?? null };
  const result = data.id ? await context.supabase.from("salon_services").update(row).eq("id", data.id).eq("salon_id", data.salonId) : await context.supabase.from("salon_services").insert({ ...row, salon_id: data.salonId });
  if (result.error) throw new Error(data.id ? "Could not update service." : "Could not add service.");
  return { ok: true };
});
export const deleteCatalogService = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ salonId: id, id }).parse(input)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("salon_services").delete().eq("id", data.id).eq("salon_id", data.salonId);
  if (error) throw new Error("Could not delete service.");
  return { ok: true };
});

export const listSalonImages = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((input: { salonId: string }) => salonId.parse(input)).handler(async ({ data, context }) => {
  const { data: images, error } = await context.supabase.from("salon_images").select("id, public_url, storage_path, sort_order").eq("salon_id", data.salonId).order("sort_order");
  if (error) throw new Error("Could not load salon photos.");
  return images ?? [];
});
export const saveSalonImage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ salonId: id, storagePath: z.string().min(1), publicUrl: z.string().url() }).parse(input)).handler(async ({ data, context }) => {
  const { count, error: countError } = await context.supabase.from("salon_images").select("id", { count: "exact", head: true }).eq("salon_id", data.salonId);
  if (countError) throw new Error("Could not verify the photo limit.");
  if ((count ?? 0) >= 10) throw new Error("A salon can have up to 10 photos.");
  const { error } = await context.supabase.from("salon_images").insert({ salon_id: data.salonId, storage_path: data.storagePath, public_url: data.publicUrl, sort_order: count ?? 0 });
  if (error) throw new Error("Could not save the salon photo.");
  return { ok: true };
});
export const deleteSalonImage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ salonId: id, id }).parse(input)).handler(async ({ data, context }) => {
  const { data: image, error: imageError } = await context.supabase.from("salon_images").select("storage_path").eq("id", data.id).eq("salon_id", data.salonId).single();
  if (imageError || !image) throw new Error("Could not find this salon photo.");
  const { error } = await context.supabase.from("salon_images").delete().eq("id", data.id).eq("salon_id", data.salonId);
  if (error) throw new Error("Could not remove the salon photo.");
  return { storagePath: image.storage_path };
});
