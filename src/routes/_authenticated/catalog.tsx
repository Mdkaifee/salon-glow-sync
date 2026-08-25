import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSalonCatalog, listSalons } from "@/lib/salons.functions";

export const Route = createFileRoute("/_authenticated/catalog")({
  validateSearch: (search: Record<string, unknown>) => ({
    salon: typeof search.salon === "string" ? search.salon : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Catalog — Glowante Business" },
      { name: "description", content: "Manage service categories, subcategories, pricing and commissions." },
      { property: "og:title", content: "Catalog — Glowante Business" },
      { property: "og:description", content: "Manage service categories, pricing and commissions for your salon." },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const { salon: salonParam } = Route.useSearch();
  const fetchSalons = useServerFn(listSalons);
  const fetchCatalog = useServerFn(getSalonCatalog);
  const [salonId, setSalonId] = useState<string | undefined>(salonParam);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const salonsQuery = useQuery({ queryKey: ["salons"], queryFn: () => fetchSalons() });

  useEffect(() => {
    if (!salonId && salonsQuery.data?.[0]) setSalonId(salonsQuery.data[0].id);
  }, [salonsQuery.data, salonId]);

  const catalogQuery = useQuery({
    queryKey: ["catalog", salonId],
    queryFn: () => fetchCatalog({ data: { salonId: salonId! } }),
    enabled: Boolean(salonId),
  });

  const categories = useMemo(
    () => [...(catalogQuery.data?.categories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [catalogQuery.data],
  );

  useEffect(() => {
    if (!categoryId && categories[0]) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  const services = (catalogQuery.data?.services ?? []).filter((service) => service.categoryId === categoryId);
  const grouped = useMemo(() => {
    const map = new Map<string, typeof services>();
    for (const service of services) {
      const list = map.get(service.subcategoryName) ?? [];
      list.push(service);
      map.set(service.subcategoryName, list);
    }
    return [...map.entries()];
  }, [services]);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Services seeded from the categories you selected during salon setup.
          </p>
        </div>
        {(salonsQuery.data?.length ?? 0) > 1 && (
          <div className="flex flex-wrap gap-2">
            {(salonsQuery.data ?? []).map((salon) => (
              <Button
                key={salon.id}
                variant={salon.id === salonId ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSalonId(salon.id);
                  setCategoryId(null);
                }}
              >
                {salon.name}
              </Button>
            ))}
          </div>
        )}
      </div>

      {catalogQuery.isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="size-5 animate-spin text-accent" />
        </div>
      ) : categories.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-card px-5 py-16 text-center">
          <BookOpen className="mx-auto size-8 text-accent" />
          <p className="mt-3 font-medium text-foreground">No services yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up a salon and pick service categories to build your catalog.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[240px_1fr]">
          <aside className="rounded-2xl border border-border bg-card p-3">
            <p className="px-2 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Categories
            </p>
            <ul className="space-y-1">
              {categories.map((category) => (
                <li key={category.id}>
                  <button
                    type="button"
                    onClick={() => setCategoryId(category.id)}
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                      category.id === categoryId
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {category.name}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="min-w-0 space-y-5">
            {grouped.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card px-5 py-14 text-center text-sm text-muted-foreground">
                No services in this category yet.
              </div>
            ) : (
              grouped.map(([subcategory, list]) => (
                <div key={subcategory} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="border-b border-border px-5 py-3">
                    <h2 className="font-semibold text-foreground">{subcategory}</h2>
                    <p className="text-xs text-muted-foreground">{list.length} services</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="bg-gold-soft/60 text-left text-xs tracking-wide text-primary uppercase">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Name</th>
                          <th className="px-4 py-3 font-semibold">Price (Rs.)</th>
                          <th className="px-4 py-3 font-semibold">Duration</th>
                          <th className="px-4 py-3 font-semibold">Commission type</th>
                          <th className="px-4 py-3 font-semibold">Commission</th>
                          <th className="px-4 py-3 font-semibold">Max amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {list.map((service) => (
                          <tr key={service.id}>
                            <td className="px-5 py-3 font-medium text-foreground">{service.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{service.price}</td>
                            <td className="px-4 py-3 text-muted-foreground">{service.durationMins} min</td>
                            <td className="px-4 py-3 text-muted-foreground capitalize">{service.commissionType}</td>
                            <td className="px-4 py-3 text-muted-foreground">{service.commissionValue}</td>
                            <td className="px-4 py-3 text-muted-foreground">{service.maxAmount ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
