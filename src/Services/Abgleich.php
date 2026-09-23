<?php

namespace MaschinensucherMarkt\Services;

use MaschinensucherMarkt\Api\Zugang;
use MaschinensucherMarkt\Logik\Antwort;
use MaschinensucherMarkt\Logik\Artikelabbildung;
use MaschinensucherMarkt\Logik\Entscheidung;
use MaschinensucherMarkt\Logik\Inseratdaten;
use MaschinensucherMarkt\Models\Verknuepfung;
use Plenty\Modules\Item\Manufacturer\Contracts\ManufacturerRepositoryContract;
use Plenty\Modules\Item\Variation\Contracts\VariationSearchRepositoryContract;
use Plenty\Plugin\Log\Loggable;

/**
 * Der Abgleich: aus Plenty nach Maschinensucher.
 *
 * Er kann zweierlei:
 *   lauf()          — ueber den ganzen Artikelstamm, als Sicherheitsnetz
 *   fuerVarianten() — nur ueber bestimmte Varianten, sofort
 *
 * Das zweite ist der Echtzeitweg. Wenn eine Bestellung hereinkommt, sinkt
 * der Bestand, und genau dann muss das Inserat weg — nicht beim naechsten
 * Zeitplan. Die Ereignisaktion ruft deshalb fuerVarianten() mit den
 * Positionen des Auftrags auf.
 *
 * Der ganze Durchlauf bleibt trotzdem noetig: Er faengt alles auf, was an
 * keinem Auftrag haengt — eine Umlagerung, eine Inventur, ein von Hand
 * geaenderter Preis.
 */
class Abgleich
{
    use Loggable;

    const PRO_SEITE = 250;
    const MAX_SEITEN = 2000;

    /**
     * Wie viele schreibende Aufrufe ein Lauf hoechstens macht.
     *
     * Die API begrenzt das Anlegen und antwortet sonst mit 403. Wer
     * dagegenlaeuft, verliert nicht nur den Aufruf, sondern moeglicherweise
     * den Zugang fuer eine Weile. Der Rest kommt beim naechsten Lauf dran —
     * bei einem Zeitplan alle fuenfzehn Minuten ist das kein Verlust.
     */
    const SCHREIBGRENZE = 60;

    /** @var VariationSearchRepositoryContract */
    private $varianten;

    /** @var ManufacturerRepositoryContract */
    private $hersteller;

    /** @var Zugang */
    private $api;

    /** @var Zuordnung */
    private $zuordnung;

    /** @var Einstellungen */
    private $einstellungen;

    /** @var Bilder */
    private $bilder;

    public function __construct(
        VariationSearchRepositoryContract $varianten,
        ManufacturerRepositoryContract $hersteller,
        Zugang $api,
        Zuordnung $zuordnung,
        Einstellungen $einstellungen,
        Bilder $bilder
    ) {
        $this->varianten = $varianten;
        $this->hersteller = $hersteller;
        $this->api = $api;
        $this->zuordnung = $zuordnung;
        $this->einstellungen = $einstellungen;
        $this->bilder = $bilder;
    }

    /**
     * Der ganze Stamm.
     */
    public function lauf()
    {
        return $this->arbeiten(array());
    }

    /**
     * Nur bestimmte Varianten — der Weg fuer die Ereignisaktion.
     *
     * @param array $variantenIds
     */
    public function fuerVarianten(array $variantenIds)
    {
        $sauber = array();
        foreach ($variantenIds as $id) {
            if ((int) $id > 0) {
                $sauber[] = (int) $id;
            }
        }
        if (count($sauber) === 0) {
            return array('ok' => true, 'gelesen' => 0, 'taten' => array(), 'meldung' => 'Keine Varianten angegeben.');
        }
        return $this->arbeiten($sauber);
    }

    // ------------------------------------------------------------------------

