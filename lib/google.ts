/**
 * Google Calendar integration for Lina (the phone agent).
 *
 * Uses plain OAuth 2.0 + the Calendar REST API over fetch (no SDK dependency).
 * The owner connects their calendar once; we store only the refresh token and
 * exchange it for short-lived access tokens on demand.
 *
 * Required env:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'];

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

/** Build the consent URL. `state` carries the user id so the callback can store the token. */
export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/** Exchange the one-time auth code for tokens (incl. the long-lived refresh token). */
export async function exchangeCode(code: string): Promise<{ refresh_token?: string; access_token: string }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Trade a stored refresh token for a fresh access token. */
async function accessTokenFromRefresh(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Google refresh failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/** Read the connected account's email (shown in the dashboard after connecting). */
export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

export interface FreeSlot {
  start: string; // ISO
  end: string; // ISO
  label: string; // human-readable German label
}

/**
 * Return up to `count` free slots in business hours over the next `days`.
 * Working window: Mon–Fri, 09:00–17:00, 30-minute meetings, Europe/Berlin.
 */
export async function findFreeSlots(
  refreshToken: string,
  calendarId: string,
  opts: { days?: number; count?: number; durationMin?: number } = {},
): Promise<FreeSlot[]> {
  const days = opts.days ?? 7;
  const count = opts.count ?? 3;
  const durationMin = opts.durationMin ?? 30;

  const accessToken = await accessTokenFromRefresh(refreshToken);
  const now = new Date();
  const timeMin = new Date(now.getTime() + 60 * 60 * 1000); // earliest: in 1h
  const timeMax = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const fb = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone: 'Europe/Berlin',
      items: [{ id: calendarId }],
    }),
  });
  if (!fb.ok) throw new Error(`freeBusy failed: ${fb.status} ${await fb.text()}`);
  const fbData = (await fb.json()) as { calendars?: Record<string, { busy?: { start: string; end: string }[] }> };
  const busy = (fbData.calendars?.[calendarId]?.busy ?? []).map((b) => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }));

  const fmt = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  });

  const slots: FreeSlot[] = [];
  const cursor = new Date(timeMin);
  cursor.setMinutes(cursor.getMinutes() > 30 ? 60 : 30, 0, 0); // round up to next half hour

  while (slots.length < count && cursor.getTime() < timeMax.getTime()) {
    // Convert to Berlin local hour/day via formatter parts.
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin',
      weekday: 'short',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(cursor);
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const isWeekday = !['Sat', 'Sun'].includes(weekday);
    const inHours = hour >= 9 && hour < 17;

    if (isWeekday && inHours) {
      const start = cursor.getTime();
      const end = start + durationMin * 60 * 1000;
      const overlaps = busy.some((b) => start < b.end && end > b.start);
      if (!overlaps) {
        slots.push({
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          label: `${fmt.format(new Date(start))} Uhr`,
        });
      }
    }
    cursor.setMinutes(cursor.getMinutes() + 30);
  }
  return slots;
}

/** Create a calendar event (the booked meeting) and return its id + link. */
export async function bookEvent(
  refreshToken: string,
  calendarId: string,
  args: { startIso: string; durationMin?: number; summary: string; description?: string; attendeeEmail?: string },
): Promise<{ id: string; htmlLink: string }> {
  const accessToken = await accessTokenFromRefresh(refreshToken);
  const start = new Date(args.startIso);
  const end = new Date(start.getTime() + (args.durationMin ?? 30) * 60 * 1000);

  const body: Record<string, unknown> = {
    summary: args.summary,
    description: args.description ?? '',
    start: { dateTime: start.toISOString(), timeZone: 'Europe/Berlin' },
    end: { dateTime: end.toISOString(), timeZone: 'Europe/Berlin' },
  };
  if (args.attendeeEmail) body.attendees = [{ email: args.attendeeEmail }];

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`event insert failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id: string; htmlLink: string };
  return { id: data.id, htmlLink: data.htmlLink };
}
