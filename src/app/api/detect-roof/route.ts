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
 *   { "provider": "auto" | "mock" | "google-solar" | "osm" | "lod2" }
 *
 * Response:
 *   {
 *     building: DetectedBuilding,
 *     providerSelection: { name, reason }
 *   }
 *
 * Verhalten:
 *   - Provider-Kette aus dem Factory wird der Reihe nach probiert.
 *   - Erster Provider, der ohne Throw zurückkommt, gewinnt.
 *   - Fehler der zwischen-Provider werden in `building.warnings` gesammelt.
 */

import { NextResponse } from "next/server";
import type { DetectedBuilding } from "@/types/solar";
import { selectProviderChain } from "@/lib/providers/providerFactory";
import { geocodeAddress } from "@/lib/api/googleGeocoding";

export const runtime = "nodejs";

type DetectRoofBody = {
  address?: string;
  lat?: number;
  lng?: number;
  provider?: "auto" | "mock" | "google-solar" | "osm" | "lod2";
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

  // 2) Provider-Kette der Reihe nach probieren.
  const chain = selectProviderChain(body.provider ?? "auto");
  const warnings: string[] = [];
  let building: DetectedBuilding | null = null;
  let usedProviderName: string | null = null;

  for (const provider of chain.providers) {
    try {
      building = await provider.detectRoof({
        address: formattedAddress,
        lat,
        lng,
      });
      usedProviderName = provider.name;
      break;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unbekannter Fehler";
      console.warn(
        `[detect-roof] Provider ${provider.name} fehlgeschlagen: ${message}.`,
      );
      warnings.push(`${provider.name}: ${message}`);
      continue;
    }
  }

  if (!building || !usedProviderName) {
    return NextResponse.json(
      {
        error:
          "Kein Provider konnte ein Gebäude liefern.",
        details: warnings,
      },
      { status: 502 },
    );
  }

  if (warnings.length > 0) {
    building.warnings = [...(building.warnings ?? []), ...warnings];
  }

  // Provider-Name aus dem tatsächlich erfolgreichen Provider, plus
  // ehrliche Reason: nutze building.source falls abweichend.
  const actualName = building.source;
  const reason =
    actualName === usedProviderName
      ? chain.reason
      : `Erfolgreich: ${actualName}. ${chain.reason}`;

  return NextResponse.json({
    building,
    providerSelection: {
      name: actualName,
      reason,
    },
  });
}
