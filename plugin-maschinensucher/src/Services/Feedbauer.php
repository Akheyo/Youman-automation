<?php

namespace MaschinensucherMarkt\Services;

use MaschinensucherMarkt\Logik\Artikelabbildung;
use MaschinensucherMarkt\Logik\Csv;
use MaschinensucherMarkt\Logik\Inserat;
use MaschinensucherMarkt\Logik\Rueckgang;
use MaschinensucherMarkt\Logik\Spaltenplan;
use Plenty\Modules\Item\ItemImage\Contracts\ItemImageRepositoryContract;
use Plenty\Modules\Item\Manufacturer\Contracts\ManufacturerRepositoryContract;
use Plenty\Modules\Item\Variation\Contracts\VariationSearchRepositoryContract;
use Plenty\Modules\Plugin\Storage\Contracts\StorageRepositoryContract;
use Plenty\Plugin\Log\Loggable;

/**
 * Baut die Importdatei aus den Artikeln in Plenty.
 *
 * WARUM DER CRON DIE DATEI BAUT UND NICHT DIE ABHOLUNG:
 * Maschinensucher holt die Datei nachts ab und wartet dabei nicht lange. Ein
 * Artikelstamm mit zehntausenden Varianten braucht Minuten — würde der Abruf
 * den Aufbau anstoßen, liefe er in einen Timeout, und die Gegenstelle sähe
 * einen Fehler statt einer Datei. Also baut der Cron im Hintergrund und legt
 * das Ergebnis im Plugin-Storage ab; der Abruf liefert nur noch aus.
 *
 * Der Nebeneffekt ist der eigentliche Gewinn: Geht beim Bauen etwas schief,
 * bleibt die ZULETZT GUTE Datei liegen. Eine kaputte Nacht nimmt dann nichts
 * vom Markt.
 */
class Feedbauer
{
    use Loggable;

    /** Name der Datei im Plugin-Storage. */
    const DATEI = 'maschinensucher.csv';

    /** Varianten je Seite. */
    const PRO_SEITE = 250;

    /** Notbremse gegen eine Endlosschleife, falls Plenty nie "letzte Seite" meldet. */
    const MAX_SEITEN = 2000;

    private $varianten;
    private $bilder;
    private $hersteller;
    private $storage;
    private $einstellungen;
    private $speicher;

    public function __construct(
        VariationSearchRepositoryContract $varianten,
        ItemImageRepositoryContract $bilder,
        ManufacturerRepositoryContract $hersteller,
        StorageRepositoryContract $storage,
        Einstellungen $einstellungen,
        Standspeicher $speicher
    ) {
        $this->varianten = $varianten;
        $this->bilder = $bilder;
        $this->hersteller = $hersteller;
        $this->storage = $storage;
        $this->einstellungen = $einstellungen;
        $this->speicher = $speicher;
    }

