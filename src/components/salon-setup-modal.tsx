import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, ImagePlus, Info, Loader2, MapPin, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { createSalon, deleteSalonImage, getSalonHours, listSalonImages, listSalons, listServiceCategories, saveSalonImage, updateSalon } from "@/lib/salons.functions";
import { getMyProfile } from "@/lib/auth.functions";
import { countryForIso, PHONE_COUNTRIES, phoneMaxLength, splitPhone, toE164 } from "@/lib/phone";
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
    isOpen: true,
    openTime: "08:00",
    closeTime: "20:00",
  }));

const TIME_OPTIONS = Array.from({ length: 144 }, (_, index) => {
  const hour = Math.floor(index / 6);
  const minute = (index % 6) * 10;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
});
const OPEN_TIME_OPTIONS = TIME_OPTIONS.slice(0, -1);
const closeTimeOptions = (openTime: string) => TIME_OPTIONS.filter((time) => time > openTime);
const firstCloseTime = (openTime: string) => closeTimeOptions(openTime)[0] ?? "23:50";

function TimeSelect({
  value,
  onValueChange,
  options,
  disabled = false,
  id,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} className={cn("h-11 bg-card", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((time) => <SelectItem key={time} value={time}>{time}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

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
  onSaved: (salonId?: string) => void;
}) {
  const isEdit = target.mode === "edit";
  const totalSteps = isEdit ? 2 : 3;
  const create = useServerFn(createSalon);
  const update = useServerFn(updateSalon);
  const fetchCategories = useServerFn(listServiceCategories);
  const fetchSalons = useServerFn(listSalons);
  const fetchHours = useServerFn(getSalonHours);
  const fetchProfile = useServerFn(getMyProfile);
  const fetchImages = useServerFn(listSalonImages);
  const saveImage = useServerFn(saveSalonImage);
  const removeImage = useServerFn(deleteSalonImage);
  const fileInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copyMonday, setCopyMonday] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [copyCatalogFromId, setCopyCatalogFromId] = useState<string | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [hours, setHours] = useState<SalonHourInput[]>(defaultHours);
  const initialPhone = splitPhone(target.salon?.phone);
  const [countryIso, setCountryIso] = useState<string>(initialPhone.country.iso);
  const [details, setDetails] = useState({
    name: target.salon?.name ?? "",
    phone: initialPhone.nationalNumber,
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
  const phoneCountry = countryForIso(countryIso);

  const categoriesQuery = useQuery({
    queryKey: ["service-categories"],
    queryFn: () => fetchCategories(),
    enabled: !isEdit,
  });
  const catalogSourcesQuery = useQuery({
    queryKey: ["salons"],
    queryFn: () => fetchSalons(),
    enabled: target.mode === "create-branch",
  });
  const catalogSources = useMemo(
    () =>
      (catalogSourcesQuery.data ?? []).filter(
        (salon) => salon.id === target.parentId || salon.parent_id === target.parentId,
      ),
    [catalogSourcesQuery.data, target.parentId],
  );

  const savedHoursQuery = useQuery({
    queryKey: ["salon-hours", target.salon?.id],
    queryFn: () => fetchHours({ data: { salonId: target.salon!.id } }),
    enabled: Boolean(isEdit && target.salon?.id),
  });
  const profileQuery = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });
  const imagesQuery = useQuery({
    queryKey: ["salon-images", target.salon?.id],
    queryFn: () => fetchImages({ data: { salonId: target.salon!.id } }),
    enabled: Boolean(target.salon?.id),
  });

  useEffect(() => {
    const saved = savedHoursQuery.data;
    if (step !== 1 || !saved || saved.length === 0) return;
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
  }, [savedHoursQuery.data, step]);

  useEffect(() => {
    const signupPhone = profileQuery.data?.phone;
    if (!target.salon && signupPhone && !details.phone) {
      const parsedPhone = splitPhone(signupPhone);
      setCountryIso(parsedPhone.country.iso);
      setDetails((previous) => ({ ...previous, phone: parsedPhone.nationalNumber }));
    }
  }, [details.phone, profileQuery.data?.phone, target.salon]);

  useEffect(() => {
    if (!copyMonday) return;
    setHours((prev) => {
      const monday = prev[0]!;
      return prev.map((day) => ({ ...day, openTime: monday.openTime, closeTime: monday.closeTime, isOpen: monday.isOpen }));
    });
  }, [copyMonday]);

  const aboutLeft = useMemo(() => 250 - details.about.length, [details.about]);

  // Address autocomplete (OpenStreetMap search, India-scoped)
  const [addressQuery, setAddressQuery] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<
    { label: string; lat: number; lon: number }[]
  >([]);

  useEffect(() => {
    const term = addressQuery.trim();
    if (term.length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=in&limit=6&q=${encodeURIComponent(term)}`,
          { signal: controller.signal, headers: { Accept: "application/json" } },
        );
        const json = (await response.json()) as { display_name: string; lat: string; lon: string }[];
        setSuggestions(
          json.map((item) => ({
            label: item.display_name,
            lat: Number(item.lat),
            lon: Number(item.lon),
          })),
        );
        setSuggestOpen(true);
      } catch {
        /* aborted or offline */
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [addressQuery]);

  function validateDetails() {
    const parsed = salonDetailsSchema.safeParse({ ...details, phone: toE164(phoneCountry, details.phone) });
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
    if (!isEdit && selected.length === 0 && !copyCatalogFromId) {
      toast.error("Select services or copy an existing catalog");
      return;
    }
    setSaving(true);
    try {
      let savedSalonId = target.salon?.id;
      if (isEdit) {
        await update({ data: { ...details, phone: toE164(phoneCountry, details.phone), id: target.salon!.id, hours } });
        toast.success("Salon updated");
      } else {
        const created = await create({
          data: { ...details, phone: toE164(phoneCountry, details.phone), parentId: target.parentId ?? null, hours, categoryIds: selected, copyCatalogFromId: copyCatalogFromId ?? undefined },
        });
        savedSalonId = created.id;
        toast.success(target.mode === "create-branch" ? "Branch added" : "Salon created");
      }
      if (savedSalonId && pendingPhotos.length > 0) await uploadPendingPhotos(savedSalonId);
      onSaved(isEdit ? undefined : savedSalonId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPendingPhotos(salonId: string) {
    setUploadingPhotos(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in again to upload photos.");
      for (const file of pendingPhotos) {
        const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
        const path = `${auth.user.id}/${salonId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("salon-images").upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw new Error(uploadError.message || "Could not upload a salon photo.");
        const { data: url } = supabase.storage.from("salon-images").getPublicUrl(path);
        try {
          await saveImage({ data: { salonId, storagePath: path, publicUrl: url.publicUrl } });
        } catch (error) {
          await supabase.storage.from("salon-images").remove([path]);
          throw error;
        }
      }
      setPendingPhotos([]);
      toast.success("Salon photos uploaded");
    } finally {
      setUploadingPhotos(false);
    }
  }

  async function compressPhoto(file: File) {
    const image = await createImageBitmap(file);
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare this photo.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close();
    let quality = 0.84;
    let blob: Blob | null = null;
    do {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      quality -= 0.08;
    } while (blob && blob.size > 4.5 * 1024 * 1024 && quality >= 0.44);
    if (!blob || blob.size > 4.5 * 1024 * 1024) throw new Error("This photo is too large to compress for upload.");
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "salon-photo"}.jpg`, { type: "image/jpeg" });
  }

  async function choosePhotos(files: FileList | null) {
    const candidates = Array.from(files ?? []);
    const valid = candidates.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 20 * 1024 * 1024);
    const existingCount = imagesQuery.data?.length ?? 0;
    const available = Math.max(0, 10 - existingCount - pendingPhotos.length);
    if (valid.length !== candidates.length) toast.error("Use JPG, PNG or WebP images up to 20 MB each.");
    if (valid.length > available) toast.error(`You can add ${available} more photo${available === 1 ? "" : "s"}.`);
    try {
      const compressed = await Promise.all(valid.slice(0, available).map(compressPhoto));
      setPendingPhotos((prev) => [...prev, ...compressed]);
      if (compressed.length) toast.success("Photos compressed and ready to upload");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not compress this photo.");
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  async function deleteExistingPhoto(image: { id: string; storage_path: string }) {
    if (!target.salon || !window.confirm("Remove this salon photo?")) return;
    try {
      const result = await removeImage({ data: { salonId: target.salon.id, id: image.id } });
      await supabase.storage.from("salon-images").remove([result.storagePath]);
      toast.success("Photo removed");
      void imagesQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove photo");
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
                      {errors["name"] && <p className="text-sm text-destructive">{errors["name"]}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salon-phone">Phone number*</Label>
                      <div className="flex items-stretch overflow-hidden rounded-lg border border-input">
                        <select aria-label="Country" value={countryIso} onChange={(event) => setCountryIso(event.target.value)} className="w-44 shrink-0 border-r border-input bg-secondary px-2 text-sm text-primary outline-none">
                          {PHONE_COUNTRIES.map((country) => <option key={country.iso} value={country.iso}>{country.name} (+{country.dialCode})</option>)}
                        </select>
                        <input
                          id="salon-phone"
                          inputMode="numeric"
                          maxLength={phoneMaxLength(phoneCountry)}
                          placeholder={`Phone number (+${phoneCountry.dialCode})`}
                          value={details.phone}
                          onChange={(event) =>
                            setDetails({ ...details, phone: event.target.value.replace(/\D/g, "").slice(0, 10) })
                          }
                          className="w-full bg-transparent px-3 py-2 text-sm outline-none"
                        />
                      </div>
                      {errors["phone"] && <p className="text-sm text-destructive">{errors["phone"]}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="open-time">Open time* <span className="font-normal text-muted-foreground">(24-hour)</span></Label>
                      <TimeSelect
                        id="open-time"
                        value={details.openTime}
                        options={OPEN_TIME_OPTIONS}
                        onValueChange={(openTime) =>
                          setDetails((previous) => ({
                            ...previous,
                            openTime,
                            closeTime: previous.closeTime > openTime ? previous.closeTime : firstCloseTime(openTime),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="close-time">Close time* <span className="font-normal text-muted-foreground">(24-hour)</span></Label>
                      <TimeSelect
                        id="close-time"
                        value={details.closeTime}
                        options={closeTimeOptions(details.openTime)}
                        onValueChange={(closeTime) => setDetails({ ...details, closeTime })}
                      />
                      {errors["closeTime"] && <p className="text-sm text-destructive">{errors["closeTime"]}</p>}
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
                    <div className="relative space-y-2">
                      <Label htmlFor="address">Address*</Label>
                      <div className="relative">
                        <Input
                          id="address"
                          value={details.address}
                          maxLength={300}
                          autoComplete="off"
                          placeholder="Start typing your address, then pick a suggestion"
                          className="bg-gold-soft/60 pr-9"
                          onChange={(event) => {
                            setDetails({ ...details, address: event.target.value, latitude: null, longitude: null });
                            setAddressQuery(event.target.value);
                          }}
                          onFocus={() => suggestions.length > 0 && setSuggestOpen(true)}
                          onBlur={() => window.setTimeout(() => setSuggestOpen(false), 150)}
                        />
                        {searching && (
                          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-accent" />
                        )}
                      </div>
                      {suggestOpen && suggestions.length > 0 && (
                        <ul className="absolute top-full right-0 left-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-card py-1 shadow-elegant">
                          {suggestions.map((item) => (
                            <li key={`${item.lat}-${item.lon}-${item.label}`}>
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setDetails((prev) => ({
                                    ...prev,
                                    address: item.label.slice(0, 300),
                                    latitude: item.lat,
                                    longitude: item.lon,
                                  }));
                                  setSuggestOpen(false);
                                  setSuggestions([]);
                                  setAddressQuery("");
                                }}
                                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-gold-soft"
                              >
                                <MapPin className="mt-0.5 size-3.5 shrink-0 text-accent" />
                                <span>{item.label}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {errors["address"] && <p className="text-sm text-destructive">{errors["address"]}</p>}
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
                      {errors["about"] ? (
                        <p className="text-sm text-destructive">{errors["about"]}</p>
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
                      <p className="text-sm text-muted-foreground">Set opening and closing times for each day in 24-hour format (HH:MM)</p>
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
                          <TimeSelect
                            className="w-32"
                            disabled={!day.isOpen}
                            value={day.openTime}
                            options={OPEN_TIME_OPTIONS}
                            onValueChange={(openTime) =>
                              setHours((prev) =>
                                prev.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        openTime,
                                        closeTime: item.closeTime > openTime ? item.closeTime : firstCloseTime(openTime),
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                          <span className="text-sm text-muted-foreground">to</span>
                          <TimeSelect
                            className="w-32"
                            disabled={!day.isOpen}
                            value={day.closeTime}
                            options={closeTimeOptions(day.openTime)}
                            onValueChange={(closeTime) =>
                              setHours((prev) =>
                                prev.map((item, i) =>
                                  i === index ? { ...item, closeTime } : item,
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
                  {target.mode === "create-branch" && (
                    <section className="mb-8 rounded-xl border border-gold-soft bg-gold-soft/35 p-5">
                      <p className="font-semibold text-primary">Copy services from an existing branch</p>
                      <p className="mt-1 text-sm text-muted-foreground">Copy every predefined and custom category, service type and service. Future edits stay separate for each branch.</p>
                      {catalogSourcesQuery.isLoading ? <Loader2 className="mt-4 size-4 animate-spin text-primary" /> : <div className="mt-4 flex flex-wrap gap-2">{catalogSources.map((salon) => <label key={salon.id} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium transition-colors", copyCatalogFromId === salon.id ? "border-primary text-primary" : "border-border hover:bg-secondary")}><input type="radio" name="catalog-source" checked={copyCatalogFromId === salon.id} onChange={() => { setCopyCatalogFromId(salon.id); setSelected([]); }} />{salon.name}</label>)}{copyCatalogFromId && <button type="button" className="px-2 text-xs font-semibold text-primary hover:underline" onClick={() => setCopyCatalogFromId(null)}>Choose predefined services instead</button>}</div>}
                    </section>
                  )}
                  <h3 className="text-center text-2xl font-semibold text-foreground">Select Services</h3>
                  <p className="mt-1 text-center text-sm text-muted-foreground">
                    {copyCatalogFromId ? "This branch will receive an independent copy of the selected catalog." : "Choose the services that best describe your salon. You can select multiple options."}
                  </p>
                  {categoriesQuery.isLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="size-5 animate-spin text-accent" />
                    </div>
                  ) : categoriesQuery.isError ? (
                    <div className="rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-5 py-8 text-center">
                      <p className="text-sm font-medium text-foreground">Predefined services could not be loaded.</p>
                      <p className="mt-1 text-xs text-muted-foreground">Please retry; your previously entered salon details are safe.</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => void categoriesQuery.refetch()}>Retry</Button>
                    </div>
                  ) : (
                    <div className={cn("mt-6 grid grid-cols-3 gap-5 sm:grid-cols-4 lg:grid-cols-5", copyCatalogFromId && "pointer-events-none opacity-45")}>
                      {(categoriesQuery.data ?? []).map((category) => {
                        const active = selected.includes(category.id);
                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => { setCopyCatalogFromId(null); setSelected((prev) => prev.includes(category.id) ? prev.filter((id) => id !== category.id) : [...prev, category.id]); }}
                            className="group flex flex-col items-center gap-2"
                          >
                            <span
                              className={cn(
                                "relative flex size-20 items-center justify-center overflow-hidden rounded-full border-2 bg-gold-soft text-center text-xs font-semibold text-primary shadow-sm transition-all hover:scale-105",
                                active ? "border-accent shadow-elegant" : "border-border",
                              )}
                            >
                              {category.image_url ? (
                                <img src={category.image_url} alt="" className="size-full object-cover" />
                              ) : (
                                category.name.split(" ")[0]
                              )}
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
                    if (step === 1) {
                      setCopyMonday(false);
                      setHours(
                        DAY_NAMES.map((_, index) => ({
                          dayOfWeek: index,
                          isOpen: true,
                          openTime: details.openTime,
                          closeTime: details.closeTime,
                        })),
                      );
                    }
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
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => void choosePhotos(event.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={(imagesQuery.data?.length ?? 0) + pendingPhotos.length >= 10 || uploadingPhotos}
              className="rounded-xl border border-dashed border-accent/60 bg-card/60 p-5 text-center transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ImagePlus className="mx-auto size-6 text-accent" />
              <p className="mt-2 text-sm font-semibold text-foreground">Add Gallery Photos</p>
              <p className="mt-1 text-xs text-muted-foreground">JPG, PNG or WebP · automatically compressed · up to 10 photos</p>
            </button>
            <p className="text-center text-xs font-medium text-primary">
              {(imagesQuery.data?.length ?? 0) + pendingPhotos.length}/10 photos selected
            </p>
            {((imagesQuery.data?.length ?? 0) > 0 || pendingPhotos.length > 0) && (
              <div className="grid grid-cols-3 gap-2">
                {(imagesQuery.data ?? []).map((image) => (
                  <div key={image.id} className="group relative aspect-square overflow-hidden rounded-lg bg-secondary">
                    <img src={image.public_url} alt="Salon gallery" className="size-full object-cover" />
                    <button type="button" onClick={() => void deleteExistingPhoto(image)} className="absolute right-1 top-1 hidden rounded-full bg-card/90 p-1 text-destructive shadow group-hover:block" aria-label="Remove photo"><Trash2 className="size-3" /></button>
                  </div>
                ))}
                {pendingPhotos.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="group relative aspect-square overflow-hidden rounded-lg bg-secondary">
                    <img src={URL.createObjectURL(file)} alt="New salon upload" className="size-full object-cover" />
                    <button type="button" onClick={() => setPendingPhotos((value) => value.filter((_, photoIndex) => photoIndex !== index))} className="absolute right-1 top-1 hidden rounded-full bg-card/90 p-1 text-destructive shadow group-hover:block" aria-label="Remove new photo"><Trash2 className="size-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-auto rounded-xl bg-card p-4 text-sm text-muted-foreground">
              Photos are saved when you save the salon. A salon is your primary branch; use “Add Branch” for additional locations.
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
