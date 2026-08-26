/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const id = z.string().uuid();
const optionalId = id.nullable().optional();
const salonIdInput = z.object({ salonId: id });

const teamMemberInput = z.object({
  salonId: id,
  id: id.optional(),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().max(160).nullable().optional().or(z.literal("")),
  roleTitle: z.string().trim().min(2).max(80),
  employmentType: z.enum(["full_time", "part_time", "contract"]).default("full_time"),
  baseSalary: z.number().min(0).max(10000000).default(0),
  commissionType: z.enum(["percentage", "fixed"]).default("percentage"),
  commissionValue: z.number().min(0).max(10000000).default(0),
  notes: z.string().trim().max(500).nullable().optional(),
});

const serviceIdsInput = z.object({
  salonId: id,
  teamMemberId: id,
  serviceIds: z.array(id),
});

const branchIdsInput = z.object({
  salonId: id,
  teamMemberId: id,
  branchIds: z.array(id),
});

const packageInput = z
  .object({
    salonId: id,
    id: id.optional(),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).nullable().optional(),
    pricingOption: z.enum(["discount", "fixed"]).default("fixed"),
    originalPrice: z.number().min(0).max(10000000).default(0),
    packagePrice: z.number().min(0).max(10000000),
    discountType: z.enum(["percentage", "fixed"]).default("percentage"),
    discountValue: z.number().min(0).max(10000000).default(0),
    maxDiscountAmount: z.number().min(0).max(10000000).nullable().optional(),
    terms: z.string().trim().max(50).nullable().optional(),
    durationCount: z.number().int().min(1).max(3650).default(1),
    durationUnit: z.enum(["day", "week", "month", "year"]).default("month"),
    gender: z.enum(["male", "female", "other", "all"]).default("all"),
    validityDays: z.number().int().min(1).max(3650).default(90),
    serviceIds: z.array(id).min(1),
  })
  .superRefine((value, ctx) => {
    if (value.discountType === "percentage" && value.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountValue"],
        message: "Percentage discounts cannot exceed 100.",
      });
    }
  });

const dealInput = z
  .object({
    salonId: id,
    id: id.optional(),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).nullable().optional(),
    pricingOption: z.enum(["discount", "fixed"]).default("discount"),
    originalPrice: z.number().min(0).max(10000000).default(0),
    offeredPrice: z.number().min(0).max(10000000).default(0),
    discountType: z.enum(["percentage", "fixed"]),
    discountValue: z.number().min(0).max(10000000),
    maxDiscountAmount: z.number().min(0).max(10000000).nullable().optional(),
    terms: z.string().trim().max(50).nullable().optional(),
    durationCount: z.number().int().min(1).max(3650).default(1),
    durationUnit: z.enum(["day", "week", "month", "year"]).default("month"),
    gender: z.enum(["male", "female", "other", "all"]).default("all"),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    serviceIds: z.array(id).min(1),
  })
  .superRefine((value, ctx) => {
    if (value.discountType === "percentage" && value.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountValue"],
        message: "Percentage discounts cannot exceed 100.",
      });
    }
    if (value.endsOn < value.startsOn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsOn"],
        message: "End date must be on or after the start date.",
      });
    }
  });

const bookingStatus = z.enum([
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
]);
const bookingInput = z.object({
  salonId: id,
  id: id.optional(),
  clientName: z.string().trim().min(2).max(120),
  clientPhone: z.string().trim().min(5).max(30),
  startsAt: z.string().datetime(),
  teamMemberId: optionalId,
  packageId: optionalId,
  dealId: optionalId,
  status: bookingStatus.default("pending"),
  notes: z.string().trim().max(500).nullable().optional(),
  serviceIds: z.array(id).min(1),
});

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function requireSalonAccess(supabase: any, salonId: string) {
  const { data, error } = await supabase.from("salons").select("id").eq("id", salonId).single();
  if (error || !data) throw new Error("Could not access this salon.");
}

