/**
 * Der Abgleich: Plenty-Bestand → Marktplaats.
 *
 * Treiber ist der **Bestand**, nicht der Artikelstamm — dieselbe Entscheidung
 * wie beim Lagerplatz-Scan und aus demselben Grund: Nur was tatsächlich im
 * Lager liegt, gehört in eine Anzeige. Karteileichen ohne Bestand bleiben
 * außen vor, und ein Artikel, dessen Bestand auf null fällt, wird beim
 * nächsten Lauf offline genommen.
 *
 * DER LAUF IST IN HÄPPCHEN GETEILT. Jeder Aufruf liest eine Bestandsseite,
 * arbeitet sie ab und meldet, wo es weitergeht; die Oberfläche hängt
 * selbstständig an. So bleibt er unter dem Serverless-Zeitlimit von Vercel
 * (60 Sekunden), und ein Abbruch kostet nicht den ganzen Durchlauf.
 *
 * DIE SICHERUNGEN — bewusst dieselben wie beim Umbuchen der Lagerplätze,
 * weil hier dieselbe Art Schaden möglich ist:
 *
 *   - **Probelauf ist die Voreinstellung.** Geschrieben wird nur, wenn der
 *     Aufruf ausdrücklich `probelauf: false` setzt.
 *   - Eine **Obergrenze je Lauf** begrenzt, was ein Irrtum anrichtet.
 *   - Ein Fehler stoppt nicht den Lauf, sondern wird je Zeile protokolliert.
 *   - Die Markenprüfung aus `markenregeln.ts` läuft vor jeder
 *     Veröffentlichung — ein gesperrter Artikel geht nicht raus und kommt
 *     runter, falls er schon draußen ist.
 */

import { aktuelleConfig, plentyConfigured, plentyGet } from '@/lib/plenty/client';
import { baueAnzeige, fingerabdruck, type Befund as AnzeigeBefund } from './anzeige';
import {
  aktuellerZugang,
  aendereAnzeige,
  legeAnzeigeAn,
  loescheAnzeige,
  setzeBilder,
  titelGrenze,
  MarktplaatsFehler,
} from './client';
import { entscheide, leereBilanz, schreibt, zaehle, type Bilanz, type Massnahme } from './entscheidung';
import { findeKategorie, ladeZuordnung } from './kategorien';
import { ladeArtikel, eintraege } from './quelle';
import { brauchtUebersetzung, ladeSpiegel, quellFingerabdruck, schreibeSpiegel, type SpiegelStatus } from './spiegel';
import {
  anthropicKonfiguriert,
  pruefeHerkunft,
  pruefeUebersetzung,
  sichereProduktregeln,
  uebersetze,
} from './uebersetzung';
import { zugangVollstaendig } from '@/lib/einstellungen/marktplaats';

export interface AbgleichOptionen {
  /** Ohne ausdrückliches `probelauf: false` wird bei Marktplaats nichts verändert. */
  probelauf?: boolean;
  /** Obergrenze für tatsächliche Änderungen bei Marktplaats je Lauf. */
  maxSchreibend?: number;
  /** Zeitbudget je Aufruf; danach bricht der Lauf sauber ab. */
  budgetMs?: number;
  /** Bestandsseite, bei der weitergemacht wird. */
  seite?: number;
  proSeite?: number;
  /** Übersetzen, wenn eine fehlt. Aus = nur bereits übersetzte Artikel. */
  uebersetzen?: boolean;
  /** Wie viele Bilder je Anzeige. Hängt vom Händlerpaket ab (24/35/99). */
  maxBilder?: number;
}

export interface AbgleichZeile {
  variationId: number;
  itemId: number | null;
  titel: string;
  massnahme: Massnahme;
  grund: string;
  mpItemId: string | null;
  /** Bei einem Probelauf: was passiert wäre. */
  geschrieben: boolean;
  fehler: string | null;
  befunde: string[];
}

export interface AbgleichErgebnis {
  ok: boolean;
  probelauf: boolean;
  error: string | null;
  bilanz: Bilanz;
  zeilen: AbgleichZeile[];
  /** Nächste Bestandsseite, oder null wenn durch. */
  weiter: number | null;
  /** Wie viele Artikel dieser Lauf angesehen hat. */
  gesehen: number;
  uebersetzt: number;
  diagnose: string[];
  dauerMs: number;
}