    private function arbeiten(array $nurDiese)
    {
        $beginn = microtime(true);

        if (!$this->einstellungen->apiEingerichtet()) {
            return array('ok' => false, 'meldung' => 'Es ist kein API-Token hinterlegt.');
        }

        $maengel = $this->einstellungen->maengel();
        if (count($maengel) > 0) {
            return array('ok' => false, 'meldung' => 'Nicht eingerichtet: ' . implode(' ', $maengel));
        }

        // DIE SPERRE VOR DEM ERSTEN SCHREIBEN.
        //
        // Ohne Zuordnung haelt dieser Lauf jedes bestehende Inserat fuer
        // unbekannt und legt es neu an — bei diesem Konto waeren das
        // hunderte Dubletten, jede mit eigener Laufzeit und eigenen Kosten.
        //
        // Die Bestandsaufnahme laeuft alle fuenf Minuten und fuellt die
        // Tabelle. Bis sie das getan hat, wird hier nichts geschrieben. Wer
        // wirklich bei null anfaengt, hat drueben auch keine Inserate zu
        // verlieren — und sobald das erste angelegt ist, greift die Sperre
        // nicht mehr.
        if ($this->zuordnung->anzahl() === 0 && $this->api->hatInserate()) {
            return array(
                'ok' => false,
                'meldung' => 'Die Bestandsaufnahme ist noch nicht gelaufen. '
                    . 'Es wird nichts geschrieben, solange nicht bekannt ist, '
                    . 'welches Inserat zu welchem Artikel gehoert.',
            );
        }

        $probelauf = $this->einstellungen->probelauf();
        $vorhaben  = array();
        $umgebung  = $this->einstellungen->umgebung();
        $flagId    = $this->einstellungen->markierungId();
        $flagFeld  = $this->einstellungen->markierungFeld();
        $preisliste = $this->einstellungen->preislisteId();
        $ersatzliste = $this->einstellungen->preislisteErsatzId();
        $hersteller = $this->herstellerKarte();
        $karte = $this->zuordnung->alleNachArtikel();

        $zaehler = array(
            Entscheidung::ANLEGEN => 0, Entscheidung::AENDERN => 0,
            Entscheidung::PAUSIEREN => 0, Entscheidung::AKTIVIEREN => 0,
            Entscheidung::NICHTS => 0, Entscheidung::ZURUECK => 0,
        );
        $gelesen = 0;
        $geschrieben = 0;
        $gescheitert = array();
        $gebremst = false;

        foreach ($this->varianten($nurDiese) as $roh) {
            $gelesen++;

            $artikel = Artikelabbildung::ausVariante($roh, $hersteller, array(), $preisliste, $ersatzliste);
            $artikelId = (int) $artikel['itemId'];
            $bekannt = isset($karte[$artikelId]) ? $karte[$artikelId] : null;

            // Die Rubrik kommt vom bestehenden Inserat. Fuer alles, was
            // drueben schon steht, ist damit nichts zu pflegen.
            if ($bekannt !== null && (int) $bekannt->kategorieId > 0) {
                $artikel['kategorieId'] = (int) $bekannt->kategorieId;
            }

            $markiert = Artikelabbildung::istMarkiert($roh, $flagId, $flagFeld);

            // Bilder nur fuer das, was auch wirklich rausgeht. Ein Aufruf je
            // Bild ist teuer, und der Stamm hat zehntausende Artikel, die
            // nichts mit dem Marktplatz zu tun haben.
            $gebaut = array('koerper' => array(), 'maengel' => array(), 'hinweise' => array());
            if ($markiert) {
                $gebaut = Inseratdaten::bauen($artikel, $umgebung);
            }

            $neuerAbdruck = count($gebaut['koerper']) > 0
                ? Inseratdaten::fingerabdruck($gebaut['koerper'])
                : '';

            $entscheidung = Entscheidung::treffen(array(
                'markiert'           => $markiert,
                'bestand'            => (int) $artikel['bestand'],
                'maengel'            => $gebaut['maengel'],
                'inseratId'          => $bekannt !== null ? (int) $bekannt->inseratId : 0,
                'zustand'            => $bekannt !== null ? (string) $bekannt->zustand : 'unbekannt',
                'fingerabdruck'      => $bekannt !== null ? (string) $bekannt->fingerabdruck : '',
                'neuerFingerabdruck' => $neuerAbdruck,
                // Verwaltet ist, was das Plugin selbst schon einmal
                // geschrieben hat. Nur fuer solche Inserate ist eine
                // fehlende Markierung eine Anweisung.
                'verwaltet'          => $bekannt !== null && (int) $bekannt->gesendetAm > 0,
            ));

            $tat = $entscheidung['tat'];

            if (Entscheidung::schreibt($tat) && $geschrieben >= self::SCHREIBGRENZE) {
                // Nicht weiterzaehlen: Was hier liegen bleibt, ist beim
                // naechsten Lauf immer noch faellig.
                $gebremst = true;
                continue;
            }

            $zaehler[$tat]++;

            if ($tat === Entscheidung::NICHTS) {
                continue;
            }
            if ($tat === Entscheidung::ZURUECK) {
                $gescheitert[] = array('artikel' => $artikelId, 'grund' => $entscheidung['grund']);
                continue;
            }

            if ($probelauf) {
                // Nichts senden, nichts hochladen, nichts an der Zuordnung
                // aendern. Nur festhalten, was passiert waere.
                $vorhaben[] = array(
                    'artikel' => $artikelId,
                    'inserat' => $bekannt !== null ? (int) $bekannt->inseratId : 0,
                    'tat'     => $tat,
                    'grund'   => $entscheidung['grund'],
                );
                $geschrieben++;
                continue;
            }

            $ergebnis = $this->ausfuehren($tat, $artikel, $gebaut, $bekannt, $umgebung, $neuerAbdruck, $entscheidung['grund']);
            $geschrieben++;

            if (!$ergebnis['ok']) {
                $gescheitert[] = array('artikel' => $artikelId, 'grund' => $ergebnis['meldung']);
            }
        }

        $bericht = array(
            'ok'          => true,
            'probelauf'   => $probelauf,
            'gelesen'     => $gelesen,
            'angelegt'    => $zaehler[Entscheidung::ANLEGEN],
            'geaendert'   => $zaehler[Entscheidung::AENDERN],
            'pausiert'    => $zaehler[Entscheidung::PAUSIEREN],
            'aktiviert'   => $zaehler[Entscheidung::AKTIVIEREN],
            'unveraendert' => $zaehler[Entscheidung::NICHTS],
            'zurueck'     => $zaehler[Entscheidung::ZURUECK],
            'gebremst'    => $gebremst,
            'dauer'       => round(microtime(true) - $beginn, 1),
        );

        $this->getLogger(__METHOD__)->info(
            $probelauf ? 'MaschinensucherMarkt::log.probelauf' : 'MaschinensucherMarkt::log.abgeglichen',
            $bericht
        );

        if ($probelauf && count($vorhaben) > 0) {
            // Genau diese Liste ist der Sinn des Probelaufs: Sie zeigt
            // Artikel fuer Artikel, was beim Umschalten passieren wuerde.
            $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.vorhaben', array_slice($vorhaben, 0, 50));
        }

        if (count($gescheitert) > 0) {
            $this->getLogger(__METHOD__)->warning('MaschinensucherMarkt::log.nichtUebertragen',
                array_slice($gescheitert, 0, 50));
        }

        $bericht['gruende'] = array_slice($gescheitert, 0, 50);
        return $bericht;
    }

