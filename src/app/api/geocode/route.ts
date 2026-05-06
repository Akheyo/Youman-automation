/**
 * POST /api/geocode
 *
 * Body: { "address": "..." }
 * Response: { lat, lng, formattedAddress }
 */

import { NextResponse } from "next/server";
import {
  geocodeAddress,
  isRealGeocodingAvailable,
} from "@/lib/api/googleGeocoding";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { address?: string };
  try {
    body = (await req.json()) as { address?: string };
  } catch {
    return NextResponse.json(
      { error: "Ungültiger JSON-Body." },
      { status: 400 },
    );
  }

  const address = body?.address?.trim();
  if (!address) {
    return NextResponse.json(
      { error: "Bitte eine Adresse angeben." },
      { status: 400 },
    );
  }

  try {
    const result = await geocodeAddress(address);
    return NextResponse.json({
      ...result,
      provider: isRealGeocodingAvailable() ? "google" : "mock",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
