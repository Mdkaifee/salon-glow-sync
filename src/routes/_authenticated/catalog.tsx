import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  Check,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SalonBranchTabs, useSalonBranches } from "@/components/salon-branch-selector";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createCatalogCategory,
  createCatalogSubcategory,
  deleteCatalogCategory,
  deleteCatalogService,
  deleteCatalogSubcategory,
  getSalonCatalog,
  listServiceCategories,
  replaceSalonPredefinedCatalog,
  saveCatalogService,
  updateCatalogCategory,
  updateCatalogSubcategory,
} from "@/lib/salons.functions";

export const Route = createFileRoute("/_authenticated/catalog")({
  validateSearch: (search: Record<string, unknown>) => ({
    salon: typeof search["salon"] === "string" ? search["salon"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Catalog — Glowante Business" },
      {
        name: "description",
        content: "Manage categories, subcategories, pricing and commissions.",
      },
    ],
  }),
  component: CatalogPage,
});

type Category = {
  id: string;
  sourceCategoryId: string | null;
  name: string;
  description: string | null;
  appointmentColor: string;
  imageUrl: string | null;
  isPredefined: boolean;
  sortOrder: number;
};
type Subcategory = {
  id: string;
  salonCategoryId: string | undefined;
  sourceSubcategoryId: string | null;
  name: string;
  description: string | null;
  sortOrder: number;
  isPredefined: boolean;
};
type Service = {
  id: string;
  name: string;
  price: number;
  durationMins: number;
  description: string | null;
  commissionType: "percentage" | "fixed";
  commissionValue: number;
  maxAmount: number | null;
  categoryId: string | null;
  subcategoryId: string | null;
  subcategoryName: string;
  passiveWaitEnabled: boolean;
  busyStartMins: number | null;
  passiveWaitMins: number | null;
  busyEndMins: number | null;
};
type ServiceInput = Omit<Service, "id" | "subcategoryName" | "categoryId" | "subcategoryId"> & {
  salonCategoryId: string | undefined;
  sourceCategoryId: string | null;
  salonSubcategoryId: string | null;
  sourceSubcategoryId: string | null;
};
type SeedCategory = { id: string; name: string; image_url: string | null; subcategories: { id: string; category_id: string; name: string; sort_order: number }[] };

function Modal({
  title,
  children,
  onClose,
  width = "max-w-2xl",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  width?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/55 p-4 backdrop-blur-sm">
      <div
        className={cn(
          "relative max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-elegant animate-in fade-in zoom-in-95",
          width,
        )}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:bg-secondary"
        >
          <X className="size-5" />
        </button>
        <h2 className="pr-8 font-display text-3xl text-primary">{title}</h2>
        <div className="mt-4 border-t border-border pt-5">{children}</div>
      </div>
    </div>
  );
}

