import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, Info, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createSalon, getSalonHours, listServiceCategories, updateSalon } from "@/lib/salons.functions";
import { DAY_NAMES, salonDetailsSchema, type SalonHourInput } from "@/lib/validation";

type Mode = "create-salon" | "create-branch" | "edit";

export type SalonSetupTarget = {
  mode: Mode;
  parentId?: string | null;
  salon?: {
    id: string;
    name: string;
    phone: string;
    open_time: string;
    close_time: string;
    is_stylist: boolean;
    address: string | null;
    house_no: string | null;
    street: string | null;
    about: string | null;
    latitude: number | null;
    longitude: number | null;
  };
};

const defaultHours = (): SalonHourInput[] =>
  DAY_NAMES.map((_, index) => ({
    dayOfWeek: index,
    isOpen: index !== 6,
    openTime: "08:00",
    closeTime: "20:00",
  }));

function titleFor(mode: Mode, step: number) {
  if (step === 1) return mode === "edit" ? "Edit Salon" : mode === "create-branch" ? "Branch Setup" : "Salon Setup";
  if (step === 2) return "Weekly Working Hours";
  return "Select Services";
}

export function SalonSetupModal({
  target,
  onClose,
  onSaved,
}: {
  target: SalonSetupTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = target.mode === "edit";
  const totalSteps = isEdit ? 2 : 3;
  const create = useServerFn(createSalon);
  const update = useServerFn(updateSalon);
  const fetchCategories = useServerFn(listServiceCategories);
  const fetchHours = useServerFn(getSalonHours);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copyMonday, setCopyMonday] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [hours, setHours] = useState<SalonHourInput[]>(defaultHours);
  const [details, setDetails] = useState({
    name: target.salon?.name ?? "",
    phone: target.salon?.phone ?? "",
    openTime: target.salon?.open_time?.slice(0, 5) ?? "08:00",
    closeTime: target.salon?.close_time?.slice(0, 5) ?? "20:00",
    isStylist: target.salon?.is_stylist ?? false,
    address: target.salon?.address ?? "",
    houseNo: target.salon?.house_no ?? "",
    street: target.salon?.street ?? "",
    about: target.salon?.about ?? "",
    latitude: target.salon?.latitude ?? null,
    longitude: target.salon?.longitude ?? null,
  });

  const categoriesQuery = useQuery({
    queryKey: ["service-categories"],
    queryFn: () => fetchCategories(),
    enabled: !isEdit,
  });

  const savedHoursQuery = useQuery({
    queryKey: ["salon-hours", target.salon?.id],
    queryFn: () => fetchHours({ data: { salonId: target.salon!.id } }),
    enabled: Boolean(isEdit && target.salon?.id),
  });

  useEffect(() => {
    const saved = savedHoursQuery.data;
    if (!saved || saved.length === 0) return;
    setHours(
      DAY_NAMES.map((_, index) => {
        const row = saved.find((item) => item.day_of_week === index);
        return {
          dayOfWeek: index,
          isOpen: row?.is_open ?? true,
          openTime: row?.open_time?.slice(0, 5) ?? "08:00",
          closeTime: row?.close_time?.slice(0, 5) ?? "20:00",
        };
      }),
    );
  }, [savedHoursQuery.data]);

  useEffect(() => {
    if (!copyMonday) return;
    setHours((prev) => {
      const monday = prev[0]!;
      return prev.map((day) => ({ ...day, openTime: monday.openTime, closeTime: monday.closeTime, isOpen: monday.isOpen }));
    });
  }, [copyMonday]);

  const aboutLeft = useMemo(() => 250 - details.about.length, [details.about]);

  function validateDetails() {
    const parsed = salonDetailsSchema.safeParse(details);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return false;
    }
    if (details.openTime >= details.closeTime) {
      setErrors({ closeTime: "Closing time must be after opening time" });
      return false;
    }
    setErrors({});
    return true;
  }

  function validateHours() {
    const invalid = hours.find((day) => day.isOpen && day.openTime >= day.closeTime);
    if (invalid) {
      toast.error(`${DAY_NAMES[invalid.dayOfWeek]}: closing time must be after opening time`);
      return false;
    }
    if (!hours.some((day) => day.isOpen)) {
      toast.error("Keep at least one day open");
      return false;
    }
    return true;
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Location is not supported on this device");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
          );
          const json = (await response.json()) as { display_name?: string };
          setDetails((prev) => ({
            ...prev,
            latitude,
            longitude,
            address: json.display_name ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          }));
          toast.success("Location captured");
        } catch {
          setDetails((prev) => ({
            ...prev,
            latitude,
            longitude,
            address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          }));
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast.error("Could not access your location");
      },
    );
  }

  async function handleSubmit() {
    if (!validateHours()) return;
    if (!isEdit && selected.length === 0) {
      toast.error("Select at least one service category");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await update({ data: { ...details, id: target.salon!.id, hours } });
        toast.success("Salon updated");
      } else {
        await create({
          data: { ...details, parentId: target.parentId ?? null, hours, categoryIds: selected },
        });
        toast.success(target.mode === "create-branch" ? "Branch added" : "Salon created");
      }
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4 backdrop-blur-sm sm:items-center">
      <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl bg-card shadow-elegant">
        <div className="grid lg:grid-cols-[1fr_320px]">
          <div className="flex max-h-[86vh] flex-col">
            <div className="border-b border-border px-6 py-5">
              <h2 className="text-2xl font-semibold text-foreground">{titleFor(target.mode, step)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {step === 1
                  ? "Tell us about your salon and where clients can find you."
                  : step === 2
                    ? "Define the standard operating times for your salon."
                    : "Choose the services that best describe your salon."}
              </p>
              <div className="mt-4 flex items-center gap-3">
                {Array.from({ length: totalSteps }).map((_, index) => {
                  const value = index + 1;
                  const labels = ["Details", "Schedule", "Services"];
                  return (
                    <div key={value} className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
                          step >= value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        {value}
                      </span>
                      <span
                        className={cn(
                          "text-sm font-medium",
                          step >= value ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {labels[index]}
                      </span>
                      {value < totalSteps && <span className="h-px w-8 bg-border" />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {step === 1 && (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="salon-name">Salon name*</Label>
                      <Input
                        id="salon-name"
                        value={details.name}
                        maxLength={80}
                        placeholder="Enter salon name"
                        onChange={(event) => setDetails({ ...details, name: event.target.value })}
                      />
                      {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salon-phone">Phone number*</Label>
                      <div className="flex items-stretch overflow-hidden rounded-lg border border-input">
                        <span className="flex items-center gap-1.5 border-r border-input bg-secondary px-3 text-sm text-primary">
                          🇮🇳 +91
                        </span>
                        <input
                          id="salon-phone"
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="98765 43210"
                          value={details.phone}
                          onChange={(event) =>
                            setDetails({ ...details, phone: event.target.value.replace(/\D/g, "").slice(0, 10) })
                          }
                          className="w-full bg-transparent px-3 py-2 text-sm outline-none"
                        />
                      </div>
                      {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="open-time">Open time*</Label>
                      <Input
                        id="open-time"
                        type="time"
                        value={details.openTime}
                        onChange={(event) => setDetails({ ...details, openTime: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="close-time">Close time*</Label>
                      <Input
                        id="close-time"
                        type="time"
                        value={details.closeTime}
                        onChange={(event) => setDetails({ ...details, closeTime: event.target.value })}
                      />
                      {errors.closeTime && <p className="text-sm text-destructive">{errors.closeTime}</p>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-gold-soft px-4 py-3">
                    <span className="text-sm font-medium text-foreground">Are you also a stylist?</span>
                    <Switch
                      checked={details.isStylist}
                      onCheckedChange={(value) => setDetails({ ...details, isStylist: value })}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                        <MapPin className="size-4 text-accent" /> Location Details
                      </h3>
                      <Button size="sm" onClick={() => void useCurrentLocation()} disabled={locating}>
                        {locating ? <Loader2 className="size-3.5 animate-spin" /> : <MapPin className="size-3.5" />}
                        Use current location
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address*</Label>
                      <Input
                        id="address"
                        value={details.address}
                        maxLength={300}
                        placeholder="Search and select an address"
                        className="bg-gold-soft/60"
                        onChange={(event) => setDetails({ ...details, address: event.target.value })}
                      />
                      {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="house">SCO No / Flat No / House No</Label>
                        <Input
                          id="house"
                          value={details.houseNo}
                          maxLength={60}
                          placeholder="Enter SCO / Flat / House number"
                          onChange={(event) => setDetails({ ...details, houseNo: event.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="street">Street / Sector / Area</Label>
                        <Input
                          id="street"
                          value={details.street}
                          maxLength={120}
                          placeholder="Enter street, sector, or area"
                          onChange={(event) => setDetails({ ...details, street: event.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                      <Info className="size-4 text-accent" /> About us *
                    </h3>
                    <Textarea
                      value={details.about}
                      maxLength={250}
                      rows={4}
                      placeholder="Enter description"
                      onChange={(event) => setDetails({ ...details, about: event.target.value })}
                    />
                    <div className="flex items-center justify-between">
                      {errors.about ? (
                        <p className="text-sm text-destructive">{errors.about}</p>
                      ) : (
                        <span />
                      )}
                      <span className="text-xs text-muted-foreground">{aboutLeft} letters left</span>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Standard Week</h3>
                      <p className="text-sm text-muted-foreground">Set opening and closing times for each day</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-medium text-primary">
                      <Checkbox
                        checked={copyMonday}
                        onCheckedChange={(value) => setCopyMonday(value === true)}
                      />
                      Copy Monday schedule to all days
                    </label>
                  </div>
                  <div className="space-y-3">
                    {hours.map((day, index) => (
                      <div
                        key={day.dayOfWeek}
                        className="flex flex-wrap items-center gap-4 rounded-xl border border-border px-4 py-3"
                      >
                        <Switch
                          checked={day.isOpen}
                          onCheckedChange={(value) =>
                            setHours((prev) =>
                              prev.map((item, i) => (i === index ? { ...item, isOpen: value } : item)),
                            )
                          }
                        />
                        <span className="w-28 text-sm font-medium text-foreground">{DAY_NAMES[index]}</span>
                        <div className="ml-auto flex items-center gap-3">
                          <Input
                            type="time"
                            className="w-32"
                            disabled={!day.isOpen}
                            value={day.openTime}
                            onChange={(event) =>
                              setHours((prev) =>
                                prev.map((item, i) =>
                                  i === index ? { ...item, openTime: event.target.value } : item,
                                ),
                              )
                            }
                          />
                          <span className="text-sm text-muted-foreground">to</span>
                          <Input
                            type="time"
                            className="w-32"
                            disabled={!day.isOpen}
                            value={day.closeTime}
                            onChange={(event) =>
                              setHours((prev) =>
                                prev.map((item, i) =>
                                  i === index ? { ...item, closeTime: event.target.value } : item,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <h3 className="text-center text-2xl font-semibold text-foreground">Select Services</h3>
                  <p className="mt-1 text-center text-sm text-muted-foreground">
                    Choose the services that best describe your salon. You can select multiple options.
                  </p>
                  {categoriesQuery.isLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="size-5 animate-spin text-accent" />
                    </div>
                  ) : (
                    <div className="mt-6 grid grid-cols-3 gap-5 sm:grid-cols-4 lg:grid-cols-5">
                      {(categoriesQuery.data ?? []).map((category) => {
                        const active = selected.includes(category.id);
                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() =>
                              setSelected((prev) =>
                                prev.includes(category.id)
                                  ? prev.filter((id) => id !== category.id)
                                  : [...prev, category.id],
                              )
                            }
                            className="group flex flex-col items-center gap-2"
                          >
                            <span
                              className={cn(
                                "relative flex size-20 items-center justify-center rounded-full border-2 bg-gold-soft text-center text-xs font-semibold text-primary transition-all",
                                active ? "border-accent shadow-elegant" : "border-border",
                              )}
                            >
                              {category.name.split(" ")[0]}
                              {active && (
                                <span className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                  <Check className="size-3.5" />
                                </span>
                              )}
                            </span>
                            <span className="text-xs font-semibold text-foreground">{category.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
              {step > 1 ? (
                <Button variant="ghost" onClick={() => setStep((value) => value - 1)}>
                  <ArrowLeft className="size-4" /> Back
                </Button>
              ) : (
                <span />
              )}
              {step < totalSteps ? (
                <Button
                  size="lg"
                  onClick={() => {
                    if (step === 1 && !validateDetails()) return;
                    if (step === 2 && !validateHours()) return;
                    setStep((value) => value + 1);
                  }}
                >
                  {step === 1 ? "Continue" : "Next"} <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button size="lg" disabled={saving} onClick={() => void handleSubmit()}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {isEdit ? "Save changes" : "Submit"}
                </Button>
              )}
            </div>
          </div>

          <aside className="hidden flex-col gap-4 border-l border-border bg-gold-soft/50 p-6 lg:flex">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Camera className="size-4 text-accent" /> Salon Gallery
            </h3>
            <div className="rounded-xl border border-dashed border-accent/60 bg-card/60 p-6 text-center">
              <Camera className="mx-auto size-6 text-accent" />
              <p className="mt-2 text-sm font-semibold text-foreground">Add Gallery Photos</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Showcase your luxurious interior to attract more clients. Add up to 10 photos per salon.
              </p>
            </div>
            <div className="mt-auto rounded-xl bg-card p-4 text-sm text-muted-foreground">
              Completing your profile increases booking visibility by up to <strong className="text-foreground">40%</strong>.
            </div>
          </aside>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}