async function loadServices(supabase: any, salonId: string, serviceIds: string[]) {
  if (!serviceIds.length) return [];
  const { data, error } = await supabase
    .from("salon_services")
    .select("id, name, price, duration_mins")
    .eq("salon_id", salonId)
    .in("id", serviceIds);
  if (error) throw new Error("Could not verify the selected services.");
  if ((data ?? []).length !== serviceIds.length)
    throw new Error("One or more selected services do not belong to this branch.");
  return data ?? [];
}

async function replaceLinks(
  supabase: any,
  table: string,
  parentColumn: string,
  parentId: string,
  serviceIds: string[],
) {
  const { error: deleteError } = await supabase.from(table).delete().eq(parentColumn, parentId);
  if (deleteError) throw new Error("Could not reset existing service assignments.");
  if (!serviceIds.length) return;
  const { error } = await supabase
    .from(table)
    .insert(
      serviceIds.map((serviceId) => ({ [parentColumn]: parentId, salon_service_id: serviceId })),
    );
  if (error) throw new Error("Could not save service assignments.");
}

async function replaceTeamBranches(supabase: any, teamMemberId: string, branchIds: string[]) {
  const { error: deleteError } = await supabase
    .from("team_member_branches")
    .delete()
    .eq("team_member_id", teamMemberId);
  if (deleteError) throw new Error("Could not reset branch assignments.");
  if (!branchIds.length) return;
  const { error } = await supabase
    .from("team_member_branches")
    .insert(branchIds.map((salonId) => ({ team_member_id: teamMemberId, salon_id: salonId })));
  if (error) throw new Error("Could not save branch assignments.");
}

export const listTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => salonIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { data: members, error } = await (context.supabase as any)
      .from("team_members")
      .select(
        "id, full_name, phone, email, role_title, employment_type, base_salary, commission_type, commission_value, notes, is_active, created_at",
      )
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load team members.");
    const memberIds = (members ?? []).map((member: any) => member.id);
    const [branchRows, serviceRows] = await Promise.all([
      memberIds.length
        ? (context.supabase as any)
            .from("team_member_branches")
            .select("team_member_id, salon_id, salons(id, name, parent_id)")
            .in("team_member_id", memberIds)
        : Promise.resolve({ data: [], error: null }),
      memberIds.length
        ? (context.supabase as any)
            .from("team_member_services")
            .select("team_member_id, salon_service_id, salon_services(id, name)")
            .in("team_member_id", memberIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (branchRows.error || serviceRows.error) throw new Error("Could not load team assignments.");
    return (members ?? []).map((member: any) => ({
      id: member.id,
      fullName: member.full_name,
      phone: member.phone,
      email: member.email,
      roleTitle: member.role_title,
      employmentType: member.employment_type,
      baseSalary: Number(member.base_salary ?? 0),
      commissionType: member.commission_type,
      commissionValue: Number(member.commission_value ?? 0),
      notes: member.notes,
      isActive: Boolean(member.is_active),
      branchIds: (branchRows.data ?? [])
        .filter((row: any) => row.team_member_id === member.id)
        .map((row: any) => row.salon_id),
      branches: (branchRows.data ?? [])
        .filter((row: any) => row.team_member_id === member.id)
        .map((row: any) => row.salons)
        .filter(Boolean),
      serviceIds: (serviceRows.data ?? [])
        .filter((row: any) => row.team_member_id === member.id)
        .map((row: any) => row.salon_service_id),
      services: (serviceRows.data ?? [])
        .filter((row: any) => row.team_member_id === member.id)
        .map((row: any) => row.salon_services)
        .filter(Boolean),
    }));
  });

export const saveTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => teamMemberInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const row = {
      owner_id: context.userId,
      full_name: data.fullName,
      phone: cleanText(data.phone),
      email: cleanText(data.email),
      role_title: data.roleTitle,
      employment_type: data.employmentType,
      base_salary: data.baseSalary,
      commission_type: data.commissionType,
      commission_value: data.commissionValue,
      notes: cleanText(data.notes),
    };
    const result = data.id
      ? await (context.supabase as any)
          .from("team_members")
          .update(row)
          .eq("id", data.id)
          .eq("owner_id", context.userId)
          .select("id")
          .single()
      : await (context.supabase as any).from("team_members").insert(row).select("id").single();
    if (result.error || !result.data)
      throw new Error(data.id ? "Could not update team member." : "Could not add team member.");
    if (!data.id)
      await replaceTeamBranches(context.supabase as any, result.data.id, [data.salonId]);
    return { id: result.data.id };
  });

