import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  artikelDetailLaden,
  artikelSuchen,
  bilderLesen,
  LEERE_SUCHE,
  spaltenErkennen,
  sucheIstLeer,
  type Spaltenzuordnung,
  type Suchfelder,
} from '../lib/artikel';
import { text as feldText, type Zeile } from '../lib/fields';
import { anzahl } from '../lib/format';
import { Etikett, LeererZustand, Meldung, Pfeil, SkelettKarten } from '../components/Bausteine';
import Zeichen from '../components/Icons';

const WARTEZEIT = 300;
const GRENZE = 40;

function zahlText(wert: unknown): string | null {
  if (wert === null || wert === undefined || wert === '') return null;
  const n = typeof wert === 'number' ? wert : Number(wert);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(n);
}

function euro(wert: unknown): string | null {
  const n = typeof wert === 'number' ? wert : Number(wert);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

function wertAnzeigen(wert: unknown): string {
  if (wert === null || wert === undefined || wert === '') return 'nicht gesetzt';
  if (typeof wert === 'boolean') return wert ? 'ja' : 'nein';
  if (typeof wert === 'object') return JSON.stringify(wert);
  return String(wert);
}

function bestandTon(menge: number) {
  if (menge <= 0) return 'rot' as const;
  if (menge < 5) return 'gelb' as const;
  return 'blau' as const;
}

function bestandZeichen(menge: number) {
  if (menge <= 0) return 'warndreieck' as const;
  if (menge < 5) return 'warnkreis' as const;
  return 'haken' as const;
}

function Artikelkarte({ zeile, spalten }: { zeile: Zeile; spalten: Spaltenzuordnung }) {
  const [offen, setOffen] = useState(false);
  const [voll, setVoll] = useState<Zeile | null>(null);
  const [ladefehler, setLadefehler] = useState<string | null>(null);

  /* Die ganze Zeile wird erst geholt, wenn jemand sie aufklappt. */
  useEffect(() => {
    if (!offen || voll) return;
    let abgebrochen = false;
    artikelDetailLaden(spalten, zeile)
      .then((ergebnis) => {
        if (!abgebrochen) setVoll(ergebnis);
      })
      .catch((problem) => {
        if (!abgebrochen) {
          setVoll(zeile);
          setLadefehler(problem instanceof Error ? problem.message : 'Der Artikel konnte nicht geladen werden.');
        }
      });
    return () => {
      abgebrochen = true;
    };
  }, [offen, voll, spalten, zeile]);

  const daten = voll ?? zeile;
  const titel = (spalten.titel ? feldText(daten, [spalten.titel]) : null) ?? 'Artikel ohne Titel';
  const nummer = spalten.artikelnummer ? feldText(daten, [spalten.artikelnummer]) : null;
  const ean = spalten.ean ? feldText(daten, [spalten.ean]) : null;
  const hersteller = spalten.hersteller ? feldText(daten, [spalten.hersteller]) : null;

  const bilder = useMemo(
    () => (spalten.bilder ? bilderLesen(daten[spalten.bilder]) : []),
    [daten, spalten.bilder],
  );
  const vorschau = bilder[0]?.vorschau ?? bilder[0]?.mittel ?? null;

  const ersterBestand = spalten.bestand[0] ? zahlText(daten[spalten.bestand[0]]) : null;

  const bestaende = spalten.bestand
    .map((name) => ({ name, wert: daten[name] }))
    .filter((eintrag) => zahlText(eintrag.wert) !== null);
  const preise = spalten.preise
    .map((name) => ({ name, wert: euro(daten[name]) }))
    .filter((eintrag) => eintrag.wert !== null);

  return (
    <div className={`zeile ${offen ? 'zeileOffen' : ''}`}>
      <button type="button" className="zeileKopf" onClick={() => setOffen(!offen)} aria-expanded={offen}>
        <span className="artikelBild" aria-hidden="true">
          {vorschau ? <img src={vorschau} alt="" loading="lazy" /> : <Zeichen name="postfach" groesse={18} />}
        </span>

        <span className="zeileTitel">
          <span className="zeileName">{titel}</span>
          <span className="zeileUnter">
            {nummer ? `Artikelnummer ${nummer}` : 'ohne Artikelnummer'}
            {ean ? `, EAN ${ean}` : ''}
            {hersteller ? `, ${hersteller}` : ''}
          </span>
        </span>

        <span className="zeileRechts">
          {ersterBestand !== null && (
            <Etikett
              ton={bestandTon(Number(daten[spalten.bestand[0] as string]))}
              zeichen={bestandZeichen(Number(daten[spalten.bestand[0] as string]))}
              text={`${ersterBestand} auf Lager`}
            />
          )}
          <Pfeil offen={offen} />
        </span>
      </button>

      {offen && (
        <div className="zeileInhalt">
          {!voll && <p className="laden">Der Artikel wird geladen.</p>}
          {ladefehler && <Meldung ton="rot">{ladefehler}</Meldung>}

          {voll && (
            <>
              <div className="wertePaare">
                {bestaende.map((eintrag) => (
                  <div key={eintrag.name}>
                    <div className="wertPaarName">{eintrag.name.replace(/_/g, ' ')}</div>
                    <div className="wertPaarWert zahl">{zahlText(eintrag.wert)}</div>
                  </div>
                ))}
                {preise.map((eintrag) => (
                  <div key={eintrag.name}>
                    <div className="wertPaarName">{eintrag.name.replace(/_/g, ' ')}</div>
                    <div className="wertPaarWert zahl">{eintrag.wert}</div>
                  </div>
                ))}
                {ean && (
                  <div>
                    <div className="wertPaarName">EAN</div>
                    <div className="wertPaarWert zahl">{ean}</div>
                  </div>
                )}
                {spalten.lager && feldText(voll, [spalten.lager]) && (
                  <div>
                    <div className="wertPaarName">Lager</div>
                    <div className="wertPaarWert">{feldText(voll, [spalten.lager])}</div>
                  </div>
                )}
                {spalten.gewicht && zahlText(voll[spalten.gewicht]) && (
                  <div>
                    <div className="wertPaarName">Gewicht</div>
                    <div className="wertPaarWert zahl">{zahlText(voll[spalten.gewicht])} g</div>
                  </div>
                )}
              </div>

              {bilder.length > 0 && (
                <div>
                  <div className="wertPaarName" style={{ marginBottom: 'var(--raum-2)' }}>
                    {anzahl(bilder.length)} {bilder.length === 1 ? 'Bild' : 'Bilder'}, Hauptbild zuerst
                  </div>
                  <div className="bilderReihe">
                    {bilder.map((bild, index) => (
                      <a
                        key={`${bild.vorschau ?? index}`}
                        href={bild.gross ?? bild.mittel ?? bild.vorschau ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="bildKachel"
                        title="In voller Größe öffnen"
                      >
                        <img src={bild.vorschau ?? bild.mittel ?? ''} alt={`Bild ${index + 1}`} loading="lazy" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <details className="technisch">
                <summary>
                  <Pfeil offen={false} />
                  Alle Felder aus der Datenbank anzeigen
                </summary>
                <div className="feldGitter">
                  {spalten.alle.map((name) => (
                    <div key={name} className="feldZeile">
                      <span className="wertPaarName">{name}</span>
                      <span className="feldWert">{wertAnzeigen(voll[name])}</span>
                    </div>
                  ))}
                </div>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Artikel() {
  const [felder, setFelder] = useState<Suchfelder>(LEERE_SUCHE);
  const [spalten, setSpalten] = useState<Spaltenzuordnung | null>(null);
  const [zeilen, setZeilen] = useState<Zeile[] | null>(null);
  const [dauer, setDauer] = useState<number | null>(null);
  const [laden, setLaden] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const uhr = useRef<number>();
  const laufendeNummer = useRef(0);

  useEffect(() => {
    let abgebrochen = false;
    spaltenErkennen()
      .then((erkannt) => {
        if (!abgebrochen) setSpalten(erkannt);
      })
      .catch((problem) => {
        if (!abgebrochen) {
          setFehler(problem instanceof Error ? problem.message : 'Die Artikeldaten sind nicht erreichbar.');
        }
      });
    return () => {
      abgebrochen = true;
    };
  }, []);

  const suchen = useCallback(
    async (aktuelle: Suchfelder) => {
      if (!spalten) return;
      if (sucheIstLeer(aktuelle)) {
        setZeilen(null);
        setDauer(null);
        return;
      }
      const nummer = ++laufendeNummer.current;
      setLaden(true);
      setFehler(null);
      try {
        const ergebnis = await artikelSuchen(aktuelle, spalten, GRENZE);
        /* Antworten von überholten Abfragen werden verworfen. */
        if (nummer !== laufendeNummer.current) return;
        setZeilen(ergebnis.zeilen);
        setDauer(ergebnis.dauer);
      } catch (problem) {
        if (nummer !== laufendeNummer.current) return;
        setZeilen([]);
        setFehler(problem instanceof Error ? problem.message : 'Die Suche ist fehlgeschlagen.');
      } finally {
        if (nummer === laufendeNummer.current) setLaden(false);
      }
    },
    [spalten],
  );

  useEffect(() => {
    window.clearTimeout(uhr.current);
    uhr.current = window.setTimeout(() => void suchen(felder), WARTEZEIT);
    return () => window.clearTimeout(uhr.current);
  }, [felder, suchen]);

  const setzen = (name: keyof Suchfelder) => (ereignis: React.ChangeEvent<HTMLInputElement>) =>
    setFelder((vorher) => ({ ...vorher, [name]: ereignis.target.value }));

  const etwasEingetragen = Object.values(felder).some((wert) => wert.length > 0);
  const leer = sucheIstLeer(felder);

  const suchfeld = (
    name: keyof Suchfelder,
    beschriftung: string,
    platzhalter: string,
    vorhanden: boolean,
  ) =>
    vorhanden ? (
      <label className="feld">
        <span className="feldName">{beschriftung}</span>
        <input
          type="search"
          value={felder[name]}
          placeholder={platzhalter}
          onChange={setzen(name)}
          onKeyDown={(ereignis) => {
            if (ereignis.key === 'Escape') setFelder((vorher) => ({ ...vorher, [name]: '' }));
          }}
        />
      </label>
    ) : null;

  return (
    <>
      <div className="seitenkopf">
        <div>
          <h1>Artikel</h1>
          <p>Suche in den Artikeldaten aus PlentyONE, die alle zehn Minuten abgeglichen werden.</p>
        </div>
        {etwasEingetragen && (
          <div className="seitenkopfRechts">
            <button type="button" className="knopf knopfLeise" onClick={() => setFelder(LEERE_SUCHE)}>
              <Zeichen name="schliessen" groesse={14} />
              Alle Felder leeren
            </button>
          </div>
        )}
      </div>

      <div className="suchgitter">
        {suchfeld('artikelnummer', 'Artikelnummer', 'beginnt mit', Boolean(spalten?.artikelnummer))}
        {suchfeld('ean', 'EAN', 'beginnt mit', Boolean(spalten?.ean))}
        {suchfeld('titel', 'Titel', 'enthält', Boolean(spalten?.titel))}
        {suchfeld('hersteller', 'Hersteller', 'beginnt mit', Boolean(spalten?.hersteller))}
      </div>

      <p className="leise klein">
        Artikelnummer, EAN und Hersteller suchen von vorne, das ist genau und schnell. Der Titel sucht
        überall im Text. Mehrere Felder gelten zusammen. Ab zwei Zeichen je Feld geht es los.
        {spalten && !spalten.hersteller && ' Ein Feld für den Hersteller gibt es nicht, weil die Ansicht keine solche Spalte hat.'}
      </p>

      {fehler && <Meldung ton="rot">{fehler}</Meldung>}

      {!spalten && !fehler && <SkelettKarten anzahl={2} zeilen={2} />}

      {spalten && laden && <SkelettKarten anzahl={3} zeilen={2} />}

      {spalten && !laden && leer && (
        <LeererZustand
          titel="Wonach suchst du?"
          text="Trag in ein Feld mindestens zwei Zeichen ein. Für einen bestimmten Artikel nimm die Artikelnummer, für eine ganze Gruppe den Titel."
          zeichen="lupe"
        />
      )}

      {spalten && !laden && !leer && zeilen !== null && zeilen.length === 0 && !fehler && (
        <LeererZustand
          titel="Nichts gefunden"
          text="Kein Artikel passt auf diese Angaben. Lösch ein Feld oder kürze den Begriff, die Suche wird dann breiter."
          zeichen="lupe"
        />
      )}

      {spalten && !laden && zeilen !== null && zeilen.length > 0 && (
        <>
          <p className="leise klein">
            {zeilen.length >= GRENZE
              ? `Die ersten ${anzahl(GRENZE)} Treffer`
              : `${anzahl(zeilen.length)} ${zeilen.length === 1 ? 'Treffer' : 'Treffer'}`}
            {dauer !== null ? `, gefunden in ${(dauer / 1000).toFixed(1).replace('.', ',')} Sekunden` : ''}
            {zeilen.length >= GRENZE ? '. Grenze weiter ein, wenn deiner nicht dabei ist.' : ''}
          </p>
          <div className="liste">
            {zeilen.map((zeile, index) => (
              <Artikelkarte
                key={String(
                  (spalten.schluessel ? zeile[spalten.schluessel] : null) ??
                    (spalten.artikelnummer ? zeile[spalten.artikelnummer] : null) ??
                    index,
                )}
                zeile={zeile}
                spalten={spalten}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
