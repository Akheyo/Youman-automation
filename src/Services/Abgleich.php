<?php

namespace MaschinensucherMarkt\Services;

use MaschinensucherMarkt\Api\Zugang;
use MaschinensucherMarkt\Logik\Antwort;
use MaschinensucherMarkt\Logik\Artikelabbildung;
use MaschinensucherMarkt\Logik\Entscheidung;
use MaschinensucherMarkt\Logik\Inseratdaten;
use MaschinensucherMarkt\Logik\Suchdokument;
use MaschinensucherMarkt\Models\Verknuepfung;
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

    /** @var Artikelsuche */
    private $suche;

    /** @var Zugang */
    private $api;

    /** @var Zuordnung */
    private $zuordnung;

    /** @var Einstellungen */
    private $einstellungen;

    /** @var Bilder */
    private $bilder;

    public function __construct(
        Artikelsuche $suche,
        Zugang $api,
        Zuordnung $zuordnung,
        Einstellungen $einstellungen,
        Bilder $bilder
    ) {
        $this->suche = $suche;
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
        // Massgeblich ist, ob die Bestandsaufnahme VOLLSTAENDIG durchlief —
        // nicht, ob die Tabelle Zeilen hat. Eine halbe Tabelle aus einem
        // abgebrochenen Lauf saehe sonst aus wie eine fertige. Wer wirklich
        // bei null anfaengt, hat drueben auch keine Inserate zu verlieren.
        $probelauf = $this->einstellungen->probelauf();
        $bestandVollstaendig = $this->zuordnung->bestandGelesen();

        // Im Probelauf wird ohnehin nichts geschrieben, also gibt es auch
        // nichts zu sperren. So laesst sich ein einzelner Artikel pruefen,
        // bevor die Aufnahme durch ist — der Bericht sagt dazu, dass die
        // Zuordnung noch unvollstaendig war.
        if (!$probelauf && !$bestandVollstaendig && $this->api->hatInserate()) {
            return array(
                'ok' => false,
                'meldung' => 'Die Bestandsaufnahme ist noch nicht gelaufen. '
                    . 'Es wird nichts geschrieben, solange nicht bekannt ist, '
                    . 'welches Inserat zu welchem Artikel gehoert.',
            );
        }

        $vorhaben  = array();
        $umgebung  = $this->einstellungen->umgebung();
        $flagId    = $this->einstellungen->markierungId();
        $flagFeld  = $this->einstellungen->markierungFeld();
        $preisliste = $this->einstellungen->preislisteId();
        $ersatzliste = $this->einstellungen->preislisteErsatzId();
        $gefunden = $this->varianten($nurDiese, $flagId, $flagFeld);
        $hersteller = $this->herstellerKarte($gefunden);
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

        $erstesDokument = null;
        $ersterArtikel = null;

        foreach ($gefunden as $eintrag) {
            $roh = $eintrag['variante'];
            $gelesen++;

            $artikel = Artikelabbildung::ausVariante($roh, $hersteller, array(), $preisliste, $ersatzliste);
            $artikelId = (int) $artikel['itemId'];
            $bekannt = isset($karte[$artikelId]) ? $karte[$artikelId] : null;

            // Die Rubrik kommt vom bestehenden Inserat. Fuer alles, was
            // drueben schon steht, ist damit nichts zu pflegen.
            if ($bekannt !== null && (int) $bekannt->kategorieId > 0) {
                $artikel['kategorieId'] = (int) $bekannt->kategorieId;
            }

            // Ob markiert, sagt die Suche selbst: Markierte Artikel kommen aus
            // einer Suche mit Markierungsfilter. Das haengt nicht davon ab, ob
            // das Suchdokument die Markierung als Feld mitliefert.
            $markiert = $eintrag['markiert'];

            if ($erstesDokument === null) {
                // Fuer die Fehlersuche: wie Plenty das erste Dokument gegliedert
                // hat, und was daraus geworden ist.
                $erstesDokument = Suchdokument::gliederung($eintrag['dokument']);
                $ersterArtikel = array(
                    'itemId'   => $artikel['itemId'],
                    'titel'    => $artikel['titel'],
                    'preis'    => $artikel['preis'],
                    'bestand'  => $artikel['bestand'],
                    'markiert' => $markiert,
                );
            }

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
                'perApi'             => $bekannt !== null && (int) $bekannt->perApi === 1,
                // Angelegt, aber die ID kam nicht an. Nicht noch einmal
                // anlegen — die Bestandsaufnahme findet das Inserat ueber
                // seine Referenz und traegt die ID nach.
                'angelegtOhneId'     => $bekannt !== null && (int) $bekannt->inseratId <= 0
                    && (int) $bekannt->gesendetAm > 0,
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
                $geplant = array(
                    'artikel' => $artikelId,
                    'inserat' => $bekannt !== null ? (int) $bekannt->inseratId : 0,
                    'tat'     => $tat,
                    'grund'   => $entscheidung['grund'],
                );
                if (count($gebaut['koerper']) > 0 && ($tat === Entscheidung::ANLEGEN || $tat === Entscheidung::AENDERN)) {
                    // Genau das Inserat, das rausginge — bevor irgendetwas
                    // wirklich geschrieben wird, soll man es sehen koennen.
                    // Die Beschreibung gekuerzt, damit das Protokoll lesbar bleibt.
                    $vorschau = $gebaut['koerper'];
                    foreach ((array) $vorschau['description'] as $sprache => $text) {
                        $vorschau['description'][$sprache] = mb_substr((string) $text, 0, 300, 'UTF-8');
                    }
                    $geplant['inserat_vorschau'] = $vorschau;
                    $geplant['hinweise'] = $gebaut['hinweise'];
                }
                $vorhaben[] = $geplant;
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
            'zuordnungVollstaendig' => $bestandVollstaendig,
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
        $bericht['ersterArtikel'] = $ersterArtikel;
        $bericht['erstesDokument'] = $erstesDokument;
        if ($probelauf) {
            // Mit in den Bericht, damit es auch dort steht, wo nur der
            // Bericht protokolliert wird.
            $bericht['vorhaben'] = array_slice($vorhaben, 0, 20);
        }
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
                $neu->perApi = 1;
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
        return Antwort::inseratId(is_array($antwort['daten']) ? $antwort['daten'] : array());
    }

    /**
     * Die Varianten, ueber die gearbeitet wird, jeweils mit der Angabe, ob ihr
     * Artikel markiert ist.
     *
     * Bestimmte Varianten (Flow): alle genannten, und eine zweite Suche mit
     * Markierungsfilter sagt, welche davon markiert sind.
     *
     * Ganzer Durchlauf (Zeitplan): nur die markierten — plus die Artikel, die
     * das Plugin selbst verwaltet, deren Markierung aber inzwischen fehlt.
     * Die muessen dabei sein, sonst wuerde ihr Inserat nie pausiert.
     *
     * @return array Eintraege mit 'variante', 'markiert', 'dokument'
     */
    private function varianten(array $nurDiese, $flagId, $flagFeld)
    {
        $eintraege = array();

        if (count($nurDiese) > 0) {
            $markiert = array();
            foreach ($this->suche->markierteUnter($nurDiese, $flagId, $flagFeld) as $dokument) {
                $markiert[(int) Suchdokument::alsVariante((array) $dokument)['id']] = true;
            }
            foreach ($this->suche->nachVariantenIds($nurDiese) as $dokument) {
                $variante = Suchdokument::alsVariante((array) $dokument);
                $eintraege[] = array(
                    'variante' => $variante,
                    'markiert' => isset($markiert[(int) $variante['id']]),
                    'dokument' => (array) $dokument,
                );
            }
            return $eintraege;
        }

        $gesehen = array();
        foreach ($this->suche->alleMarkierten($flagId, $flagFeld) as $dokument) {
            $variante = Suchdokument::alsVariante((array) $dokument);
            $gesehen[(int) $variante['itemId']] = true;
            $eintraege[] = array('variante' => $variante, 'markiert' => true, 'dokument' => (array) $dokument);
        }

        $verwaltetOhneMarkierung = array();
        foreach ($this->zuordnung->alle() as $zeile) {
            $artikelId = (int) $zeile->artikelId;
            if ($artikelId > 0 && (int) $zeile->gesendetAm > 0 && !isset($gesehen[$artikelId])) {
                $verwaltetOhneMarkierung[] = $artikelId;
            }
        }
        foreach ($this->suche->nachArtikelIds($verwaltetOhneMarkierung) as $dokument) {
            $eintraege[] = array(
                'variante' => Suchdokument::alsVariante((array) $dokument),
                'markiert' => false,
                'dokument' => (array) $dokument,
            );
        }

        return $eintraege;
    }

    /**
     * Herstellernamen aus den gefundenen Dokumenten — sie bringen sie mit,
     * ein eigener Aufruf fuer die Herstellerliste ist nicht noetig.
     */
    private function herstellerKarte(array $eintraege)
    {
        $karte = array();
        foreach ($eintraege as $eintrag) {
            $id = (int) $eintrag['variante']['item']['manufacturerId'];
            $name = Suchdokument::herstellername($eintrag['dokument']);
            if ($id > 0 && $name !== '') {
                $karte[$id] = $name;
            }
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
