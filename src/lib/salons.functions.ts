import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createSalonSchema, updateSalonSchema } from "./validation";

export const listServiceCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("service_categories")
      .select("id, name, slug, sort_order")
      .order("sort_order");
    if (error) throw new Error("Could not load service categories.");
    return data ?? [];
  });

export const listSalons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("salons")
      .select(
        "id, name, phone, parent_id, address, house_no, street, about, open_time, close_time, is_stylist, latitude, longitude, created_at",
      )
      .order("created_at", { ascending: true });
    if (error) throw new Error("Could not load your salons.");
    return data ?? [];
  });

export const getSalonHours = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { salonId: string }) =>
    z.object({ salonId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: hours, error } = await context.supabase
      .from("salon_hours")
      .select("day_of_week, is_open, open_time, close_time")
      .eq("salon_id", data.salonId)
      .order("day_of_week");
    if (error) throw new Error("Could not load working hours.");
    return hours ?? [];
  });

export const createSalon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSalonSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: salon, error } = await context.supabase
      .from("salons")
      .insert({
        owner_id: context.userId,
        parent_id: data.parentId ?? null,
        name: data.name,
        phone: data.phone,
        open_time: data.openTime,
        close_time: data.closeTime,
        is_stylist: data.isStylist,
        address: data.address,
        house_no: data.houseNo || null,
        street: data.street || null,
        about: data.about,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      })
      .select("id")
      .single();
    if (error || !salon) throw new Error("Could not save the salon. Please try again.");

    const { error: hoursError } = await context.supabase.from("salon_hours").insert(
      data.hours.map((hour) => ({
        salon_id: salon.id,
        day_of_week: hour.dayOfWeek,
        is_open: hour.isOpen,
        open_time: hour.openTime,
        close_time: hour.closeTime,
      })),
    );
    if (hoursError) throw new Error("Could not save the working hours.");

    const { error: catError } = await context.supabase
      .from("salon_categories")
      .insert(data.categoryIds.map((id) => ({ salon_id: salon.id, category_id: id })));
    if (catError) throw new Error("Could not save the selected services.");

    // Copy the predefined catalog of every selected category into the salon.
    const { data: catalog } = await context.supabase
      .from("services")
      .select(
        "id, name, default_price, default_duration_mins, subcategory_id, service_subcategories!inner(id, category_id)",
      )
      .in("service_subcategories.category_id", data.categoryIds);

    const rows = (catalog ?? []).map((service) => {
      const sub = service.service_subcategories as unknown as { category_id: string };
      return {
        salon_id: salon.id,
        service_id: service.id,
        subcategory_id: service.subcategory_id,
        category_id: sub.category_id,
        name: service.name,
        price: service.default_price,
        duration_mins: service.default_duration_mins,
      };
    });
    if (rows.length > 0) {
      const { error: seedError } = await context.supabase.from("salon_services").insert(rows);
      if (seedError) throw new Error("Could not set up the salon catalog.");
    }

    return { id: salon.id };
  });

export const updateSalon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSalonSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("salons")
      .update({
        name: data.name,
        phone: data.phone,
        open_time: data.openTime,
        close_time: data.closeTime,
        is_stylist: data.isStylist,
        address: data.address,
        house_no: data.houseNo || null,
        street: data.street || null,
        about: data.about,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error("Could not update the salon.");

    for (const hour of data.hours) {
      const { error: hourError } = await context.supabase.from("salon_hours").upsert(
        {
          salon_id: data.id,
          day_of_week: hour.dayOfWeek,
          is_open: hour.isOpen,
          open_time: hour.openTime,
          close_time: hour.closeTime,
        },
        { onConflict: "salon_id,day_of_week" },
      );
      if (hourError) throw new Error("Could not update working hours.");
    }
    return { ok: true };
  });

export const deleteSalon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("salons").delete().eq("id", data.id);
    if (error) throw new Error("Could not delete the salon.");
    return { ok: true };
  });

export const getSalonCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { salonId: string }) =>
    z.object({ salonId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const [{ data: categories }, { data: services }] = await Promise.all([
      context.supabase
        .from("salon_categories")
        .select("category_id, service_categories!inner(id, name, sort_order)")
        .eq("salon_id", data.salonId),
      context.supabase
        .from("salon_services")
        .select(
          "id, name, price, duration_mins, description, commission_type, commission_value, max_amount, category_id, subcategory_id, service_subcategories(name)",
        )
        .eq("salon_id", data.salonId)
        .order("name"),
    ]);

    return {
      categories: (categories ?? []).map((row) => {
        const cat = row.service_categories as unknown as { id: string; name: string; sort_order: number };
        return { id: cat.id, name: cat.name, sortOrder: cat.sort_order };
      }),
      services: (services ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        price: Number(row.price),
        durationMins: row.duration_mins,
        description: row.description,
        commissionType: row.commission_type,
        commissionValue: Number(row.commission_value),
        maxAmount: row.max_amount === null ? null : Number(row.max_amount),
        categoryId: row.category_id,
        subcategoryName:
          (row.service_subcategories as unknown as { name: string } | null)?.name ?? "Other",
      })),
    };
  });
