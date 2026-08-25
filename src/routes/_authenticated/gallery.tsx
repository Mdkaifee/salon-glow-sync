import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Images, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { SalonBranchTabs, useSalonBranches } from "@/components/salon-branch-selector";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { deleteSalonImage, listSalonImages, saveSalonImage } from "@/lib/salons.functions";

export const Route = createFileRoute("/_authenticated/gallery")({
  head: () => ({ meta: [{ title: "Gallery — Glowante Business" }, { name: "description", content: "Manage photos for each salon branch." }] }),
  component: GalleryPage,
});

type SalonImage = { id: string; public_url: string; storage_path: string; sort_order: number };

function GalleryPage() {
  const { activeSalonId, salons } = useSalonBranches();
  const queryClient = useQueryClient();
  const getImages = useServerFn(listSalonImages); const saveImage = useServerFn(saveSalonImage); const removeImage = useServerFn(deleteSalonImage);
  const [uploading, setUploading] = useState(false); const inputRef = useRef<HTMLInputElement>(null);
  const imagesQuery = useQuery({ queryKey: ["salon-images", activeSalonId], queryFn: () => getImages({ data: { salonId: activeSalonId! } }), enabled: Boolean(activeSalonId) });
  const activeSalon = salons.find((salon) => salon.id === activeSalonId);
  const images = (imagesQuery.data ?? []) as SalonImage[];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["salon-images", activeSalonId] });

  async function upload(files: FileList | null) {
    const selected = Array.from(files ?? []);
    if (!activeSalonId || !selected.length) return;
    const valid = selected.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 5 * 1024 * 1024);
    const available = Math.max(0, 10 - images.length);
    if (!available) { toast.error("This branch already has the maximum 10 photos."); return; }
    if (valid.length !== selected.length) toast.error("Use JPG, PNG or WebP images up to 5 MB.");
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in again to upload photos.");
      for (const file of valid.slice(0, available)) {
        const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
        const storagePath = `${auth.user.id}/${activeSalonId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("salon-images").upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw new Error(uploadError.message || "Could not upload this photo.");
        const { data: publicUrl } = supabase.storage.from("salon-images").getPublicUrl(storagePath);
        try { await saveImage({ data: { salonId: activeSalonId, storagePath, publicUrl: publicUrl.publicUrl } }); }
        catch (error) { await supabase.storage.from("salon-images").remove([storagePath]); throw error; }
      }
      toast.success("Gallery updated for this branch"); void refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not upload photos"); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  async function remove(image: SalonImage) {
    if (!activeSalonId || !window.confirm("Remove this branch photo?")) return;
    try { await removeImage({ data: { salonId: activeSalonId, id: image.id } }); await supabase.storage.from("salon-images").remove([image.storage_path]); toast.success("Photo removed"); void refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not remove photo"); }
  }

  return <div className="mx-auto w-full max-w-6xl px-5 py-8"><SalonBranchTabs className="mb-7" /><div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-display text-3xl text-primary">Gallery</h1><p className="mt-1 text-sm text-muted-foreground">Photos for {activeSalon?.name ?? "the selected branch"}. Each branch has its own gallery.</p></div><div><input ref={inputRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => void upload(event.target.files)} /><Button disabled={!activeSalonId || uploading || images.length >= 10} onClick={() => inputRef.current?.click()}>{uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} Add photos</Button></div></div>{!activeSalonId ? <div className="mt-8 rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">Add a salon first to manage its gallery.</div> : imagesQuery.isLoading ? <div className="flex justify-center py-20"><Loader2 className="size-5 animate-spin text-primary" /></div> : images.length === 0 ? <div className="mt-8 rounded-2xl border border-dashed border-border py-20 text-center"><Images className="mx-auto size-9 text-primary" /><p className="mt-3 font-medium">No photos for this branch yet</p><p className="mt-1 text-sm text-muted-foreground">Upload photos that represent this specific location.</p></div> : <><p className="mt-6 text-sm text-muted-foreground">{images.length}/10 photos</p><div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{images.map((image) => <article key={image.id} className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-secondary"><img src={image.public_url} alt="Salon gallery" className="size-full object-cover" /><button aria-label="Remove photo" onClick={() => void remove(image)} className="absolute right-3 top-3 hidden rounded-full bg-card/95 p-2 text-destructive shadow-sm group-hover:block"><Trash2 className="size-4" /></button></article>)}</div></>}</div>;
}