export const setTeamMemberActiveStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ salonId: id, id, isActive: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { error } = await (context.supabase as any)
      .from("team_members")
      .update({ is_active: data.isActive })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error("Could not update team member status.");
    return { ok: true };
  });

export const deleteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ salonId: id, id }).parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { error } = await (context.supabase as any)
      .from("team_members")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error("Could not delete team member.");
    return { ok: true };
  });

export const assignTeamMemberServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => serviceIdsInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    await loadServices(context.supabase as any, data.salonId, data.serviceIds);
    const { data: member, error } = await (context.supabase as any)
      .from("team_members")
      .select("id")
      .eq("id", data.teamMemberId)
      .eq("owner_id", context.userId)
      .single();
    if (error || !member) throw new Error("Could not find this team member.");
    const { data: branchServices, error: branchServicesError } = await (context.supabase as any)
      .from("salon_services")
      .select("id")
      .eq("salon_id", data.salonId);
    if (branchServicesError) throw new Error("Could not load this branch's services.");
    const branchServiceIds = (branchServices ?? []).map((service: any) => service.id);
    if (branchServiceIds.length) {
      const { error: deleteError } = await (context.supabase as any)
        .from("team_member_services")
        .delete()
        .eq("team_member_id", data.teamMemberId)
        .in("salon_service_id", branchServiceIds);
      if (deleteError) throw new Error("Could not reset service assignments.");
    }
    if (data.serviceIds.length) {
      const { error: insertError } = await (context.supabase as any)
        .from("team_member_services")
        .insert(
          data.serviceIds.map((serviceId) => ({
            team_member_id: data.teamMemberId,
            salon_service_id: serviceId,
          })),
        );
      if (insertError) throw new Error("Could not save service assignments.");
    }
    return { ok: true };
  });

export const assignTeamMemberBranches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => branchIdsInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    if (data.branchIds.length) {
      const { data: salons, error } = await (context.supabase as any)
        .from("salons")
        .select("id")
        .in("id", data.branchIds);
      if (error || (salons ?? []).length !== data.branchIds.length)
        throw new Error("One or more selected branches are not available.");
    }
    const { data: member, error: memberError } = await (context.supabase as any)
      .from("team_members")
      .select("id")
      .eq("id", data.teamMemberId)
      .eq("owner_id", context.userId)
      .single();
    if (memberError || !member) throw new Error("Could not find this team member.");
    await replaceTeamBranches(context.supabase as any, data.teamMemberId, data.branchIds);
    return { ok: true };
  });

export const listSelectableServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => salonIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { data: services, error } = await (context.supabase as any)
      .from("salon_services")
      .select(
        "id, name, price, duration_mins, salon_categories(name), salon_subcategories(name), service_subcategories(name)",
      )
      .eq("salon_id", data.salonId)
      .order("name");
    if (error) throw new Error("Could not load services.");
    return (services ?? []).map((service: any) => ({
      id: service.id,
      name: service.name,
      price: Number(service.price ?? 0),
      durationMins: Number(service.duration_mins ?? 0),
      categoryName: service.salon_categories?.name ?? "Services",
      subcategoryName:
        service.salon_subcategories?.name ?? service.service_subcategories?.name ?? "Services",
    }));
  });

