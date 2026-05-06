/**
 * Geocoding-Provider.
 *
 * - Wenn `GOOGLE_MAPS_API_KEY` gesetzt ist, wird die Google Geocoding API
 *   benutzt.
 * - Sonst wird ein Mock-Geocoder mit ein paar bekannten Demo-Adressen
 *   (deutsche Großstädte) verwendet, damit der Prototyp ohne API-Key
 *   sinnvoll läuft.
 *
 * API-Keys werden NIE ans Frontend ausgeliefert – das Geocoding läuft
 * ausschließlich serverseitig in `app/api/geocode/route.ts`.
 */

import type { GeocodeResponse } from "@/types/solar";

const MOCK_DB: Array<{ keywords: string[]; result: GeocodeResponse }> = [
  {
    keywords: ["berlin", "brandenburger tor", "10117"],
    result: {
      lat: 52.5163,
      lng: 13.3777,
      formattedAddress: "Pariser Platz, 10117 Berlin",
    },
  },
  {
    keywords: ["münchen", "muenchen", "marienplatz", "80331"],
    result: {
      lat: 48.1374,
      lng: 11.5755,
      formattedAddress: "Marienplatz, 80331 München",
    },
  },
  {
    keywords: ["hamburg", "rathaus", "20095"],
    result: {
      lat: 53.5503,
      lng: 9.992,
      formattedAddress: "Rathausmarkt, 20095 Hamburg",
    },
  },
  {
    keywords: ["köln", "koeln", "dom", "50667"],
    result: {
      lat: 50.9413,
      lng: 6.9583,
      formattedAddress: "Domkloster 4, 50667 Köln",
    },
  },
  {
    keywords: ["frankfurt", "römer", "roemer", "60311"],
    result: {
      lat: 50.1106,
      lng: 8.6821,
      formattedAddress: "Römerberg, 60311 Frankfurt am Main",
    },
  },
  {
    keywords: ["stuttgart", "schlossplatz", "70173"],
    result: {
      lat: 48.7784,
      lng: 9.18,
      formattedAddress: "Schlossplatz, 70173 Stuttgart",
    },
  },
  {
    keywords: ["leipzig", "augustusplatz", "04109"],
    result: {
      lat: 51.3389,
      lng: 12.3786,
      formattedAddress: "Augustusplatz, 04109 Leipzig",
    },
  },
  {
    keywords: ["dresden", "neumarkt", "01067"],
    result: {
      lat: 51.0521,
      lng: 13.7397,
      formattedAddress: "Neumarkt, 01067 Dresden",
    },
  },
];

export async function geocodeAddress(
  address: string,
): Promise<GeocodeResponse> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (apiKey) {
    return geocodeViaGoogle(address, apiKey);
  }
  return geocodeViaMock(address);
}

async function geocodeViaGoogle(
  address: string,
  apiKey: string,
): Promise<GeocodeResponse> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Google Geocoding API: HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    status: string;
    error_message?: string;
    results?: Array<{
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
    }>;
  };
  if (data.status !== "OK" || !data.results || data.results.length === 0) {
    throw new Error(
      `Google Geocoding: ${data.status}${
        data.error_message ? ` – ${data.error_message}` : ""
      }`,
    );
  }
  const r = data.results[0]!;
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    formattedAddress: r.formatted_address,
  };
}

function geocodeViaMock(address: string): GeocodeResponse {
  const needle = address.toLowerCase();
  for (const entry of MOCK_DB) {
    if (entry.keywords.some((k) => needle.includes(k))) {
      return entry.result;
    }
  }
  // Default: Brandenburger Tor, damit Demo immer etwas anzeigt.
  return {
    lat: 52.5163,
    lng: 13.3777,
    formattedAddress: `Demo-Standort (Berlin) für: ${address}`,
  };
}

export function isRealGeocodingAvailable(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}
