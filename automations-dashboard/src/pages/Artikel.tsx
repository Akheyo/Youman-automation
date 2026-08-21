import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { artikelSuchen, bilderLesen, spaltenErkennen, type Spaltenzuordnung } from '../lib/artikel';
import { text as feldText, type Zeile } from '../lib/fields';
import { anzahl } from '../lib/format';
import { Etikett, LeererZustand, Meldung, Pfeil, SkelettKarten } from '../components/Bausteine';
import Zeichen from '../components/Icons';

const WARTEZEIT = 350;
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

/** Bestand: viel ist gut, wenig heißt hinschauen, nichts ist rot. */
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

  const titel =
    (spalten.titel ? feldText(zeile, [spalten.titel]) : null) ?? 'Artikel ohne Titel';
  const nummer = spalten.artikelnummer ? feldText(zeile, [spalten.artikelnummer]) : null;
  const ean = spalten.ean ? feldText(zeile, [spalten.ean]) : null;
  const bilder = useMemo(
    () => (spalten.bilder ? bilderLesen(zeile[spalten.bilder]) : []),
    [zeile, spalten.bilder],
  );
  const vorschau = bilder[0]?.vorschau ?? bilder[0]?.mittel ?? null;

  const bestaende = spalten.bestand
    .map((name) => ({ name, wert: zeile[name] }))
    .filter((eintrag) => zahlText(eintrag.wert) !== null);

  const preise = spalten.preise
    .map((name) => ({ name, wert: euro(zeile[name]) }))
    .filter((eintrag) => eintrag.wert !== null);

  return (
    <div className={`zeile ${offen ? 'zeileOffen' : ''}`}>
      <button type="button" className="zeileKopf" onClick={() => setOffen(!offen)} aria-expanded={offen}>
        <span className="artikelBild" aria-hidden="true">
          {vorschau ? (
            <img src={vorschau} alt="" loading="lazy" />
          ) : (
            <Zeichen name="postfach" groesse={18} />
          )}
        </span>

        <span className="zeileTitel">
          <span className="zeileName">{titel}</span>
          <span className="zeileUnter">
            {nummer ? `Artikelnummer ${nummer}` : 'ohne Artikelnummer'}
            {ean ? `, EAN ${ean}` : ''}
          </span>
        </span>

        <span className="zeileRechts">
          {bestaende[0] && (
            <Etikett
              ton={bestandTon(Number(bestaende[0].wert))}
              zeichen={bestandZeichen(Number(bestaende[0].wert))}
              text={`${zahlText(bestaende[0].wert)} auf Lager`}
            />
          )}
          <Pfeil offen={offen} />
        </span>
      </button>

      {offen && (
        <div className="zeileInhalt">
          {(bestaende.length > 0 || preise.length > 0 || spalten.lager || spalten.gewicht || ean) && (
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
              {spalten.lager && feldText(zeile, [spalten.lager]) && (
                <div>
                  <div className="wertPaarName">Lager</div>
                  <div className="wertPaarWert">{feldText(zeile, [spalten.lager])}</div>
                </div>
              )}
              {spalten.gewicht && zahlText(zeile[spalten.gewicht]) && (
                <div>
                  <div className="wertPaarName">Gewicht</div>
                  <div className="wertPaarWert zahl">{zahlText(zeile[spalten.gewicht])} g</div>
                </div>
              )}
              {ean && (
                <div>
                  <div className="wertPaarName">EAN</div>
                  <div className="wertPaarWert zahl">{ean}</div>
                </div>
              )}
            </div>
          )}

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
                  <span className="feldWert">{wertAnzeigen(zeile[name])}</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

export default function Artikel() {
  const [begriff, setBegriff] = useState('');
  const [spalten, setSpalten] = useState<Spaltenzuordnung | null>(null);
  const [zeilen, setZeilen] = useState<Zeile[] | null>(null);
  const [laden, setLaden] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [eingeschraenkt, setEingeschraenkt] = useState(false);
  const uhr = useRef<number>();

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
    async (text: string) => {
      if (!spalten) return;
      if (text.trim().length < 2) {
        setZeilen(null);
        return;
      }
      setLaden(true);
      setFehler(null);
      try {
        const ergebnis = await artikelSuchen(text, spalten, GRENZE);
        setZeilen(ergebnis.zeilen);
        setEingeschraenkt(ergebnis.eingeschraenkt);
      } catch (problem) {
        setZeilen([]);
        setFehler(problem instanceof Error ? problem.message : 'Die Suche ist fehlgeschlagen.');
      } finally {
        setLaden(false);
      }
    },
    [spalten],
  );

  /* Getippt wird schneller als die Datenbank antwortet, deshalb kurz abwarten. */
  useEffect(() => {
    window.clearTimeout(uhr.current);
    uhr.current = window.setTimeout(() => void suchen(begriff), WARTEZEIT);
    return () => window.clearTimeout(uhr.current);
  }, [begriff, suchen]);

  const sucheIn = spalten?.suchbar.join(', ');

  return (
    <>
      <div className="seitenkopf">
        <div>
          <h1>Artikel</h1>
          <p>
            Suche in den Artikeldaten aus PlentyONE, die alle zehn Minuten abgeglichen werden.
          </p>
        </div>
      </div>

      <div className="werkzeugleiste">
        <div className="suchfeld">
          <span className="suchfeldZeichen">
            <Zeichen name="lupe" groesse={16} />
          </span>
          <input
            type="search"
            value={begriff}
            autoFocus
            placeholder="Artikelnummer, EAN oder Titel"
            aria-label="Artikel suchen"
            onChange={(ereignis) => setBegriff(ereignis.target.value)}
            onKeyDown={(ereignis) => {
              if (ereignis.key === 'Escape') setBegriff('');
            }}
          />
        </div>
        {begriff && (
          <button type="button" className="knopf knopfLeise nurAufBreit" onClick={() => setBegriff('')}>
            <Zeichen name="schliessen" groesse={14} />
            Leeren
          </button>
        )}
      </div>

      {sucheIn && (
        <p className="leise klein">
          Gesucht wird in: {sucheIn}
          {eingeschraenkt ? '. Die übrigen Spalten enthalten keinen Text, deshalb bleiben sie außen vor.' : '.'}
        </p>
      )}

      {fehler && <Meldung ton="rot">{fehler}</Meldung>}

      {!spalten && !fehler && <SkelettKarten anzahl={2} zeilen={2} />}

      {spalten && laden && <SkelettKarten anzahl={3} zeilen={2} />}

      {spalten && !laden && zeilen === null && (
        <LeererZustand
          titel="Wonach suchst du?"
          text="Tipp eine Artikelnummer, eine EAN oder ein Wort aus dem Titel ein. Ab zwei Zeichen wird gesucht."
          zeichen="lupe"
        />
      )}

      {spalten && !laden && zeilen !== null && zeilen.length === 0 && !fehler && (
        <LeererZustand
          titel="Nichts gefunden"
          text={`Zu „${begriff}" gibt es keinen Artikel. Prüfe die Schreibweise, oder such nur nach einem Teil der Nummer.`}
          zeichen="lupe"
        />
      )}

      {spalten && !laden && zeilen !== null && zeilen.length > 0 && (
        <>
          <p className="leise klein">
            {zeilen.length >= GRENZE
              ? `Die ersten ${anzahl(GRENZE)} Treffer. Grenze die Suche weiter ein, wenn deiner nicht dabei ist.`
              : `${anzahl(zeilen.length)} ${zeilen.length === 1 ? 'Treffer' : 'Treffer'}`}
          </p>
          <div className="liste">
            {zeilen.map((zeile, index) => (
              <Artikelkarte key={String(zeile.id ?? zeile.variation_id ?? index)} zeile={zeile} spalten={spalten} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