    /**
     * Baut die Datei und legt sie ab.
     *
     * @return array Bericht für das Log
     */
    public function bauen()
    {
        $beginn = microtime(true);
        $stand = $this->speicher->stand();

        // ---- Einrichtung ---------------------------------------------------
        $maengel = $this->einstellungen->maengel();
        if (count($maengel) > 0) {
            return $this->abbrechen($stand, 'Nicht eingerichtet: ' . implode(' ', $maengel));
        }

        $plan = Spaltenplan::bauen($this->einstellungen->kopfzeile(), $this->einstellungen->trenner());
        if (count($plan['fehlendePflicht']) > 0) {
            // Lieber die alte Datei stehen lassen als eine ohne Preisspalte.
            return $this->abbrechen(
                $stand,
                'Die hinterlegte Kopfzeile hat keine Spalte für: ' . implode(', ', $plan['fehlendePflicht']) . '.'
            );
        }

        // ---- Artikel einsammeln ---------------------------------------------
        $umgebung = $this->einstellungen->umgebung();
        $flagId = $this->einstellungen->markierungId();
        $flagFeld = $this->einstellungen->markierungFeld();
        $preisliste = $this->einstellungen->preislisteId();
        $ersatzliste = $this->einstellungen->preislisteErsatzId();
        $hersteller = $this->herstellerKarte();

        $bereit = array();
        $zurueck = array();
        $gelesen = 0;
        $markiert = 0;

        for ($seite = 1; $seite <= self::MAX_SEITEN; $seite++) {
            $this->varianten->setSearchParams(array(
                'with' => 'item,variationSalesPrices,variationBarcodes,stock',
                'itemsPerPage' => self::PRO_SEITE,
                'page' => $seite,
            ));
            $ergebnis = $this->varianten->search();
            $zeilen = $ergebnis->getResult();
            $zeilen = is_array($zeilen) ? $zeilen : array();

            foreach ($zeilen as $zeile) {
                $gelesen++;
                $roh = $this->alsArray($zeile);

                // DER SCHALTER: Nur was die Markierung trägt, geht raus.
                if (!Artikelabbildung::istMarkiert($roh, $flagId, $flagFeld)) {
                    continue;
                }
                $markiert++;

                $artikel = Artikelabbildung::ausVariante($roh, $hersteller, array(), $preisliste, $ersatzliste);
                // Bilder nur für markierte Artikel nachladen — ein Aufruf je
                // Artikel, und der Stamm hat zehntausende, von denen die
                // allermeisten nichts mit dem Marktplatz zu tun haben.
                $artikel['bilder'] = $this->bilderZu((int) $artikel['itemId']);

                $inserat = Inserat::bauen($artikel, $umgebung);
                if (Inserat::vollstaendig($inserat)) {
                    $bereit[] = $inserat['werte'];
                } else {
                    $zurueck[] = array(
                        'nummer' => $artikel['nummer'] !== '' ? $artikel['nummer'] : $artikel['variationId'],
                        'grund' => implode(' ', $inserat['maengel']),
                    );
                }
            }

            if ($ergebnis->isLastPage() || count($zeilen) === 0) {
                break;
            }
        }

        // ---- Notbremse --------------------------------------------------------
        // Der Haken in der Konfiguration wird hier zu einer Freigabe auf Zeit.
        // So muss ihn niemand wieder wegnehmen: Sie laeuft von selbst ab.
        if ($this->einstellungen->rueckgangFreigeben() && (int) $stand->freiBis <= time()) {
            $stand->freiBis = Rueckgang::freigabeBis();
            $this->speicher->standSpeichern($stand);
        }

        $rueckgang = Rueckgang::pruefe(
            count($bereit),
            $this->speicher->letzteMenge(),
            $this->speicher->freiBis()
        );
        if ($rueckgang['blockiert']) {
            // Die alte Datei bleibt liegen: Ein fehlgeschlagener Import lässt
            // die Inserate stehen, ein erfolgreicher leerer nimmt sie vom Markt.
            return $this->abbrechen($stand, $rueckgang['meldung']);
        }

        // ---- Schreiben ---------------------------------------------------------
        $text = Csv::datei($bereit, $plan, $this->einstellungen->trenner(), $this->einstellungen->umbrueche());
        $inhalt = Csv::kodiere($text, $this->einstellungen->kodierung());
        $this->storage->uploadObject(Einstellungen::PLUGIN, self::DATEI, $inhalt);

        $stand->gebautAm = time();
        $stand->inserate = count($bereit);
        $stand->uebersprungen = count($zurueck);
        $stand->meldung = $rueckgang['meldung'] === null ? '' : 'Freigegebener Rückgang: ' . $rueckgang['meldung'];
        $this->speicher->standSpeichern($stand);

        $bericht = array(
            'ok' => true,
            'gelesen' => $gelesen,
            'markiert' => $markiert,
            'inserate' => count($bereit),
            'uebersprungen' => count($zurueck),
            'bytes' => strlen($inhalt),
            'spalten' => count($plan['spalten']),
            'kopfzeile' => $plan['herkunft'],
            'dauer' => round(microtime(true) - $beginn, 1),
        );

        $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.dateiGebaut', $bericht);
        if (count($zurueck) > 0) {
            // Die Gründe gehören ins Log und nicht nur in eine Zahl: "17
            // übersprungen" sagt niemandem, was zu tun ist.
            $this->getLogger(__METHOD__)->warning('MaschinensucherMarkt::log.uebersprungen', array_slice($zurueck, 0, 50));
        }

        // Fuer den Testaufruf von Hand: die Gruende mitgeben, nicht nur die
        // Zahl. Wer die Datei prueft, will wissen, welcher Artikel warum
        // fehlt — im Log nachschlagen zu muessen kostet jedes Mal Zeit.
        $bericht['gruende'] = array_slice($zurueck, 0, 50);

        return $bericht;
    }