export const listPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => salonIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { data: packages, error } = await (context.supabase as any)
      .from("salon_packages")
      .select(
        "id, name, description, pricing_option, original_price, package_price, offered_price, discount_type, discount_value, max_discount_amount, terms, duration_count, duration_unit, gender, validity_days, is_active, created_at",
      )
      .eq("salon_id", data.salonId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load packages.");
    const packageIds = (packages ?? []).map((item: any) => item.id);
    const links = packageIds.length
      ? await (context.supabase as any)
          .from("salon_package_services")
          .select("package_id, salon_service_id, salon_services(id, name, price, duration_mins)")
          .in("package_id", packageIds)
      : { data: [], error: null };
    if (links.error) throw new Error("Could not load package services.");
    return (packages ?? []).map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      pricingOption: item.pricing_option ?? "fixed",
      originalPrice: Number(item.original_price ?? item.package_price ?? 0),
      packagePrice: Number(item.package_price ?? 0),
      offeredPrice: Number(item.offered_price ?? item.package_price ?? 0),
      discountType: item.discount_type ?? "percentage",
      discountValue: Number(item.discount_value ?? 0),
      maxDiscountAmount:
        item.max_discount_amount === null || item.max_discount_amount === undefined
          ? null
          : Number(item.max_discount_amount),
      terms: item.terms,
      durationCount: item.duration_count ?? item.validity_days ?? 1,
      durationUnit: item.duration_unit ?? "month",
      gender: item.gender ?? "all",
      validityDays: item.validity_days,
      isActive: Boolean(item.is_active),
      serviceIds: (links.data ?? [])
        .filter((link: any) => link.package_id === item.id)
        .map((link: any) => link.salon_service_id),
      services: (links.data ?? [])
        .filter((link: any) => link.package_id === item.id)
        .map((link: any) => link.salon_services)
        .filter(Boolean),
    }));
  });

export const savePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => packageInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    await loadServices(context.supabase as any, data.salonId, data.serviceIds);
    const row = {
      salon_id: data.salonId,
      name: data.name,
      description: cleanText(data.description),
      pricing_option: data.pricingOption,
      original_price: data.originalPrice,
      package_price: data.packagePrice,
      offered_price: data.packagePrice,
      discount_type: data.discountType,
      discount_value: data.discountValue,
      max_discount_amount: data.maxDiscountAmount ?? null,
      terms: cleanText(data.terms),
      duration_count: data.durationCount,
      duration_unit: data.durationUnit,
      gender: data.gender,
      validity_days: data.validityDays,
    };
    const result = data.id
      ? await (context.supabase as any)
          .from("salon_packages")
          .update(row)
          .eq("id", data.id)
          .eq("salon_id", data.salonId)
          .select("id")
          .single()
      : await (context.supabase as any).from("salon_packages").insert(row).select("id").single();
    if (result.error || !result.data)
      throw new Error(data.id ? "Could not update package." : "Could not add package.");
    await replaceLinks(
      context.supabase as any,
      "salon_package_services",
      "package_id",
      result.data.id,
      data.serviceIds,
    );
    return { id: result.data.id };
  });

export const setPackageActiveStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ salonId: id, id, isActive: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { error } = await (context.supabase as any)
      .from("salon_packages")
      .update({ is_active: data.isActive })
      .eq("id", data.id)
      .eq("salon_id", data.salonId);
    if (error) throw new Error("Could not update package status.");
    return { ok: true };
  });

export const deletePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ salonId: id, id }).parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { error } = await (context.supabase as any)
      .from("salon_packages")
      .delete()
      .eq("id", data.id)
      .eq("salon_id", data.salonId);
    if (error) throw new Error("Could not delete package.");
    return { ok: true };
  });