    /**
     * Eine Entscheidung ausfuehren und die Zuordnung nachziehen.
     */
    private function ausfuehren($tat, array $artikel, array $gebaut, $bekannt, array $umgebung, $neuerAbdruck, $grund)
    {
        $inseratId = $bekannt !== null ? (int) $bekannt->inseratId : 0;

        if ($tat === Entscheidung::PAUSIEREN) {
            $antwort = $this->api->pausieren($inseratId);
            if (Antwort::istOk($antwort)) {
                $this->merken($bekannt, Verknuepfung::PAUSIERT, null, time(), $grund);
                return array('ok' => true, 'meldung' => '');
            }
            return $this->fehlschlag($bekannt, $antwort, 'Pausieren');
        }

        if ($tat === Entscheidung::AKTIVIEREN) {
            $antwort = $this->api->aktivieren($inseratId);
            if (Antwort::istOk($antwort)) {
                $this->merken($bekannt, Verknuepfung::AKTIV, null, time(), '');
                return array('ok' => true, 'meldung' => '');
            }
            return $this->fehlschlag($bekannt, $antwort, 'Aktivieren');
        }

        // Anlegen und Aendern brauchen die Bilder. Sie werden einzeln
        // hochgeladen und erst danach im Inserat genannt.
        $koerper = $gebaut['koerper'];
        $namen = $this->bilder->hochladen((int) $artikel['itemId'], $bekannt);
        if (count($namen) > 0) {
            $koerper['images'] = $namen;
        }

        if ($tat === Entscheidung::ANLEGEN) {
            $antwort = $this->api->anlegen($koerper);
            if (Antwort::istOk($antwort)) {
                $neu = $bekannt !== null ? $bekannt : $this->zuordnung->neu();
                $neu->artikelId = (int) $artikel['itemId'];
                $neu->variantenId = (int) $artikel['variationId'];
                $neu->inseratId = $this->inseratIdAus($antwort);
                $neu->internalId = isset($koerper['internalId']) ? (string) $koerper['internalId'] : '';
                $neu->kategorieId = isset($koerper['categoryId']) ? (int) $koerper['categoryId'] : 0;
                $neu->zustand = Verknuepfung::AKTIV;
                $neu->fingerabdruck = $neuerAbdruck;
                $neu->gesendetAm = time();
                $neu->meldung = '';
                $this->zuordnung->speichern($neu);
                return array('ok' => true, 'meldung' => '');
            }
            return $this->fehlschlag($bekannt, $antwort, 'Anlegen');
        }

        $antwort = $this->api->aendern($inseratId, $koerper);
        if (Antwort::istOk($antwort)) {
            $this->merken($bekannt, null, $neuerAbdruck, time(), '');
            return array('ok' => true, 'meldung' => '');
        }
        return $this->fehlschlag($bekannt, $antwort, 'Aendern');
    }