interface RohBestand {
  variationId?: number;
  itemId?: number;
  quantity?: number;
  netStock?: number;
}

/**
 * Fasst die Bestandszeilen einer Seite je Variante zusammen.
 *
 * Liegt derselbe Artikel in mehreren Lagern, kommt er mehrfach — für die
 * Anzeige zählt die Summe. Ohne das Zusammenfassen entschiede die zuletzt
 * gelesene Zeile, und ein Artikel mit Bestand in Lager A und null in Lager B
 * ginge je nach Reihenfolge offline.
 */
export function fasseBestand(zeilen: RohBestand[]): Map<number, { itemId: number | null; bestand: number }> {
  const map = new Map<number, { itemId: number | null; bestand: number }>();
  for (const z of zeilen) {
    const variationId = Number(z?.variationId);
    if (!Number.isFinite(variationId) || variationId <= 0) continue;
    const menge = Number(z?.netStock ?? z?.quantity ?? 0);
    const vorher = map.get(variationId);
    map.set(variationId, {
      itemId: vorher?.itemId ?? (Number.isFinite(Number(z?.itemId)) ? Number(z.itemId) : null),
      bestand: (vorher?.bestand ?? 0) + (Number.isFinite(menge) ? menge : 0),
    });
  }
  return map;
}

function kurz(text: string, laenge = 60): string {
  return text.length > laenge ? `${text.slice(0, laenge - 1)}…` : text;
}

/**
 * Ein Häppchen des Abgleichs.
 *
 * Gibt `weiter` zurück, solange noch Bestandsseiten offen sind. Die
 * Oberfläche ruft so lange nach, bis `weiter` null ist — oder bis jemand
 * anhält.
 */
