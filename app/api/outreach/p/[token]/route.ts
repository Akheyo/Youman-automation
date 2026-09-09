/**
 * Das Zählpixel für die Öffnungsmessung.
 *
 *   GET /api/outreach/p/<token>.gif
 *
 * Läuft ohne Sitzung — der Abruf kommt aus dem Postfach des Empfängers. Es
 * wird IMMER dasselbe 1x1-GIF zurückgegeben, auch bei unbekanntem Token oder
 * einem Fehler: sonst ließe sich über die Antwort ablesen, welche Tokens es
 * gibt, und im Postfach erschiene ein kaputtes Bild.
 *
 * Gespeichert wird nur, DASS und WANN abgerufen wurde. Keine IP-Adresse, kein
 * User-Agent — die Kennung dient allein dazu, offensichtliche Vorablader
 * auszusortieren, und wird danach verworfen.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { pixelGif, PIXEL_HEADERS, isLikelyPrefetch } from '@/lib/outreach/tracking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pixel(): NextResponse {
  return new NextResponse(pixelGif(), { status: 200, headers: PIXEL_HEADERS });
}

export async function GET(request: Request, { params }: { params: { token: string } }) {
  // Die Endung .gif gehört zur URL, nicht zum Token.
  const token = (params.token || '').replace(/\.gif$/i, '').trim();
  if (!token) return pixel();

  const admin = createAdminClient();
  if (!admin) return pixel();

  try {
    // Versandzeitpunkt holen, um einen Abruf unmittelbar nach dem Versand als
    // Vorablader einordnen zu können.
    const { data: ev } = await admin
      .from('outreach_events')
      .select('created_at')
      .eq('track_token', token)
      .eq('kind', 'gesendet')
      .maybeSingle();
    if (!ev) return pixel();

    const prefetch = isLikelyPrefetch({
      userAgent: request.headers.get('user-agent'),
      sentAt: ev.created_at,
    });

    await admin.rpc('outreach_track_open', { p_token: token, p_prefetch: prefetch });
  } catch {
    // Eine Störung beim Zählen darf die Mail nicht kaputt machen.
  }

  return pixel();
}