    /**
     * Ein gescheiterter Aufruf. Der Fingerabdruck wird bewusst NICHT
     * gesetzt: Sonst gaelte der Artikel als uebertragen und kaeme nie wieder
     * an die Reihe.
     */
    private function fehlschlag($bekannt, array $antwort, $was)
    {
        $meldung = $was . ' fehlgeschlagen: ' . $antwort['meldung'];

        if ($antwort['art'] === Antwort::FEHLT && $bekannt !== null) {
            // Drueben geloescht. Die Zuordnung zeigt ins Leere und muss weg,
            // sonst versucht das Plugin bis in alle Ewigkeit, ein Inserat zu
            // aendern, das es nicht mehr gibt.
            $this->zuordnung->entfernen($bekannt);
            return array('ok' => false, 'meldung' => $meldung . ' — die Zuordnung wurde entfernt.');
        }

        $this->merken($bekannt, null, null, null, $meldung);
        return array('ok' => false, 'meldung' => $meldung);
    }

    /**
     * Die Zuordnung nachziehen.
     *
     * Jedes Feld einzeln statt ueber eine Schleife: Der Plugin-Build laesst
     * keine dynamischen Eigenschaftsnamen zu. Null heisst "nicht anfassen",
     * damit ein Aufruf nur das schreibt, was er wirklich weiss.
     */
    private function merken($verknuepfung, $zustand = null, $fingerabdruck = null, $gesendetAm = null, $meldung = null)
    {
        if ($verknuepfung === null) {
            return;
        }
        if ($zustand !== null) {
            $verknuepfung->zustand = (string) $zustand;
        }
        if ($fingerabdruck !== null) {
            $verknuepfung->fingerabdruck = (string) $fingerabdruck;
        }
        if ($gesendetAm !== null) {
            $verknuepfung->gesendetAm = (int) $gesendetAm;
        }
        if ($meldung !== null) {
            $verknuepfung->meldung = (string) $meldung;
        }
        $this->zuordnung->speichern($verknuepfung);
    }

    private function inseratIdAus(array $antwort)
    {
        $daten = $antwort['daten'];
        foreach (array('id', 'listingId', 'adId') as $schluessel) {
            if (isset($daten[$schluessel]) && (int) $daten[$schluessel] > 0) {
                return (int) $daten[$schluessel];
            }
        }
        return 0;
    }

    /**
     * Die Varianten, ueber die gearbeitet wird — entweder alle oder die
     * genannten.
     *
     * Die genannten werden einzeln ueber den Filter "id" geholt. Ein
     * Auftrag hat eine Handvoll Positionen, das sind eine Handvoll Aufrufe
     * — und der Filter "id" ist der, den Plenty dokumentiert.
     */
    private function varianten(array $nurDiese)
    {
        $mit = 'item,variationSalesPrices,variationBarcodes,stock';

        if (count($nurDiese) > 0) {
            $heraus = array();
            foreach ($nurDiese as $id) {
                $this->varianten->clearFilters();
                $this->varianten->setFilters(array('id' => (int) $id));
                $this->varianten->setSearchParams(array('with' => $mit, 'itemsPerPage' => 10, 'page' => 1));
                $zeilen = $this->varianten->search()->getResult();
                foreach ((is_array($zeilen) ? $zeilen : array()) as $zeile) {
                    $heraus[] = $this->alsArray($zeile);
                }
            }
            return $heraus;
        }

        $heraus = array();
        $this->varianten->clearFilters();
        for ($seite = 1; $seite <= self::MAX_SEITEN; $seite++) {
            $this->varianten->setSearchParams(array(
                'with' => $mit,
                'itemsPerPage' => self::PRO_SEITE,
                'page' => $seite,
            ));
            $ergebnis = $this->varianten->search();
            $zeilen = $ergebnis->getResult();
            $zeilen = is_array($zeilen) ? $zeilen : array();

            foreach ($zeilen as $zeile) {
                $heraus[] = $this->alsArray($zeile);
            }

            if ($ergebnis->isLastPage() || count($zeilen) === 0) {
                break;
            }
        }

        return $heraus;
    }

    private function herstellerKarte()
    {
        $karte = array();
        try {
            foreach ((array) $this->hersteller->all(array('id', 'name')) as $eintrag) {
                $eintrag = (array) $eintrag;
                if (isset($eintrag['id'])) {
                    $karte[(int) $eintrag['id']] = isset($eintrag['name']) ? (string) $eintrag['name'] : '';
                }
            }
        } catch (\Throwable $e) {
            // Ohne Herstellernamen kann ein Inserat entstehen, nur eben
            // ohne Marke. Das ist kein Grund, den Lauf abzubrechen.
        }
        return $karte;
    }

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