function CatalogPage() {
  const queryClient = useQueryClient();
  const routeSearch = Route.useSearch();
  const { activeSalonId: salonId, setActiveSalonId, salons: salonRecords } = useSalonBranches();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [dialog, setDialog] = useState<
    "predefined" | "category" | "subcategory" | "service" | null
  >(null);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [editSubcategory, setEditSubcategory] = useState<Subcategory | null>(null);
  const [editService, setEditService] = useState<Service | null>(null);
  const [viewService, setViewService] = useState<Service | null>(null);
  const catalog = useServerFn(getSalonCatalog);
  const presets = useServerFn(listServiceCategories);
  const replace = useServerFn(replaceSalonPredefinedCatalog);
  const addCategory = useServerFn(createCatalogCategory);
  const editCategoryFn = useServerFn(updateCatalogCategory);
  const removeCategory = useServerFn(deleteCatalogCategory);
  const addSubcategory = useServerFn(createCatalogSubcategory);
  const editSubcategoryFn = useServerFn(updateCatalogSubcategory);
  const removeSubcategory = useServerFn(deleteCatalogSubcategory);
  const saveService = useServerFn(saveCatalogService);
  const removeService = useServerFn(deleteCatalogService);
  const catalogQuery = useQuery({
    queryKey: ["catalog", salonId],
    queryFn: () => catalog({ data: { salonId: salonId! } }),
    enabled: Boolean(salonId),
  });
  const presetQuery = useQuery({ queryKey: ["service-categories"], queryFn: () => presets() });
  const categories = (catalogQuery.data?.categories ?? []) as Category[];
  const subcategories = (catalogQuery.data?.subcategories ?? []) as Subcategory[];
  const allServices = (catalogQuery.data?.services ?? []) as Service[];
  const selectedCategory = categories.find((item) => item.id === categoryId) ?? null;
  const currentSubcategories = subcategories.filter((item) => item.salonCategoryId === categoryId);
  const services = allServices.filter(
    (item) =>
      item.categoryId === categoryId &&
      (!subcategoryId || item.subcategoryId === subcategoryId) &&
      (!term ||
        `${item.name} ${item.description ?? ""}`.toLowerCase().includes(term.toLowerCase())),
  ).sort((first, second) => first.name.localeCompare(second.name, "en", { sensitivity: "base" }));
  useEffect(() => {
    if (routeSearch.salon && salonRecords.some((salon) => salon.id === routeSearch.salon)) {
      setActiveSalonId(routeSearch.salon);
    }
  }, [routeSearch.salon, salonRecords, setActiveSalonId]);
  useEffect(() => {
    if (!categories.some((item) => item.id === categoryId))
      setCategoryId(categories[0]?.id ?? null);
  }, [categories, categoryId]);
  useEffect(() => {
    if (!currentSubcategories.some((item) => item.id === subcategoryId)) setSubcategoryId(null);
  }, [currentSubcategories, subcategoryId]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["catalog", salonId] });
  const run = async (work: () => Promise<unknown>, success: string) => {
    try {
      await work();
      toast.success(success);
      setDialog(null);
      setEditCategory(null);
      setEditSubcategory(null);
      setEditService(null);
      void refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save changes");
    }
  };
  async function deleteItem(work: () => Promise<unknown>, label: string) {
    if (!window.confirm(`Delete this ${label}? This cannot be undone.`)) return;
    await run(work, `${label[0]?.toUpperCase()}${label.slice(1)} deleted`);
  }
  function deleteCategoryItem(category: Category) {
    if (subcategories.some((subcategory) => subcategory.salonCategoryId === category.id)) {
      toast.error("Delete all subcategories in this category before deleting the category.");
      return;
    }
    if (allServices.some((service) => service.categoryId === category.id)) {
      toast.error("Delete all services in this category before deleting the category.");
      return;
    }
    void deleteItem(
      () => removeCategory({ data: { salonId: salonId!, id: category.id } }),
      "category",
    );
  }
  function deleteSubcategoryItem(subcategory: Subcategory) {
    if (allServices.some((service) => service.subcategoryId === subcategory.id)) {
      toast.error("Delete all services in this subcategory before deleting the subcategory.");
      return;
    }
    void deleteItem(
      () => removeSubcategory({ data: { salonId: salonId!, id: subcategory.id } }),
      "subcategory",
    );
  }

  return (
    <div className="w-full px-4 py-7">
      <SalonBranchTabs className="mb-7" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Catalog</p>
          <h1 className="font-display text-4xl text-primary">Service Details</h1>
          <p className="mt-1 text-muted-foreground">
            Manage pricing, duration and commissions for your salon offerings.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setDialog("predefined")} disabled={!salonId}>
            <Sparkles className="size-4" /> Predefined
          </Button>
          <Button
            onClick={() => {
              setEditService(null);
              setDialog("service");
            }}
        disabled={!salonId || presetQuery.isLoading}
          >
            <Plus className="size-4" /> Add Service
          </Button>
        </div>
      </div>
      {!salonId ? (
        <EmptyCatalog message="Add a salon to start building its service catalog." />
      ) : catalogQuery.isLoading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : categories.length === 0 ? (
        <EmptyCatalog message="No services yet" onImport={() => setDialog("predefined")} />
      ) : (
        <div className="mt-7 grid gap-5 lg:grid-cols-[275px_1fr]">
          <aside className="h-fit rounded-2xl border border-border bg-card p-3 shadow-sm">
            <div className="flex items-center justify-between px-2 pb-3">
              <h2 className="font-display text-2xl text-primary">Categories</h2>
              <button
                className="rounded-full p-1 text-primary hover:bg-gold-soft"
                onClick={() => {
                  setEditCategory(null);
                  setDialog("category");
                }}
                aria-label="Add category"
              >
                <Plus className="size-5" />
              </button>
            </div>
            <ul className="space-y-1">
              {categories.map((category) => (
                <li key={category.id}>
                  <div
                    className={cn(
                      "group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors",
                      category.id === categoryId ? "bg-gold-soft" : "hover:bg-secondary",
                    )}
                  >
                    <button
                      className="min-w-0 flex-1 text-left text-sm font-semibold"
                      onClick={() => {
                        setCategoryId(category.id);
                        setSubcategoryId(null);
                      }}
                    >
                      {category.name}
                    </button>
                    <button
                      className="hidden text-muted-foreground group-hover:block"
                      onClick={() => {
                        setEditCategory(category);
                        setDialog("category");
                      }}
                      aria-label={`Edit ${category.name}`}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      className="hidden text-destructive group-hover:block"
                      onClick={() => deleteCategoryItem(category)}
                      aria-label={`Delete ${category.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  {category.id === categoryId && (
                    <div className="ml-4 border-l border-primary/40 pl-3">
                      {currentSubcategories.map((sub) => (
                        <div
                          key={sub.id}
                          className="group/sub flex items-center gap-1 py-1.5 text-sm text-muted-foreground"
                        >
                          <button
                            className={cn("min-w-0 flex-1 truncate text-left", subcategoryId === sub.id && "font-semibold text-primary")}
                            onClick={() => setSubcategoryId(sub.id)}
                          >
                            {sub.name}
                          </button>
                          <button
                            className="hidden group-hover/sub:block"
                            onClick={() => {
                              setEditSubcategory(sub);
                              setDialog("subcategory");
                            }}
                            aria-label={`Edit ${sub.name}`}
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            className="hidden text-destructive group-hover/sub:block"
                            onClick={() => deleteSubcategoryItem(sub)}
                            aria-label={`Delete ${sub.name}`}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        className="mt-2 text-xs font-semibold text-primary hover:underline"
                        onClick={() => {
                          setEditSubcategory(null);
                          setDialog("subcategory");
                        }}
                      >
                        + Add Subcategory
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </aside>
          <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border p-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  className="w-full max-w-84 pl-9"
                  placeholder="Search .."
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-sm">
                <thead className="bg-gold-soft/60 text-left text-[11px] tracking-[0.15em] text-primary uppercase">
                  <tr>
                    <th className="px-5 py-4">Name</th>
                    <th className="px-4 py-4">Price (Rs.)</th>
                    <th className="px-4 py-4">Duration</th>
                    <th className="px-4 py-4">Description</th>
                    <th className="px-4 py-4">Commission type</th>
                    <th className="px-4 py-4">Commission</th>
                    <th className="px-4 py-4">Max amount</th>
                    <th className="px-4 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {services.map((service) => (
                    <tr key={service.id} className="hover:bg-gold-soft/30">
                      <td className="px-5 py-4 font-semibold">
                        {service.name}
                      </td>
                      <td className="px-4 py-4 text-primary">
                        ₹ {service.price.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {service.durationMins} min
                      </td>
                      <td className="max-w-40 truncate px-4 py-4 text-muted-foreground">
                        {service.description || "—"}
                      </td>
                      <td className="px-4 py-4 capitalize">{service.commissionType}</td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-gold-soft px-2.5 py-1 text-xs text-primary">
                          {service.commissionType === "percentage"
                            ? `${service.commissionValue}%`
                            : `₹ ${service.commissionValue}`}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {service.maxAmount === null ? "—" : `₹ ${service.maxAmount}`}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button
                            className="text-primary hover:text-accent"
                            onClick={() => {
                              setEditService(service);
                              setDialog("service");
                            }}
                            aria-label={`Edit ${service.name}`}
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            className="text-muted-foreground hover:text-primary"
                            onClick={() => setViewService(service)}
                            aria-label={`View ${service.name}`}
                          >
                            <Eye className="size-4" />
                          </button>
                          <button
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              void deleteItem(
                                () =>
                                  removeService({ data: { salonId: salonId!, id: service.id } }),
                                "service",
                              )
                            }
                            aria-label={`Delete ${service.name}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {services.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-16 text-center text-muted-foreground">
                        No services in this category yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
      {dialog === "predefined" && (
        <PredefinedDialog
          presets={presetQuery.data ?? []}
          selected={categories
            .filter((item) => item.sourceCategoryId)
            .map((item) => item.sourceCategoryId!)}
          loading={presetQuery.isLoading}
          onClose={() => setDialog(null)}
          onSave={(ids) =>
            void run(async () => {
              if (
                !window.confirm(
                  "Importing predefined services replaces all current custom categories, subcategories and services. Continue?",
                )
              )
                return;
              await replace({ data: { salonId: salonId!, categoryIds: ids } });
            }, "Predefined services imported")
          }
        />
      )}
      {dialog === "category" && (
        <CategoryDialog
          category={editCategory}
          onClose={() => {
            setDialog(null);
            setEditCategory(null);
          }}
          onSave={(data) =>
            void run(
              () =>
                editCategory
                  ? editCategoryFn({ data: { salonId: salonId!, id: editCategory.id, ...data } })
                  : addCategory({ data: { salonId: salonId!, ...data } }),
              editCategory ? "Category updated" : "Category added",
            )
          }
        />
      )}
      {dialog === "subcategory" && selectedCategory && (
        <SubcategoryDialog
          subcategory={editSubcategory}
          onClose={() => {
            setDialog(null);
            setEditSubcategory(null);
          }}
          onSave={(data) =>
            void run(
              () =>
                editSubcategory
                  ? editSubcategoryFn({
                      data: {
                        salonId: salonId!,
                        salonCategoryId: selectedCategory.id,
                        id: editSubcategory.id,
                        ...data,
                      },
                    })
                  : addSubcategory({
                      data: { salonId: salonId!, salonCategoryId: selectedCategory.id, ...data },
                    }),
              editSubcategory ? "Subcategory updated" : "Subcategory added",
            )
          }
        />
      )}
      {dialog === "service" && (
        <ServiceDialog
          service={editService}
          categories={categories}
          subcategories={subcategories}
          predefinedCategories={(presetQuery.data ?? []) as SeedCategory[]}
          initialCategoryId={selectedCategory?.id}
          initialSubcategoryId={subcategoryId}
          onClose={() => {
            setDialog(null);
            setEditService(null);
          }}
          onSave={(data) =>
            void run(
              () => saveService({ data: { salonId: salonId!, id: editService?.id, ...data } }),
              editService ? "Service updated" : "Service added",
            )
          }
        />
      )}
      {viewService && (
        <ServiceDetailsDialog
          service={viewService}
          category={categories.find((item) => item.id === viewService.categoryId)}
          onClose={() => setViewService(null)}
        />
      )}
    </div>
  );
}

function EmptyCatalog({ message, onImport }: { message: string; onImport?: () => void }) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-border py-20 text-center">
      <BookOpen className="mx-auto size-9 text-primary" />
      <p className="mt-3 font-medium">{message}</p>
      {onImport && (
        <Button className="mt-4" onClick={onImport}>
          Import predefined services
        </Button>
      )}
    </div>
  );
}
function PredefinedDialog({
  presets,
  selected,
  loading,
  onClose,
  onSave,
}: {
  presets: { id: string; name: string; image_url: string | null }[];
  selected: string[];
  loading: boolean;
  onClose: () => void;
  onSave: (ids: string[]) => void;
}) {
  const [ids, setIds] = useState(selected);
  return (
    <Modal title="Select Services" onClose={onClose}>
      <p className="text-muted-foreground">
        Choose the seeded categories for this branch. Importing replaces the current catalogue.
      </p>
      {loading ? (
        <Loader2 className="mx-auto my-12 size-5 animate-spin" />
      ) : (
        <div className="mt-6 grid grid-cols-3 gap-5 sm:grid-cols-4">
          {presets.map((item) => {
            const active = ids.includes(item.id);
            return (
              <button
                key={item.id}
                className="group flex flex-col items-center gap-2"
                onClick={() =>
                  setIds((value) =>
                    value.includes(item.id)
                      ? value.filter((id) => id !== item.id)
                      : [...value, item.id],
                  )
                }
              >
                <span
                  className={cn(
                    "relative size-20 overflow-hidden rounded-full border-[3px] bg-gold-soft p-1 shadow-sm transition-transform group-hover:scale-105",
                    active ? "border-primary" : "border-border",
                  )}
                >
                  <img
                    src={item.image_url ?? ""}
                    alt=""
                    className="size-full rounded-full object-cover"
                  />
                  {active && (
                    <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" />
                    </span>
                  )}
                </span>
                <span className={cn("text-xs font-semibold", active && "text-primary")}>
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-7 flex justify-end gap-3 border-t border-border pt-5">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!ids.length} onClick={() => onSave(ids)}>
          Import selected
        </Button>
      </div>
    </Modal>
  );
}
function CategoryDialog({
  category,
  onClose,
  onSave,
}: {
  category: Category | null;
  onClose: () => void;
  onSave: (value: { name: string; description: string | null; appointmentColor: string }) => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [color, setColor] = useState(category?.appointmentColor ?? "blue");
  return (
    <Modal title={category ? "Edit Category" : "Add Category"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <Label>Category *</Label>
          <Input
            className="mt-1"
            value={name}
            maxLength={80}
            placeholder="e.g. Hair Services"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <Label>Appointment color</Label>
          <select
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          >
            <option value="blue">Blue</option>
            <option value="purple">Purple</option>
            <option value="pink">Pink</option>
            <option value="green">Green</option>
            <option value="orange">Orange</option>
          </select>
        </div>
        <div>
          <div className="flex justify-between">
            <Label>Description</Label>
            <span className="text-xs text-muted-foreground">{description.length}/100</span>
          </div>
          <Textarea
            className="mt-1"
            value={description}
            maxLength={100}
            placeholder="Describe the services in this category…"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <Button
          className="w-full"
          disabled={name.trim().length < 2}
          onClick={() =>
            onSave({ name, description: description || null, appointmentColor: color })
          }
        >
          {category ? "Save Category" : "Add Category"}
        </Button>
      </div>
    </Modal>
  );
}
function SubcategoryDialog({
  subcategory,
  onClose,
  onSave,
}: {
  subcategory: Subcategory | null;
  onClose: () => void;
  onSave: (value: { name: string; description: string | null }) => void;
}) {
  const [name, setName] = useState(subcategory?.name ?? "");
  const [description, setDescription] = useState(subcategory?.description ?? "");
  return (
    <Modal title={subcategory ? "Edit Subcategory" : "Add Subcategory"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <Label>Subcategory *</Label>
          <Input
            className="mt-1"
            value={name}
            maxLength={80}
            placeholder="e.g. Haircut & Styling"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            className="mt-1"
            value={description}
            maxLength={100}
            placeholder="Optional description"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <Button
          className="w-full"
          disabled={name.trim().length < 2}
          onClick={() => onSave({ name, description: description || null })}
        >
          {subcategory ? "Save Subcategory" : "Add Subcategory"}
        </Button>
      </div>
    </Modal>
  );
}

function ServiceDialog({
  service,
  categories,
  subcategories,
  predefinedCategories,
  initialCategoryId,
  initialSubcategoryId,
  onClose,
  onSave,
}: {
  service: Service | null;
  categories: Category[];
  subcategories: Subcategory[];
  predefinedCategories: SeedCategory[];
  initialCategoryId: string | undefined;
  initialSubcategoryId: string | null;
  onClose: () => void;
  onSave: (value: ServiceInput) => void;
}) {
  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const categoryOptions = [
    ...categories.map((category) => ({ value: `salon:${category.id}`, name: category.name, salonCategoryId: category.id, sourceCategoryId: category.sourceCategoryId })),
    ...predefinedCategories.filter((category) => !categories.some((item) => item.sourceCategoryId === category.id)).map((category) => ({ value: `source:${category.id}`, name: category.name, salonCategoryId: undefined, sourceCategoryId: category.id })),
  ];
  const [categoryId, setCategoryId] = useState(service?.categoryId ? `salon:${service.categoryId}` : initialCategoryId ? `salon:${initialCategoryId}` : "");
  const [subId, setSubId] = useState(service?.subcategoryId ?? initialSubcategoryId ?? "");
  const [price, setPrice] = useState(String(service?.price ?? 0));
  const [duration, setDuration] = useState(String(service?.durationMins ?? 60));
  const [commissionType, setCommissionType] = useState<"percentage" | "fixed">(
    service?.commissionType ?? "percentage",
  );
  const [commission, setCommission] = useState(String(service?.commissionValue ?? 5));
  const [maxAmount, setMaxAmount] = useState(
    service?.maxAmount === null || service?.maxAmount === undefined
      ? ""
      : String(service.maxAmount),
  );
  const [passiveEnabled, setPassiveEnabled] = useState(service?.passiveWaitEnabled ?? false);
  const minutes = Math.max(1, Number(duration) || 1);
  const [busyStart, setBusyStart] = useState(
    Math.max(1, service?.busyStartMins ?? Math.min(10, Math.floor(minutes / 3) || 1)),
  );
  const [busyEnd, setBusyEnd] = useState(
    Math.max(1, service?.busyEndMins ?? Math.min(10, Math.floor(minutes / 3) || 1)),
  );
  const selectedCategory = categoryOptions.find((item) => item.value === categoryId);
  const localSubcategories = selectedCategory?.salonCategoryId
    ? subcategories
        .filter((item) => item.salonCategoryId === selectedCategory.salonCategoryId)
        .map((item) => ({
          id: item.id,
          name: item.name,
          salonSubcategoryId: item.id,
          sourceSubcategoryId: item.sourceSubcategoryId,
        }))
    : [];
  const seededSubcategories = selectedCategory?.sourceCategoryId
    ? (predefinedCategories.find((item) => item.id === selectedCategory.sourceCategoryId)?.subcategories ?? [])
        .map((item) => ({ id: item.id, name: item.name, salonSubcategoryId: null, sourceSubcategoryId: item.id }))
    : [];
  const availableSubcategories = selectedCategory?.salonCategoryId
    ? localSubcategories
    : seededSubcategories;
  const selected = availableSubcategories.find((item) => item.id === subId);
  const categoryLocked = Boolean(!service && initialCategoryId);
  const passiveWait = Math.max(0, minutes - busyStart - busyEnd);
  const changeCategory = (next: string) => {
    setCategoryId(next);
    setSubId("");
  };
  const changeDuration = (value: string) => {
    const next = Math.max(1, Number(value) || 1);
    setDuration(value);
    if (next < 2) setPassiveEnabled(false);
    const nextStart = Math.max(1, Math.min(busyStart, Math.max(1, next - 1)));
    setBusyStart(nextStart);
    setBusyEnd((current) => Math.max(1, Math.min(current, Math.max(1, next - nextStart))));
  };
  return (
    <Modal title={service ? "Edit Service" : "Add Service"} onClose={onClose} width="max-w-3xl">
      <div className="space-y-5">
        <div>
          <Label>Service name *</Label>
          <Input
            className="mt-1"
            value={name}
            maxLength={120}
            placeholder="Add a service name"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className={cn("grid gap-4", selectedCategory && availableSubcategories.length > 0 && "sm:grid-cols-2")}>
          <div>
            <Label>Category *</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={categoryId}
              onChange={(e) => changeCategory(e.target.value)}
              disabled={Boolean(service) || categoryLocked}
            >
              {!categoryId && <option value="">Select category</option>}
              {categoryOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          {selectedCategory && availableSubcategories.length > 0 && (
          <div>
            <Label>Subcategory *</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={subId}
              onChange={(e) => setSubId(e.target.value)}
              disabled={Boolean(service)}
            >
              <option value="">Select subcategory</option>
              {availableSubcategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          )}
        </div>
        {service && <p className="-mt-2 text-xs text-muted-foreground">Category and subcategory are locked after creation to preserve mobile search classification.</p>}
        <div>
          <div className="flex justify-between">
            <Label>Description (optional)</Label>
            <span className="text-xs text-muted-foreground">{description.length}/300</span>
          </div>
          <Textarea
            className="mt-1"
            maxLength={300}
            value={description}
            placeholder="Add a short description"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <h3 className="font-display text-2xl text-primary">Pricing and duration</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Price (₹) *</Label>
            <Input
              className="mt-1"
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div>
            <Label>Duration in minutes *</Label>
            <Input
              className="mt-1"
              type="number"
              min="1"
              value={duration}
              onChange={(e) => changeDuration(e.target.value)}
            />
          </div>
        </div>
        <div className="rounded-xl border border-gold-soft bg-gold-soft/30 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-foreground">Passive wait</p>
              <p className="text-xs text-muted-foreground">
                Split the service duration into busy start, passive wait, and busy end.
              </p>
            </div>
            <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-primary">
              <input
                type="checkbox"
                checked={passiveEnabled}
                onChange={(e) => {
                  if (e.target.checked && minutes < 2) {
                    toast.error("Set the service duration to at least 2 minutes for passive wait.");
                    return;
                  }
                  setPassiveEnabled(e.target.checked);
                }}
              />{" "}
              Enabled
            </label>
          </div>
          {passiveEnabled && (
            <div className="mt-4 space-y-3">
              <Slider
                aria-label="Passive wait timeline"
                min={1}
                max={Math.max(1, minutes - 1)}
                minStepsBetweenThumbs={0}
                value={[Math.max(1, Math.min(busyStart, minutes - 1)), Math.max(1, Math.min(minutes - busyEnd, minutes - 1))]}
                onValueChange={([start = 1, end = minutes - 1]) => { setBusyStart(start); setBusyEnd(Math.max(1, minutes - end)); }}
                trackClassName="h-1.5 bg-primary/45"
                rangeClassName="bg-background/90"
                thumbClassName="size-5 border-primary/25 bg-card shadow-sm"
              />
              <div className="grid grid-cols-3 text-xs text-primary">
                <span>Busy start: {busyStart} min</span>
                <span className="text-center">Passive wait: {passiveWait} min</span>
                <span className="text-right">Busy end: {busyEnd} min</span>
              </div>
            </div>
          )}
        </div>
        <div className="rounded-xl bg-rose-50/70 p-4">
          <p className="font-semibold text-foreground">Commission</p>
          <p className="text-xs text-muted-foreground">
            Enter the service price, then choose a fixed amount or percentage.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Commission type</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={commissionType}
                onChange={(e) => setCommissionType(e.target.value as "percentage" | "fixed")}
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </div>
            <div>
              <Label>{commissionType === "percentage" ? "Percentage" : "Amount (₹)"}</Label>
              <Input
                className="mt-1"
                type="number"
                min="0"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
              />
            </div>
            <div>
              <Label>Max amount</Label>
              <Input
                className="mt-1"
                type="number"
                min="0"
                disabled={commissionType !== "percentage"}
                value={maxAmount}
                placeholder="No limit"
                onChange={(e) => setMaxAmount(e.target.value)}
              />
            </div>
          </div>
        </div>
        <Button
          className="w-full"
          disabled={
            name.trim().length < 2 ||
            !selectedCategory ||
            (availableSubcategories.length > 0 && !selected) ||
            !Number.isFinite(Number(price)) ||
            !Number.isFinite(Number(duration))
          }
          onClick={() =>
            onSave({
              name,
              description: description || null,
              salonCategoryId: selectedCategory?.salonCategoryId,
              sourceCategoryId: selectedCategory?.sourceCategoryId ?? null,
              salonSubcategoryId: selected?.salonSubcategoryId ?? null,
              sourceSubcategoryId: selected?.sourceSubcategoryId ?? null,
              price: Number(price),
              durationMins: Number(duration),
              commissionType,
              commissionValue: Number(commission) || 0,
              maxAmount:
                commissionType === "percentage" && maxAmount !== "" ? Number(maxAmount) : null,
              passiveWaitEnabled: passiveEnabled,
              busyStartMins: passiveEnabled ? busyStart : null,
              passiveWaitMins: passiveEnabled ? passiveWait : null,
              busyEndMins: passiveEnabled ? busyEnd : null,
            })
          }
        >
          {service ? "Save Service" : "Add Service"}
        </Button>
      </div>
    </Modal>
  );
}
function ServiceDetailsDialog({
  service,
  category,
  onClose,
}: {
  service: Service;
  category: Category | undefined;
  onClose: () => void;
}) {
  const money = (value: number) => `₹ ${value.toLocaleString("en-IN")}`;
  return (
    <Modal title="Service details" onClose={onClose} width="max-w-xl">
      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <Detail label="Service name" value={service.name} />
        <Detail label="Category" value={category?.name ?? "—"} />
        <Detail label="Service type" value={service.subcategoryName || "—"} />
        <Detail label="Description" value={service.description || "—"} />
        <Detail label="Price" value={money(service.price)} />
        <Detail label="Duration" value={`${service.durationMins} min`} />
        <Detail
          label="Commission type"
          value={service.commissionType === "percentage" ? "Percentage" : "Fixed amount"}
        />
        <Detail
          label="Commission"
          value={
            service.commissionType === "percentage"
              ? `${service.commissionValue}%`
              : money(service.commissionValue)
          }
        />
        <Detail
          label="Max amount"
          value={service.maxAmount === null ? "—" : money(service.maxAmount)}
        />
        <Detail label="Passive wait" value={service.passiveWaitEnabled ? "Enabled" : "Disabled"} />
        {service.passiveWaitEnabled && (
          <div className="sm:col-span-2 rounded-xl bg-gold-soft/50 p-4">
            <p className="font-medium text-primary">Service time breakdown</p>
            <div className="mt-2 grid grid-cols-3 gap-3 text-center text-xs">
              <span>
                Busy start
                <br />
                <strong>{service.busyStartMins ?? 0} min</strong>
              </span>
              <span>
                Passive wait
                <br />
                <strong>{service.passiveWaitMins ?? 0} min</strong>
              </span>
              <span>
                Busy end
                <br />
                <strong>{service.busyEndMins ?? 0} min</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/25 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium text-foreground">{value}</p>
    </div>
  );
}
