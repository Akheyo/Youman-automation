/**
 * POST /api/detect-roof
 *
 * Body:
 *   { "address": "Musterstraße 1, 10115 Berlin" }
 *   oder
 *   { "lat": 52.52, "lng": 13.405 }
 *   oder beides (lat/lng hat Vorrang).
 *
 * Optional:
 *   { "provider": "auto" | "mock" | "google-solar" | "lod2" }
 *
 * Response: DetectedBuilding (mit Provider-Info als zusätzliches Feld).
 */

import { NextResponse } from "next/server";
import type { DetectedBuilding } from "@/types/solar";
import { selectRoofDetectionProvider } from "@/lib/providers/providerFactory";
import { MockRoofDetectionProvider } from "@/lib/providers/mockRoofDetectionProvider";
import { geocodeAddress } from "@/lib/api/googleGeocoding";

export const runtime = "nodejs";

type DetectRoofBody = {
  address?: string;
  lat?: number;
  lng?: number;
  provider?: "auto" | "mock" | "google-solar" | "lod2";
};

export async function POST(req: Request) {
  let body: DetectRoofBody;
  try {
    body = (await req.json()) as DetectRoofBody;
  } catch {
    return NextResponse.json(
      { error: "Ungültiger JSON-Body." },
      { status: 400 },
    );
  }

  // 1) Resolve coordinates.
  let lat = typeof body.lat === "number" ? body.lat : undefined;
  let lng = typeof body.lng === "number" ? body.lng : undefined;
  let formattedAddress = body.address;

  if ((lat === undefined || lng === undefined) && body.address) {
    try {
      const geo = await geocodeAddress(body.address);
      lat = geo.lat;
      lng = geo.lng;
      formattedAddress = geo.formattedAddress;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Geocoding fehlgeschlagen";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (lat === undefined || lng === undefined) {
    return NextResponse.json(
      { error: "Bitte Adresse oder lat/lng übermitteln." },
      { status: 400 },
    );
  }

  // 2) Pick provider and try detection. Fallback to mock on error.
  const selection = selectRoofDetectionProvider(body.provider ?? "auto");
  const warnings: string[] = [];
  let building: DetectedBuilding;

  try {
    building = await selection.provider.detectRoof({
      address: formattedAddress,
      lat,
      lng,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.warn(
      `[detect-roof] Provider ${selection.provider.name} fehlgeschlagen: ${message}. Fallback auf Mock.`,
    );
    warnings.push(
      `${selection.provider.name} fehlgeschlagen (${message}). Es werden Demo-Daten angezeigt.`,
    );
    const fallback = new MockRoofDetectionProvider();
    building = await fallback.detectRoof({
      address: formattedAddress,
      lat,
      lng,
    });
  }

  if (warnings.length > 0) {
    building.warnings = [...(building.warnings ?? []), ...warnings];
  }

  // Wichtig: bei Fallback auf Mock soll die UI auch Mock anzeigen, nicht den
  // ursprünglich gewählten Provider. `building.source` wird vom tatsächlich
  // erfolgreichen Provider gesetzt und ist die ehrliche Quelle.
  const actualProviderName = building.source;
  const actualReason =
    actualProviderName === selection.provider.name
      ? selection.reason
      : `${selection.provider.name} hat keine Daten geliefert – Fallback auf ${actualProviderName}.`;

  return NextResponse.json({
    building,
    providerSelection: {
      name: actualProviderName,
      reason: actualReason,
    },
  });
}