export const listDeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => salonIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { data: deals, error } = await (context.supabase as any)
      .from("salon_deals")
      .select(
        "id, name, description, pricing_option, original_price, offered_price, discount_type, discount_value, max_discount_amount, terms, duration_count, duration_unit, gender, starts_on, ends_on, is_active, created_at",
      )
      .eq("salon_id", data.salonId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load deals.");
    const dealIds = (deals ?? []).map((deal: any) => deal.id);
    const links = dealIds.length
      ? await (context.supabase as any)
          .from("salon_deal_services")
          .select("deal_id, salon_service_id, salon_services(id, name, price, duration_mins)")
          .in("deal_id", dealIds)
      : { data: [], error: null };
    if (links.error) throw new Error("Could not load deal services.");
    return (deals ?? []).map((deal: any) => ({
      id: deal.id,
      name: deal.name,
      description: deal.description,
      pricingOption: deal.pricing_option ?? "discount",
      originalPrice: Number(deal.original_price ?? 0),
      offeredPrice: Number(deal.offered_price ?? 0),
      discountType: deal.discount_type,
      discountValue: Number(deal.discount_value ?? 0),
      maxDiscountAmount:
        deal.max_discount_amount === null || deal.max_discount_amount === undefined
          ? null
          : Number(deal.max_discount_amount),
      terms: deal.terms,
      durationCount: deal.duration_count ?? 1,
      durationUnit: deal.duration_unit ?? "month",
      gender: deal.gender ?? "all",
      startsOn: deal.starts_on,
      endsOn: deal.ends_on,
      isActive: Boolean(deal.is_active),
      serviceIds: (links.data ?? [])
        .filter((link: any) => link.deal_id === deal.id)
        .map((link: any) => link.salon_service_id),
      services: (links.data ?? [])
        .filter((link: any) => link.deal_id === deal.id)
        .map((link: any) => link.salon_services)
        .filter(Boolean),
    }));
  });

export const saveDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => dealInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    await loadServices(context.supabase as any, data.salonId, data.serviceIds);
    const row = {
      salon_id: data.salonId,
      name: data.name,
      description: cleanText(data.description),
      pricing_option: data.pricingOption,
      original_price: data.originalPrice,
      offered_price: data.offeredPrice,
      discount_type: data.discountType,
      discount_value: data.discountValue,
      max_discount_amount: data.maxDiscountAmount ?? null,
      terms: cleanText(data.terms),
      duration_count: data.durationCount,
      duration_unit: data.durationUnit,
      gender: data.gender,
      starts_on: data.startsOn,
      ends_on: data.endsOn,
    };
    const result = data.id
      ? await (context.supabase as any)
          .from("salon_deals")
          .update(row)
          .eq("id", data.id)
          .eq("salon_id", data.salonId)
          .select("id")
          .single()
      : await (context.supabase as any).from("salon_deals").insert(row).select("id").single();
    if (result.error || !result.data)
      throw new Error(data.id ? "Could not update deal." : "Could not add deal.");
    await replaceLinks(
      context.supabase as any,
      "salon_deal_services",
      "deal_id",
      result.data.id,
      data.serviceIds,
    );
    return { id: result.data.id };
  });

export const setDealActiveStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ salonId: id, id, isActive: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { error } = await (context.supabase as any)
      .from("salon_deals")
      .update({ is_active: data.isActive })
      .eq("id", data.id)
      .eq("salon_id", data.salonId);
    if (error) throw new Error("Could not update deal status.");
    return { ok: true };
  });

export const deleteDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ salonId: id, id }).parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { error } = await (context.supabase as any)
      .from("salon_deals")
      .delete()
      .eq("id", data.id)
      .eq("salon_id", data.salonId);
    if (error) throw new Error("Could not delete deal.");
    return { ok: true };
  });

