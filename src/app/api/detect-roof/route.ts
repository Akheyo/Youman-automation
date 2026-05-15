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
  provider?: "auto" | "mock" | "google-solar" | "osm" | "vision" | "lod2";
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
  const providerNames = chain.providers.map((p) => p.name).join(" → ");
  console.log(
    `[detect-roof] Kette: ${providerNames} für lat=${lat.toFixed(5)}, lng=${lng.toFixed(5)}`,
  );
  console.log(
    `[detect-roof] env: GOOGLE_SOLAR_API_KEY=${process.env.GOOGLE_SOLAR_API_KEY ? "set" : "missing"}, ` +
      `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY ? "set" : "missing"}, ` +
      `MAPTILER_API_KEY=${process.env.MAPTILER_API_KEY ? "set" : (process.env.NEXT_PUBLIC_TILE_URL?.includes("key=") ? "set (NEXT_PUBLIC_TILE_URL)" : "missing")}`,
  );

  // Pro Provider: failures sammeln, damit das UI bei Total-Fehler eine
  // strukturierte Begründung anzeigen kann (Google: ... / Vision: ... / OSM: ...).
  type ProviderAttempt = { name: string; status: "ok" | "error"; message?: string };
  const attempts: ProviderAttempt[] = [];
  let building: DetectedBuilding | null = null;
  let usedProviderName: string | null = null;

  for (const provider of chain.providers) {
    console.log(`[detect-roof] versuche Provider: ${provider.name}`);
    try {
      building = await provider.detectRoof({
        address: formattedAddress,
        lat,
        lng,
      });
      usedProviderName = provider.name;
      console.log(`[detect-roof] ✓ ${provider.name} erfolgreich.`);
      attempts.push({ name: provider.name, status: "ok" });
      break;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unbekannter Fehler";
      console.warn(
        `[detect-roof] ✗ ${provider.name} fehlgeschlagen: ${message}`,
      );
      attempts.push({ name: provider.name, status: "error", message });
      continue;
    }
  }

  if (!building || !usedProviderName) {
    return NextResponse.json(
      {
        error: "Kein Provider konnte ein Gebäude liefern.",
        // Frontend nutzt `details` für die strukturierte Begründung.
        details: attempts
          .filter((a) => a.status === "error")
          .map((a) => `${a.name}: ${a.message}`),
        attempts,
      },
      { status: 502 },
    );
  }

  // Warnings aus fehlgeschlagenen Versuchen in das building.warnings einbetten,
  // damit der User sieht, was im Hintergrund schief ging.
  const warnings = attempts
    .filter((a) => a.status === "error")
    .map((a) => `${a.name}: ${a.message}`);

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
