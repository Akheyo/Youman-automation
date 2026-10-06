/**
 * POST → Angaben speichern und den Artikel in Plenty anlegen (inaktiv),
 *        Bestand buchen. Die Bilder folgen einzeln über `…/bild`.
 *
 * Wiederholbar: Steht schon eine Artikel-ID im Stand, wird kein zweiter
 * Artikel angelegt, sondern nur nachgeholt, was fehlt.
 */

import { NextResponse } from 'next/server';
import { normalisiereAngaben } from '@/lib/erfassung/logic';
import { leseKonfig, leseStand, offeneBilder, pruefe } from '@/lib/fotostudio/kern';
import { artikelAnlegen, plentyBereit } from '@/lib/fotostudio/plenty';
import { grenzen, leseNummernkreis, versatzVon } from '@/lib/fotostudio/gtin';
import { ladeStudioArtikel } from '@/lib/fotostudio/zugriff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ERLAUBT = new Set(['offen', 'anlage', 'fehler']);

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const zugriff = await ladeStudioArtikel(params.id);
  if (zugriff.antwort) return zugriff.antwort;
  const { supabase, artikel } = zugriff;

  if (!ERLAUBT.has(artikel.status)) {
    return NextResponse.json({ error: 'Der Artikel ist bereits fertig in Plenty.' }, { status: 409 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const angaben = normalisiereAngaben({
    zustand: body.zustand,
    zustandBestaetigt: true,
    gravierendeSchaeden: body.gravierendeSchaeden,
    bestand: body.bestand,
    gewichtKg: body.gewichtKg,
    packklasse: body.packklasse,
  });
  const notiz = typeof body.notiz === 'string' ? body.notiz.trim().slice(0, 2000) : null;

  const bilder = artikel.bilder ?? [];
  const pruefung = pruefe({
    zustand: angaben.zustand,
    bestand: angaben.bestand,
    gewichtKg: angaben.gewichtKg,
    fotos: bilder.filter((b) => b.hochgeladen).length,
    // Ob noch etwas hochlädt, weiß nur das Gerät — es gibt den Knopf erst
    // frei, wenn seine Warteschlange leer ist. Eine hier unbestätigte Zeile
    // ist meist ein abgebrochener, verworfener Upload; der darf den Artikel
    // nicht für immer blockieren. Sie geht schlicht nicht mit nach Plenty.
    unterwegs: 0,
  });

  // Die Angaben werden in jedem Fall gespeichert — auch wenn die Anlage
  // gleich scheitert, soll beim nächsten Öffnen nichts neu getippt werden.
  const angabenZeile = {
    zustand: angaben.zustand,
    zustand_bestaetigt: true,
    gravierende_schaeden: angaben.gravierendeSchaeden,
    bestand: angaben.bestand,
    gewicht_kg: angaben.gewichtKg,
    packklasse: angaben.packklasse,
    notiz,
  };

  if (!pruefung.ok) {
    await supabase.from('erfassung_artikel').update(angabenZeile).eq('id', artikel.id);
    return NextResponse.json({ error: pruefung.hindernisse.join(' '), hindernisse: pruefung.hindernisse }, { status: 400 });
  }

  const plenty = await plentyBereit();
  if ('fehler' in plenty) {
    await supabase.from('erfassung_artikel').update(angabenZeile).eq('id', artikel.id);
    return NextResponse.json({ error: plenty.fehler }, { status: 503 });
  }

  // Ab welcher Position im Nummernkreis gesucht wird: hinter der höchsten,
  // die diese App schon vergeben hat. Was Plenty selbst (per Knopf) vergeben
  // hat, fällt bei der Prüfung je Nummer auf und wird übersprungen.
  const kreis = leseNummernkreis();
  let startVersatz = 0;
  if (kreis) {
    const { erste, letzte } = grenzen(kreis);
    const { data: hoechste } = await supabase
      .from('erfassung_artikel')
      .select('ean')
      .gte('ean', erste)
      .lte('ean', letzte)
      .order('ean', { ascending: false })
      .limit(1);
    const v = versatzVon(kreis, (hoechste?.[0] as { ean?: string } | undefined)?.ean);
    startVersatz = v == null ? 0 : v + 1;
  }

  const vorher = leseStand(artikel.plenty);
  const ergebnis = await artikelAnlegen(
    {
      nummer: artikel.nummer,
      zustand: angaben.zustand,
      bestand: angaben.bestand,
      gewichtKg: angaben.gewichtKg,
      startVersatz,
    },
    vorher,
    leseKonfig(),
    kreis,
    plenty.cfg,
  );
  const stand = { ...ergebnis.stand, offen: [...pruefung.hinweise, ...ergebnis.stand.offen] };

  // Ohne Artikel-ID bleibt der Artikel offen: Dann darf noch fotografiert und
  // korrigiert werden. Mit ID ist er gesperrt — weitere Fotos kämen sonst an
  // einen Artikel, der schon in Plenty steht, ohne dorthin zu gelangen.
  const entstanden = Boolean(stand.itemId && stand.variationId);
  await supabase
    .from('erfassung_artikel')
    .update({
      ...angabenZeile,
      ean: stand.ean,
      plenty: stand,
      plenty_item_id: stand.itemId,
      plenty_variation_id: stand.variationId,
      plenty_fehler: ergebnis.fehler,
      status: entstanden ? 'anlage' : 'offen',
      fertig_am: entstanden ? new Date().toISOString() : null,
    })
    .eq('id', artikel.id);

  if (ergebnis.fehler) return NextResponse.json({ error: ergebnis.fehler, plenty: stand }, { status: 502 });

  return NextResponse.json({
    plenty: stand,
    ean: stand.ean,
    bilder: offeneBilder(bilder, stand).map((b) => b.id),
  });
}
