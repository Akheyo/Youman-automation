import SolarPlanner from "@/components/SolarPlanner";
import type { MapSettings } from "@/types/solar";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const mapSettings: MapSettings = {
    tileUrl: process.env.NEXT_PUBLIC_TILE_URL,
    tileAttribution: process.env.NEXT_PUBLIC_TILE_ATTRIBUTION,
  };
  return (
    <main className="flex h-screen w-screen overflow-hidden">
      <SolarPlanner mapSettings={mapSettings} />
    </main>
  );
}
