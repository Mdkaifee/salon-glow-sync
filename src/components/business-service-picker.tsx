import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type SelectableService = {
  id: string;
  name: string;
  price: number;
  durationMins: number;
  categoryName?: string | null;
  subcategoryName?: string | null;
};

export function BusinessServicePicker({
  services,
  value,
  onChange,
  label = "Select services",
  emptyText = "Add services in Catalog before selecting services here.",
}: {
  services: SelectableService[];
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = new Set(value);
  const grouped = useMemo(() => {
    const categories = new Map<string, Map<string, SelectableService[]>>();
    for (const service of services) {
      const category = service.categoryName || "Services";
      const subcategory = service.subcategoryName || category;
      if (!categories.has(category)) categories.set(category, new Map());
      const subcategories = categories.get(category)!;
      if (!subcategories.has(subcategory)) subcategories.set(subcategory, []);
      subcategories.get(subcategory)!.push(service);
    }
    return [...categories.entries()].map(([category, subcategories]) => ({
      category,
      subcategories: [...subcategories.entries()].map(([subcategory, items]) => ({
        subcategory,
        items,
      })),
    }));
  }, [services]);
  const selectedNames = services
    .filter((service) => selected.has(service.id))
    .map((service) => service.name)
    .slice(0, 2)
    .join(", ");

  function toggle(serviceId: string) {
    onChange(
      selected.has(serviceId) ? value.filter((id) => id !== serviceId) : [...value, serviceId],
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-muted px-3 text-left text-sm transition-colors",
          open && "border-accent ring-1 ring-accent",
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">
          {value.length
            ? `${selectedNames}${value.length > 2 ? ` +${value.length - 2}` : ""}`
            : label}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {services.length ? (
        open && (
          <div className="overflow-hidden rounded-md border border-border bg-card shadow-soft">
            <div className="max-h-56 overflow-y-auto p-4">
              {grouped.map((category) => (
                <section key={category.category} className="space-y-3 pb-2 last:pb-0">
                  <h3 className="text-base font-semibold text-foreground">{category.category}</h3>
                  {category.subcategories.map((subcategory) => (
                    <div key={subcategory.subcategory} className="ml-5 space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        {subcategory.subcategory}
                      </p>
                      <div className="ml-6 space-y-2">
                        {subcategory.items.map((service) => (
                          <label
                            key={service.id}
                            className="flex items-center gap-3 text-sm text-muted-foreground"
                          >
                            <Checkbox
                              checked={selected.has(service.id)}
                              onCheckedChange={() => toggle(service.id)}
                            />
                            <span>{service.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </div>
            <div className="flex justify-end border-t border-border px-4 py-2">
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-full px-4 text-xs"
                onClick={() => setOpen(false)}
              >
                Save selection
              </Button>
            </div>
          </div>
        )
      ) : (
        <div className="rounded-md border border-dashed border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          {emptyText}
        </div>
      )}
    </div>
  );
}