export const listBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => salonIdInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { data: bookings, error } = await (context.supabase as any)
      .from("salon_bookings")
      .select(
        "id, client_name, client_phone, starts_at, ends_at, status, total_amount, notes, team_member_id, package_id, deal_id, team_members(id, full_name), salon_packages(id, name), salon_deals(id, name)",
      )
      .eq("salon_id", data.salonId)
      .order("starts_at", { ascending: true });
    if (error) throw new Error("Could not load bookings.");
    const bookingIds = (bookings ?? []).map((booking: any) => booking.id);
    const links = bookingIds.length
      ? await (context.supabase as any)
          .from("salon_booking_services")
          .select("booking_id, salon_service_id, salon_services(id, name, price, duration_mins)")
          .in("booking_id", bookingIds)
      : { data: [], error: null };
    if (links.error) throw new Error("Could not load booking services.");
    return (bookings ?? []).map((booking: any) => ({
      id: booking.id,
      clientName: booking.client_name,
      clientPhone: booking.client_phone,
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
      status: booking.status,
      totalAmount: Number(booking.total_amount ?? 0),
      notes: booking.notes,
      teamMemberId: booking.team_member_id,
      teamMemberName: booking.team_members?.full_name ?? null,
      packageId: booking.package_id,
      packageName: booking.salon_packages?.name ?? null,
      dealId: booking.deal_id,
      dealName: booking.salon_deals?.name ?? null,
      serviceIds: (links.data ?? [])
        .filter((link: any) => link.booking_id === booking.id)
        .map((link: any) => link.salon_service_id),
      services: (links.data ?? [])
        .filter((link: any) => link.booking_id === booking.id)
        .map((link: any) => link.salon_services)
        .filter(Boolean),
    }));
  });

export const saveBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bookingInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const services = await loadServices(context.supabase as any, data.salonId, data.serviceIds);
    const totalMins = services.reduce(
      (sum: number, service: any) => sum + Number(service.duration_mins ?? 0),
      0,
    );
    const totalAmount = services.reduce(
      (sum: number, service: any) => sum + Number(service.price ?? 0),
      0,
    );
    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(startsAt.getTime() + Math.max(totalMins, 15) * 60000);
    if (data.teamMemberId) {
      const { data: assignment, error } = await (context.supabase as any)
        .from("team_member_branches")
        .select("team_member_id")
        .eq("team_member_id", data.teamMemberId)
        .eq("salon_id", data.salonId)
        .maybeSingle();
      if (error || !assignment)
        throw new Error("This team member is not assigned to the selected branch.");
    }
    const row = {
      salon_id: data.salonId,
      client_name: data.clientName,
      client_phone: data.clientPhone,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      team_member_id: data.teamMemberId ?? null,
      package_id: data.packageId ?? null,
      deal_id: data.dealId ?? null,
      status: data.status,
      notes: cleanText(data.notes),
      total_amount: totalAmount,
    };
    const result = data.id
      ? await (context.supabase as any)
          .from("salon_bookings")
          .update(row)
          .eq("id", data.id)
          .eq("salon_id", data.salonId)
          .select("id")
          .single()
      : await (context.supabase as any).from("salon_bookings").insert(row).select("id").single();
    if (result.error || !result.data)
      throw new Error(data.id ? "Could not update booking." : "Could not add booking.");
    await replaceLinks(
      context.supabase as any,
      "salon_booking_services",
      "booking_id",
      result.data.id,
      data.serviceIds,
    );
    return { id: result.data.id };
  });

export const setBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ salonId: id, id, status: bookingStatus }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { error } = await (context.supabase as any)
      .from("salon_bookings")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("salon_id", data.salonId);
    if (error) throw new Error("Could not update booking status.");
    return { ok: true };
  });

export const deleteBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ salonId: id, id }).parse(input))
  .handler(async ({ data, context }) => {
    await requireSalonAccess(context.supabase as any, data.salonId);
    const { error } = await (context.supabase as any)
      .from("salon_bookings")
      .delete()
      .eq("id", data.id)
      .eq("salon_id", data.salonId);
    if (error) throw new Error("Could not delete booking.");
    return { ok: true };
  });
