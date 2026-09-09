/**
 * Wer bin ich eigentlich? — Auskunft darüber, an welchem Supabase-Projekt
 * diese Installation hängt.
 *
 * Anlass: Wenn mehrere Vercel-Projekte aus demselben Repo laufen, hat jedes
 * eigene Umgebungsvariablen und kann auf ein anderes Supabase-Projekt zeigen.
 * Wer dann das Schema einspielt, spielt es leicht ins falsche ein — und wundert
 * sich, warum die Tabelle „fehlt". Die Einstellungsseite zeigt deshalb an, mit
 * welchem Projekt sie tatsächlich spricht.
 *
 * Was hier ausgeliefert wird, ist ausschließlich Öffentliches: Die URL steht
 * ohnehin in `NEXT_PUBLIC_SUPABASE_URL` und geht bei jedem Seitenaufruf an den
 * Browser. Der Service-Role-Key wird NIE ausgeliefert — nur die Auskunft, ob
 * einer gesetzt ist.
 */

export interface SupabaseInfo {
  /** Volle Projekt-URL, z. B. https://abcdefghijkl.supabase.co */
  url: string | null;
  /**
   * Die Projekt-Referenz — das Stück vor „.supabase.co". Genau damit findet
   * man das Projekt im Supabase-Dashboard wieder (Project Settings → General
   * → Reference ID).
   */
  projektRef: string | null;
  /** Ob Login und Verlauf überhaupt laufen können. */
  angemeldetNutzbar: boolean;
  /**
   * Ob der Service-Role-Key gesetzt ist. NUR ob — der Wert selbst verlässt den
   * Server nicht. Ohne ihn lässt sich in den Einstellungen nichts speichern.
   */
  serviceRoleGesetzt: boolean;
}

/** Zieht die Projekt-Referenz aus einer Supabase-URL. */
export function projektRefAus(url: string | null | undefined): string | null {
  if (!url) return null;
  const treffer = url.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.(?:co|in)/i);
  if (treffer) return treffer[1];
  // Eigene Domain oder lokale Instanz — dann ist der Hostname die beste Auskunft.
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function supabaseInfo(): SupabaseInfo {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null;
  return {
    url,
    projektRef: projektRefAus(url),
    angemeldetNutzbar: Boolean(url && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleGesetzt: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
  };
}
