import { CheckSquare, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type SelectableService = {
  id: string;
  name: string;
  price: number;
  durationMins: number;
};

export function BusinessServicePicker({
  services,
  value,
  onChange,
  emptyText = "Add services in Catalog before selecting services here.",
}: {
  services: SelectableService[];
  value: string[];
  onChange: (next: string[]) => void;
  emptyText?: string;
}) {
  const selected = new Set(value);
  const allSelected = services.length > 0 && services.every((service) => selected.has(service.id));
  const toggle = (serviceId: string) => {
    onChange(
      selected.has(serviceId) ? value.filter((id) => id !== serviceId) : [...value, serviceId],
    );
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Assigned services</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!services.length}
          onClick={() => onChange(allSelected ? [] : services.map((service) => service.id))}
        >
          {allSelected ? <Square className="size-4" /> : <CheckSquare className="size-4" />}
          {allSelected ? "Clear" : "Select all"}
        </Button>
      </div>
      {services.length ? (
        <div className="grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-border p-2 sm:grid-cols-2">
          {services.map((service) => {
            const checked = selected.has(service.id);
            return (
              <label
                key={service.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
                  checked
                    ? "border-primary bg-gold-soft/50"
                    : "border-border bg-card hover:bg-secondary/60",
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(service.id)}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{service.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Rs {service.price.toLocaleString("en-IN")} - {service.durationMins} min
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-5 text-sm text-muted-foreground">
          {emptyText}
        </div>
      )}
    </div>
  );
}