    /**
     * Bricht ab, ohne die vorhandene Datei anzufassen.
     *
     * Das ist der wichtigste Zweig dieser Klasse: Solange nichts Neues
     * geschrieben wird, liefert die Abholung weiter das, was zuletzt gut war.
     */
    private function abbrechen($stand, $meldung)
    {
        $stand->meldung = (string) $meldung;
        $this->speicher->standSpeichern($stand);
        $this->getLogger(__METHOD__)->error('MaschinensucherMarkt::log.nichtGebaut', array('meldung' => $meldung));
        return array('ok' => false, 'meldung' => $meldung);
    }

    /** Herstellernamen nach ID. Am Artikel steht nur die ID. */
    private function herstellerKarte()
    {
        $karte = array();
        try {
            $seite = 1;
            do {
                $ergebnis = $this->hersteller->all(array('id', 'name'), 250, $seite);
                foreach ((array) $ergebnis->getResult() as $eintrag) {
                    $eintrag = $this->alsArray($eintrag);
                    if (isset($eintrag['id']) && isset($eintrag['name'])) {
                        $karte[(int) $eintrag['id']] = (string) $eintrag['name'];
                    }
                }
                $seite++;
            } while (!$ergebnis->isLastPage() && $seite < 20);
        } catch (\Throwable $e) {
            // Ohne Herstellerrechte läuft der Lauf weiter — im Inserat bleibt
            // das Feld leer, statt dass die ganze Datei ausfällt.
            $this->getLogger(__METHOD__)->warning('MaschinensucherMarkt::log.herstellerFehlen', $e->getMessage());
        }
        return $karte;
    }

    /**
     * Die Bild-Adressen eines Artikels, größte Fassung zuerst nach Position.
     *
     * Plenty liefert öffentliche Adressen — die können unverändert ins
     * Inserat. Auf einem Maschinenmarktplatz wird in die Fotos gezoomt,
     * deshalb die große Fassung und nicht die Vorschau.
     */
    private function bilderZu($itemId)
    {
        if ($itemId <= 0) {
            return array();
        }
        try {
            $bilder = array();
            foreach ((array) $this->bilder->findByItemId($itemId) as $bild) {
                $bild = $this->alsArray($bild);
                $url = '';
                foreach (array('url', 'urlMiddle', 'urlPreview', 'urlSecondPreview') as $feld) {
                    if (isset($bild[$feld]) && trim((string) $bild[$feld]) !== '') {
                        $url = trim((string) $bild[$feld]);
                        break;
                    }
                }
                if ($url !== '') {
                    $bilder[] = array('position' => isset($bild['position']) ? (int) $bild['position'] : 99, 'url' => $url);
                }
            }
            usort($bilder, function ($a, $b) {
                return $a['position'] - $b['position'];
            });
            $urls = array();
            foreach ($bilder as $bild) {
                $urls[] = $bild['url'];
            }
            return $urls;
        } catch (\Throwable $e) {
            return array();
        }
    }

    /**
     * Modelle, Objekte und Arrays kommen je nach Plenty-Version gemischt.
     *
     * Ohne method_exists — das lässt der Plugin-Build nicht zu. Stattdessen
     * wird toArray() versucht; gibt es die Methode nicht, fängt der catch den
     * Fehler und es bleibt beim einfachen Cast.
     */
    private function alsArray($wert)
    {
        if (is_array($wert)) {
            return $wert;
        }
        try {
            return (array) $wert->toArray();
        } catch (\Throwable $e) {
            return (array) $wert;
        }
    }
}
