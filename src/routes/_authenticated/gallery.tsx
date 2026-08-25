import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Images, Loader2 } from "lucide-react";

import { SalonBranchTabs, useSalonBranches } from "@/components/salon-branch-selector";
import { listSalonImages } from "@/lib/salons.functions";

export const Route = createFileRoute("/_authenticated/gallery")({
  head: () => ({ meta: [{ title: "Gallery — Glowante Business" }, { name: "description", content: "Manage photos for each salon branch." }] }),
  component: GalleryPage,
});

type SalonImage = { id: string; public_url: string; storage_path: string; sort_order: number };

function GalleryPage() {
  const { activeSalonId, salons } = useSalonBranches();
  const getImages = useServerFn(listSalonImages);
  const imagesQuery = useQuery({ queryKey: ["salon-images", activeSalonId], queryFn: () => getImages({ data: { salonId: activeSalonId! } }), enabled: Boolean(activeSalonId) });
  const activeSalon = salons.find((salon) => salon.id === activeSalonId);
  const images = (imagesQuery.data ?? []) as SalonImage[];
  return <div className="w-full px-4 py-8"><SalonBranchTabs className="mb-7" /><div><h1 className="font-display text-3xl text-primary">Gallery</h1><p className="mt-1 text-sm text-muted-foreground">Photos for {activeSalon?.name ?? "the selected branch"}. Add or replace photos from the salon setup screen.</p></div>{!activeSalonId ? <div className="mt-8 rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">Add a salon first to view its gallery.</div> : imagesQuery.isLoading ? <div className="flex justify-center py-20"><Loader2 className="size-5 animate-spin text-primary" /></div> : images.length === 0 ? <div className="mt-8 rounded-2xl border border-dashed border-border py-20 text-center"><Images className="mx-auto size-9 text-primary" /><p className="mt-3 font-medium">No photos for this branch yet</p><p className="mt-1 text-sm text-muted-foreground">Add location photos while editing this salon or branch.</p></div> : <><p className="mt-6 text-sm text-muted-foreground">{images.length}/10 photos</p><div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{images.map((image) => <article key={image.id} className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-secondary"><img src={image.public_url} alt="Salon gallery" className="size-full object-cover" /></article>)}</div></>}</div>;
}
