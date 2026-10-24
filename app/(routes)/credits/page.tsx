import type { Metadata } from "next";
import { PixelPanel } from "@/components/ui/PixelPanel";
import { PhotoCredit } from "@/components/ui/PhotoCredit";
import { getSeedPlaces } from "@/data/seed/places";
import { allPlacePhotos } from "@/lib/demo/photos";

export const metadata: Metadata = { title: "Credits · CityDex" };

export default function CreditsPage() {
  const names = new Map(getSeedPlaces().map((p) => [p.id, p.name]));
  const photos = allPlacePhotos().sort((a, b) => (names.get(a.placeId) ?? "").localeCompare(names.get(b.placeId) ?? ""));
  return (
    <div className="mx-auto max-w-screen-sm space-y-4 px-4 py-4">
      <h1 className="font-heading text-3xl text-wood-dark">Credits</h1>
      <PixelPanel>
        <h2 className="font-heading text-xl text-wood-dark">Data</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-wood-dark">
          <li>Map tiles and places: © OpenStreetMap contributors (ODbL).</li>
          <li>County baseline: CDC PLACES, County Data, 2025 release.</li>
          <li>Gasson Hall photo: taken by the CityDex team at Boston College.</li>
          <li>Other demo stamps without a photo use original illustrations made for CityDex.</li>
        </ul>
      </PixelPanel>
      <PixelPanel>
        <h2 className="font-heading text-xl text-wood-dark">Place photos ({photos.length})</h2>
        <p className="text-sm text-wood-dark/80">Freely licensed photos from Wikimedia Commons, shown on demo stamps and place cards.</p>
        <ul className="mt-2 space-y-2">
          {photos.map((p) => (
            <li key={p.placeId} className="flex gap-2 border-t-2 border-wood-dark/20 pt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-12 w-16 shrink-0 border-2 border-wood-dark object-cover" loading="lazy" />
              <div className="min-w-0">
                <p className="font-heading text-sm text-wood-dark">{names.get(p.placeId)}</p>
                <PhotoCredit credit={p.credit} />
              </div>
            </li>
          ))}
        </ul>
      </PixelPanel>
    </div>
  );
}