export async function gleicheAb(opts: AbgleichOptionen = {}): Promise<AbgleichErgebnis> {
  const start = Date.now();
  const probelauf = opts.probelauf !== false;
  const maxSchreibend = Math.max(1, opts.maxSchreibend ?? 25);
  const budgetMs = Math.max(5_000, opts.budgetMs ?? 45_000);
  const proSeite = Math.min(250, Math.max(10, opts.proSeite ?? 50));
  const seite = Math.max(1, opts.seite ?? 1);
  const darfUebersetzen = opts.uebersetzen !== false;

  const diagnose: string[] = [];
  const zeilen: AbgleichZeile[] = [];
  const bilanz = leereBilanz();
  let uebersetzt = 0;

  const leer = (fehler: string): AbgleichErgebnis => ({
    ok: false,
    probelauf,
    error: fehler,
    bilanz,
    zeilen,
    weiter: null,
    gesehen: 0,
    uebersetzt,
    diagnose,
    dauerMs: Date.now() - start,
  });

  if (!plentyConfigured(await aktuelleConfig())) {
    return leer('PlentyONE ist nicht eingerichtet — ohne Zugang gibt es keinen Bestand zu lesen.');
  }
  const zugang = await aktuellerZugang();
  if (!zugangVollstaendig(zugang)) {
    return leer(
      'Der Marktplaats-Zugang ist unvollständig. Unter „Einstellungen" Client-ID, Secret, API-Adresse und Postleitzahl eintragen.',
    );
  }
  if (darfUebersetzen && !anthropicKonfiguriert()) {
    diagnose.push('ANTHROPIC_API_KEY fehlt — es werden nur Artikel bearbeitet, deren Übersetzung schon vorliegt.');
  }

  // --- Bestandsseite lesen -------------------------------------------------
  let roh: RohBestand[] = [];
  let letzteSeite = true;
  try {
    const res = await plentyGet<{ entries?: RohBestand[]; isLastPage?: boolean; lastPageNumber?: number }>(
      `/rest/stockmanagement/stock?itemsPerPage=${proSeite}&page=${seite}`,
    );
    roh = eintraege(res as never) as RohBestand[];
    letzteSeite = res?.isLastPage === true || roh.length < proSeite;
  } catch (err) {
    return leer(`Bestand konnte nicht gelesen werden: ${err instanceof Error ? err.message : String(err)}`);
  }

  const bestand = fasseBestand(roh);
  diagnose.push(`Seite ${seite}: ${roh.length} Bestandszeilen, ${bestand.size} Varianten.`);
  if (!bestand.size) {
    return {
      ok: true,
      probelauf,
      error: null,
      bilanz,
      zeilen,
      weiter: letzteSeite ? null : seite + 1,
      gesehen: 0,
      uebersetzt,
      diagnose,
      dauerMs: Date.now() - start,
    };
  }

  const variationIds = [...bestand.keys()];
  const [spiegel, zuordnung] = await Promise.all([ladeSpiegel(variationIds), ladeZuordnung()]);
  diagnose.push(`${spiegel.size} Varianten sind schon bekannt, ${zuordnung.size} Kategorie-Zuordnungen gepflegt.`);

  let geschriebenGesamt = 0;
  let gesehen = 0;
  let abgebrochen = false;

  for (const variationId of variationIds) {
    if (Date.now() - start > budgetMs) {
      diagnose.push('Zeitbudget erreicht — der Rest der Seite kommt beim nächsten Aufruf.');
      abgebrochen = true;
      break;
    }
    if (geschriebenGesamt >= maxSchreibend) {
      diagnose.push(`Obergrenze von ${maxSchreibend} Änderungen erreicht.`);
      abgebrochen = true;
      break;
    }

    gesehen += 1;
    const lage = bestand.get(variationId)!;
    const bekannt = spiegel.get(variationId);
    const befunde: string[] = [];
    let titelFuerProtokoll = `Variante ${variationId}`;

    try {
      const artikel = await ladeArtikel(variationId, { itemId: lage.itemId, bestand: lage.bestand });
      if (!artikel) {
        zeilen.push({
          variationId,
          itemId: lage.itemId,
          titel: titelFuerProtokoll,
          massnahme: 'wartet',
          grund: 'Die Variante ließ sich in Plenty nicht laden.',
          mpItemId: bekannt?.mpItemId ?? null,
          geschrieben: false,
          fehler: null,
          befunde,
        });
        zaehle(bilanz, 'wartet');
        continue;
      }
      titelFuerProtokoll = kurz(artikel.titel || titelFuerProtokoll);

      // --- Markenregeln: erst der deutsche Quelltext ------------------------
      const herkunft = pruefeHerkunft({
        hersteller: artikel.hersteller,
        titel: artikel.titel,
        beschreibung: artikel.beschreibung,
        zustand: artikel.zustand,
      });
      for (const b of herkunft.befunde) befunde.push(`${b.regel}: ${b.meldung}`);

      // --- Übersetzung -----------------------------------------------------
      const quelle = quellFingerabdruck(artikel.titel, artikel.beschreibung);
      let titelNl = bekannt?.titelNl ?? null;
      let beschreibungNl = bekannt?.beschreibungNl ?? null;
      let quelleGespeichert = bekannt?.quellFingerabdruck ?? null;

      const mussUebersetzen = herkunft.darfRaus && artikel.bestand > 0 && brauchtUebersetzung(quelle, bekannt);
      if (mussUebersetzen && darfUebersetzen && anthropicKonfiguriert() && artikel.titel && artikel.beschreibung) {
        const nl = await uebersetze({
          titel: artikel.titel,
          beschreibung: artikel.beschreibung,
          maxTitel: titelGrenze(),
        });
        const gesichert = sichereProduktregeln(nl.beschreibung, {
          hersteller: artikel.hersteller,
          zustand: artikel.zustand,
        });
        titelNl = nl.titel;
        beschreibungNl = gesichert.beschreibung;
        quelleGespeichert = quelle;
        uebersetzt += 1;
        if (gesichert.ergaenzt) befunde.push('Pflichtsatz nach der Übersetzung wieder eingesetzt.');
      }

      // --- Markenregeln: jetzt der niederländische Text ---------------------
      let gesperrt = !herkunft.darfRaus;
      if (!gesperrt && titelNl && beschreibungNl) {
        const nachher = pruefeUebersetzung(
          { titel: titelNl, beschreibung: beschreibungNl },
          { hersteller: artikel.hersteller, zustand: artikel.zustand },
        );
        if (!nachher.darfRaus) {
          gesperrt = true;
          for (const b of nachher.befunde) befunde.push(`${b.regel} (Übersetzung): ${b.meldung}`);
        }
      }

      // --- Anzeige bauen ---------------------------------------------------
      const kategorie = findeKategorie(zuordnung, {
        plentyKategorie: artikel.kategorie,
        artikelTyp: artikel.titel,
      });
      const bau = baueAnzeige({
        titel: titelNl ?? '',
        beschreibung: beschreibungNl ?? '',
        kategorieId: kategorie?.kategorieId ?? null,
        preisEuro: artikel.preisEuro,
        versandEuro: zugang.versandEuro,
        postleitzahl: zugang.postleitzahl,
        mpn: artikel.mpn,
        maxTitel: titelGrenze(),
      });
      for (const b of bau.befunde as AnzeigeBefund[]) befunde.push(`${b.feld}: ${b.text}`);

      const abdruck = bau.anzeige ? fingerabdruck(bau.anzeige) : null;
      const { massnahme, grund } = entscheide({
        bestand: artikel.bestand,
        bereit: bau.bereit,
        gesperrt,
        fingerabdruck: abdruck,
        itemId: bekannt?.mpItemId ?? null,
        bekannterFingerabdruck: bekannt?.fingerabdruck ?? null,
      });

      // --- Ausführen -------------------------------------------------------
      let mpItemId = bekannt?.mpItemId ?? null;
      let geschrieben = false;

      if (schreibt(massnahme) && !probelauf) {
        if (massnahme === 'anlegen' && bau.anzeige) {
          const angelegt = await legeAnzeigeAn(bau.anzeige, zugang);
          mpItemId = angelegt.itemId;
          if (artikel.bildUrls.length) {
            await setzeBilder(mpItemId, artikel.bildUrls, { maximal: opts.maxBilder, zugang });
          }
          geschrieben = true;
        } else if (massnahme === 'aendern' && bau.anzeige && mpItemId) {
          await aendereAnzeige(mpItemId, bau.anzeige, zugang);
          if (artikel.bildUrls.length) {
            await setzeBilder(mpItemId, artikel.bildUrls, { maximal: opts.maxBilder, zugang });
          }
          geschrieben = true;
        } else if (massnahme === 'loeschen' && mpItemId) {
          try {
            await loescheAnzeige(mpItemId, zugang);
          } catch (err) {
            // Ist sie bei Marktplaats ohnehin weg, ist das Ziel erreicht —
            // und der nächste Lauf soll es nicht erneut versuchen.
            if (!(err instanceof MarktplaatsFehler && err.status === 404)) throw err;
          }
          mpItemId = null;
          geschrieben = true;
        }
        if (geschrieben) geschriebenGesamt += 1;
      }

      // --- Buchführung -----------------------------------------------------
      const status: SpiegelStatus = gesperrt
        ? 'gesperrt'
        : mpItemId
          ? 'online'
          : bau.bereit && artikel.bestand > 0
            ? 'wartet'
            : 'offline';

      if (!probelauf) {
        await schreibeSpiegel({
          variationId,
          itemId: artikel.itemId,
          mpItemId,
          // Nur was wirklich draußen ist, gilt als übertragen. Sonst hielte
          // der nächste Lauf eine nie gesendete Fassung für erledigt.
          fingerabdruck: geschrieben && mpItemId ? abdruck : bekannt?.fingerabdruck ?? null,
          quellFingerabdruck: quelleGespeichert,
          titelNl,
          beschreibungNl,
          status,
          fehler: null,
        });
      }

      zaehle(bilanz, massnahme);
      zeilen.push({
        variationId,
        itemId: artikel.itemId,
        titel: titelFuerProtokoll,
        massnahme,
        grund,
        mpItemId,
        geschrieben,
        fehler: null,
        befunde,
      });
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      bilanz.fehler += 1;
      zeilen.push({
        variationId,
        itemId: lage.itemId,
        titel: titelFuerProtokoll,
        massnahme: 'wartet',
        grund: 'Fehler',
        mpItemId: bekannt?.mpItemId ?? null,
        geschrieben: false,
        fehler: text,
        befunde,
      });
      if (!probelauf) {
        await schreibeSpiegel({ variationId, itemId: lage.itemId, status: 'fehler', fehler: text });
      }
    }
  }

  return {
    ok: true,
    probelauf,
    error: null,
    bilanz,
    zeilen,
    // Abgebrochen heißt: dieselbe Seite noch einmal. Die schon erledigten
    // Artikel sind dann unverändert und laufen als „nichts" durch — billiger
    // als eine zweite Buchführung darüber, wo genau der Lauf stand.
    weiter: abgebrochen ? seite : letzteSeite ? null : seite + 1,
    gesehen,
    uebersetzt,
    diagnose,
    dauerMs: Date.now() - start,
  };
}
