<?php

namespace MaschinensucherMarkt\Services;

use MaschinensucherMarkt\Api\Zugang;
use MaschinensucherMarkt\Logik\Antwort;
use MaschinensucherMarkt\Logik\Artikelabbildung;
use MaschinensucherMarkt\Logik\Entscheidung;
use MaschinensucherMarkt\Logik\Inseratdaten;
use MaschinensucherMarkt\Logik\Laufzeit;
use MaschinensucherMarkt\Logik\Rubrik;
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

    /** @var Rubrikauswahl */
    private $rubriken;

    /** @var Lagerbestand */
    private $lager;

    public function __construct(
        Artikelsuche $suche,
        Zugang $api,
        Zuordnung $zuordnung,
        Einstellungen $einstellungen,
        Bilder $bilder,
        Rubrikauswahl $rubriken,
        Lagerbestand $lager
    ) {
        $this->suche = $suche;
        $this->api = $api;
        $this->zuordnung = $zuordnung;
        $this->einstellungen = $einstellungen;
        $this->bilder = $bilder;
        $this->rubriken = $rubriken;
        $this->lager = $lager;
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
        $aufAnfrage = $this->preisAufAnfrage($nurDiese);

        // Bremse gegen einen unvollstaendigen Suchindex: Findet die
        // Markierungssuche deutlich weniger Artikel als im letzten Lauf,
        // pausiert dieser Lauf nichts wegen "Markierung entfernt". Ist der
        // Rueckgang echt (viele Markierungen auf einmal entfernt), zieht der
        // naechste Lauf nach - er vergleicht dann schon mit der neuen Zahl.
        $markierungUnsicher = false;
        $markiertJetzt = -1;
        if (count($nurDiese) === 0) {
            $markiertJetzt = 0;
            foreach ($gefunden as $eintrag) {
                if ($eintrag['markiert']) {
                    $markiertJetzt++;
                }
            }
            $markiertVorher = $this->zuordnung->markiertZahl();
            if ($markiertVorher > 0 && $markiertJetzt < $markiertVorher * 0.9) {
                $markierungUnsicher = true;
                $this->getLogger(__METHOD__)->warning('MaschinensucherMarkt::log.markierteEingebrochen', array(
                    'vorher' => $markiertVorher,
                    'jetzt'  => $markiertJetzt,
                ));
            }
            $this->zuordnung->markiertZahlMerken($markiertJetzt);
        }
        $hersteller = $this->herstellerKarte($gefunden);
        $karte = $this->zuordnung->alleNachArtikel();
        $rubrikEigenschaft = $this->einstellungen->rubrikEigenschaft();
        $rubrikMeldungen = array();

        $zaehler = array(
            Entscheidung::ANLEGEN => 0, Entscheidung::AENDERN => 0,
            Entscheidung::PAUSIEREN => 0, Entscheidung::AKTIVIEREN => 0,
            Entscheidung::NICHTS => 0, Entscheidung::ZURUECK => 0,
            Entscheidung::LOESCHEN => 0,
        );
        $versandLoeschen = $this->einstellungen->versandLoeschen();
        $geloeschtListe = array();
        $freigegebenListe = array();
        // Verlaengert wird nur im ganzen Durchlauf, nicht in der Flow-Aktion.
        $verlaengernTage = count($nurDiese) === 0 ? $this->einstellungen->verlaengernTage() : 0;
        $jetzt = time();
        $faellig = array();
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
            $artikel['preisAufAnfrage'] = isset($aufAnfrage[$artikelId]);
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

            // Die Rubrik aus der Eigenschaft am Artikel. Sie geht dem
            // bestehenden Inserat vor: Wer sie in Plenty umstellt, will das
            // Inserat umziehen. Fehlt sie, bleibt es bei der Rubrik des
            // bestehenden Inserats bzw. bei der Auffangrubrik.
            $rubrik = array('id' => 0, 'grund' => '');
            if ($markiert && $rubrikEigenschaft > 0) {
                $werte = Suchdokument::eigenschaft($eintrag['dokument'], $rubrikEigenschaft);
                $rubrik = Rubrik::aus($werte, count($werte) > 0 ? $this->rubriken->karte($rubrikEigenschaft) : array());
                if ($rubrik['id'] > 0) {
                    $artikel['kategorieId'] = $rubrik['id'];
                } elseif (count($rubrikMeldungen) < 20) {
                    $rubrikMeldungen[] = array('artikel' => $artikelId, 'grund' => $rubrik['grund']);
                }
            }

            if ($erstesDokument === null) {
                // Fuer die Fehlersuche: wie Plenty das erste Dokument gegliedert
                // hat, und was daraus geworden ist.
                $erstesDokument = Suchdokument::gliederung($eintrag['dokument']);
                $ersterArtikel = array(
                    'itemId'   => $artikel['itemId'],
                    'titel'    => $artikel['titel'],
                    'preis'    => $artikel['preis'],
                    'bestand'  => $artikel['bestand'],
                    'warenbestand' => $artikel['warenbestand'],
                    'markiert' => $markiert,
                    'rubrik'   => $rubrik,
                );
            }

            // Bilder nur fuer das, was auch wirklich rausgeht. Ein Aufruf je
            // Bild ist teuer, und der Stamm hat zehntausende Artikel, die
            // nichts mit dem Marktplatz zu tun haben.
            $gebaut = array('koerper' => array(), 'maengel' => array(), 'hinweise' => array());
            if ($markiert) {
                $gebaut = Inseratdaten::bauen($artikel, $umgebung);
            }

            // Verschickt oder nur verkauft? Den Warenbestand kennt der
            // Suchindex nicht - fuer die Kandidaten direkt aus dem Lager.
            if ($versandLoeschen && $markiert && $artikel['warenbestand'] === null
                && $bekannt !== null && (int) $bekannt->inseratId > 0
                && (float) $artikel['bestand'] <= 0) {
                $artikel['warenbestand'] = $this->lager->warenbestand((int) $artikel['variationId']);
            }

            // Die Bilder gehoeren zum Stand des Inserats: Kommt eins dazu oder
            // fehlte es beim Anlegen, geht das Inserat neu raus. Nur gelesen,
            // wo drueben auch geschrieben werden darf.
            $bildAdressen = null;
            $bilderZaehlen = $markiert && count($gebaut['koerper']) > 0 && (float) $artikel['bestand'] > 0
                && ($bekannt === null || (int) $bekannt->perApi === 1
                    || $this->einstellungen->altInserateAendern($artikelId));
            if ($bilderZaehlen) {
                $bildAdressen = $this->bilder->adressen($artikelId);
            }
            $neuerAbdruck = count($gebaut['koerper']) > 0
                ? Inseratdaten::fingerabdruck($bildAdressen === null
                    ? $gebaut['koerper']
                    : array_merge($gebaut['koerper'], array('bildquellen' => implode(',', $bildAdressen))))
                : '';

            // Freigegeben: Das Plugin gibt das Inserat aus der Hand. Statt es
            // wegen der fehlenden Markierung zu pausieren, aktiviert es es
            // (bei Bestand) einmal wieder und vergisst, dass es es verwaltet
            // hat. Danach gilt es als vorgefunden und bleibt unangetastet,
            // bis der Artikel wieder markiert wird.
            //
            // Dasselbe ohne Einstellung, wenn jemand ein Inserat, das das
            // Plugin wegen der fehlenden Markierung pausiert hat, bei
            // Maschinensucher von Hand wieder aktiviert: Das ist eine Ansage,
            // es soll online bleiben. Nicht wieder pausieren, sondern loslassen.
            //
            // Nicht, wenn die Markierungssuche gerade unsicher ist: Dann
            // fehlt die Markierung womoeglich nur scheinbar.
            $vonHandAktiviert = $bekannt !== null
                && (string) $bekannt->zustand === Verknuepfung::AKTIV
                && (string) $bekannt->meldung === Entscheidung::GRUND_MARKIERUNG_ENTFERNT;
            if (!$markiert && !$markierungUnsicher && $bekannt !== null && (int) $bekannt->inseratId > 0
                && ((int) $bekannt->gesendetAm > 0 || (int) $bekannt->markiertGesehen > 0)
                && ($vonHandAktiviert || $this->einstellungen->freigeben($artikelId))) {
                if ($geschrieben >= self::SCHREIBGRENZE) {
                    $gebremst = true;
                    continue;
                }
                $geschrieben++;
                $wiederOnline = (string) $bekannt->zustand === Verknuepfung::PAUSIERT
                    && (float) $artikel['bestand'] > 0;
                if ($probelauf) {
                    $vorhaben[] = array(
                        'artikel' => $artikelId,
                        'inserat' => (int) $bekannt->inseratId,
                        'tat'     => 'freigeben',
                        'grund'   => $vonHandAktiviert
                            ? 'Von Hand wieder aktiviert: bleibt online und wird danach nicht mehr angefasst.'
                            : ($wiederOnline
                                ? 'Freigegeben: wird wieder aktiviert und danach nicht mehr angefasst.'
                                : 'Freigegeben: wird danach nicht mehr angefasst.'),
                    );
                    continue;
                }
                if ($wiederOnline) {
                    $antwort = $this->api->aktivieren((int) $bekannt->inseratId);
                    if (!Antwort::istOk($antwort)) {
                        $gescheitert[] = array('artikel' => $artikelId, 'grund' => 'Freigeben/Aktivieren: ' . $antwort['meldung']);
                        continue;
                    }
                    $bekannt->zustand = Verknuepfung::AKTIV;
                }
                $bekannt->gesendetAm = 0;
                $bekannt->markiertGesehen = 0;
                $bekannt->perApi = 0;
                $bekannt->fingerabdruck = '';
                $bekannt->meldung = $vonHandAktiviert
                    ? 'Von Hand wieder aktiviert - wird vom Plugin nicht mehr verwaltet.'
                    : 'Freigegeben - wird vom Plugin nicht mehr verwaltet.';
                $this->zuordnung->speichern($bekannt);
                $freigegebenListe[] = array(
                    'artikel'    => $artikelId,
                    'inserat'    => (int) $bekannt->inseratId,
                    'aktiviert'  => $wiederOnline,
                    'vonHand'    => $vonHandAktiviert,
                );
                continue;
            }

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
                'uebernommen'        => $bekannt !== null && (int) $bekannt->markiertGesehen > 0,
                'aenderungVersuchen' => $bekannt !== null && (int) $bekannt->perApi !== 1
                    && $this->einstellungen->altInserateAendern($artikelId),
                // Angelegt, aber die ID kam nicht an. Nicht noch einmal
                // anlegen — die Bestandsaufnahme findet das Inserat ueber
                // seine Referenz und traegt die ID nach.
                'angelegtOhneId'     => $bekannt !== null && (int) $bekannt->inseratId <= 0
                    && (int) $bekannt->gesendetAm > 0,
                // Verschickt (Warenbestand 0): loeschen - ausser es ist
                // abgeschaltet oder Maschinensucher hat es schon abgelehnt.
                'warenbestand'       => $artikel['warenbestand'],
                'loeschen'           => $versandLoeschen
                    && ($bekannt === null || (int) $bekannt->loeschenAbgelehnt <= 0),
                'geloescht'          => $bekannt !== null && (int) $bekannt->inseratId <= 0
                    && (string) $bekannt->zustand === Verknuepfung::GELOESCHT,
            ));

            $tat = $entscheidung['tat'];
            if ($markierungUnsicher && !$markiert && $tat === Entscheidung::PAUSIEREN) {
                $tat = Entscheidung::NICHTS;
            }

            // Einmal markiert gesehen: Ab jetzt nimmt eine entfernte
            // Markierung das Inserat vom Markt. Nicht im Probelauf - der
            // aendert an der Zuordnung nichts.
            if (!$probelauf && $markiert && $bekannt !== null && (int) $bekannt->inseratId > 0
                && (int) $bekannt->markiertGesehen <= 0) {
                $bekannt->markiertGesehen = time();
                $this->zuordnung->speichern($bekannt);
            }

            // Laeuft bald ab? Vormerken - verlaengert wird nach der Schleife,
            // wenn Pausieren und Loeschen schon durch sind.
            if ($bekannt !== null && (int) $bekannt->inseratId > 0
                && $tat !== Entscheidung::PAUSIEREN && $tat !== Entscheidung::LOESCHEN
                && Laufzeit::verlaengern((int) $bekannt->laeuftBis, $jetzt, $verlaengernTage, $markiert, (float) $artikel['bestand'])) {
                $faellig[(int) $bekannt->inseratId] = array('artikel' => $artikelId, 'zeile' => $bekannt);
            }

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
                    // netto (verkauft = 0) und Warenbestand (verschickt = 0);
                    // null heisst: nicht lesbar, dann wird nie geloescht.
                    'bestand' => $artikel['bestand'],
                    'warenbestand' => $artikel['warenbestand'],
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

            $ergebnis = $this->ausfuehren($tat, $artikel, $gebaut, $bekannt, $umgebung, $neuerAbdruck, $entscheidung['grund'], $bildAdressen);
            $geschrieben++;

            if (!$ergebnis['ok']) {
                $gescheitert[] = array('artikel' => $artikelId, 'grund' => $ergebnis['meldung']);
            } elseif ($tat === Entscheidung::LOESCHEN) {
                $geloeschtListe[] = array(
                    'artikel' => $artikelId,
                    'inserat' => $bekannt !== null ? (int) $ergebnis['inserat'] : 0,
                );
            }
        }

        // ---- Bericht: auf Maschinensucher, aber in Plenty nicht markiert -------
        $berichtTakt = $this->einstellungen->markierungsbericht();
        if (count($nurDiese) === 0 && $bestandVollstaendig && !$markierungUnsicher && $berichtTakt !== 'aus'
            && ($berichtTakt === 'jedesmal' || $this->zuordnung->markierungsberichtFaellig())) {
            $this->markierungsbericht($gefunden);
            $this->zuordnung->markierungsberichtMerken();
        }

        // ---- Verlaengern -----------------------------------------------------
        $verlaengert = array();
        if (count($faellig) > 0) {
            $monate = $this->einstellungen->verlaengernMonate();
            foreach ($faellig as $inseratId => $f) {
                if ($geschrieben >= self::SCHREIBGRENZE) {
                    $gebremst = true;
                    break;
                }
                $eintragV = array(
                    'artikel'  => $f['artikel'],
                    'inserat'  => $inseratId,
                    'restTage' => Laufzeit::restTage((int) $f['zeile']->laeuftBis, $jetzt),
                    'monate'   => $monate,
                );
                $geschrieben++;
                if ($probelauf) {
                    $eintragV['tat'] = 'verlaengern';
                    $vorhaben[] = $eintragV;
                    continue;
                }
                $antwort = $this->api->verlaengern($inseratId, $monate);
                if (Antwort::istOk($antwort)) {
                    // Vorlaeufig; die naechste Bestandsaufnahme traegt das
                    // genaue Datum von drueben ein.
                    $f['zeile']->laeuftBis = $jetzt + $monate * 30 * Laufzeit::TAG;
                    $this->zuordnung->speichern($f['zeile']);
                    $verlaengert[] = $eintragV;
                } else {
                    $gescheitert[] = array('artikel' => $f['artikel'], 'grund' => 'Verlaengern fehlgeschlagen: ' . $antwort['meldung']);
                }
            }
        }
        if (count($verlaengert) > 0) {
            $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.verlaengert', array_slice($verlaengert, 0, 50));
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
            'geloescht'   => $zaehler[Entscheidung::LOESCHEN],
            'freigegeben' => count($freigegebenListe),
            'verlaengert' => $probelauf ? count($faellig) : count($verlaengert),
            'unveraendert' => $zaehler[Entscheidung::NICHTS],
            'zurueck'     => $zaehler[Entscheidung::ZURUECK],
            'gebremst'    => $gebremst,
            'markiert'    => $markiertJetzt,
            'markierungUnsicher' => $markierungUnsicher,
            'dauer'       => round(microtime(true) - $beginn, 1),
        );
        if (count($rubrikMeldungen) > 0) {
            // Artikel ohne lesbare Rubrik-Eigenschaft: Sie gehen mit der
            // Rubrik des bestehenden Inserats bzw. der Auffangrubrik raus.
            $bericht['ohneRubrik'] = $rubrikMeldungen;
        }

        $this->getLogger(__METHOD__)->info(
            $probelauf ? 'MaschinensucherMarkt::log.probelauf' : 'MaschinensucherMarkt::log.abgeglichen',
            $bericht
        );

        if ($probelauf && count($vorhaben) > 0) {
            // Genau diese Liste ist der Sinn des Probelaufs: Sie zeigt
            // Artikel fuer Artikel, was beim Umschalten passieren wuerde.
            $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.vorhaben', array_slice($vorhaben, 0, 50));
        }

        if (count($freigegebenListe) > 0) {
            $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.freigegeben', array_slice($freigegebenListe, 0, 100));
        }
        if (count($geloeschtListe) > 0) {
            $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.geloescht', array_slice($geloeschtListe, 0, 50));
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
    private function ausfuehren($tat, array $artikel, array $gebaut, $bekannt, array $umgebung, $neuerAbdruck, $grund, $bildAdressen = null)
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

        if ($tat === Entscheidung::LOESCHEN) {
            return $this->loeschen($bekannt, $inseratId, $grund);
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
        $namen = $this->bilder->hochladen((int) $artikel['itemId'], $bekannt, $bildAdressen);
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

        $vorgefunden = $bekannt !== null && (int) $bekannt->perApi !== 1;
        $antwort = $this->api->aendern($inseratId, $koerper);
        if (Antwort::istOk($antwort)) {
            if ($vorgefunden) {
                // Maschinensucher hat die Aenderung eines vorgefundenen
                // Inserats angenommen. Ab jetzt gilt es als aenderbar.
                $bekannt->perApi = 1;
                $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.altInseratGeaendert', array(
                    'artikel' => (int) $artikel['itemId'],
                    'inserat' => (int) $inseratId,
                ));
            }
            $this->merken($bekannt, null, $neuerAbdruck, time(), '');
            return array('ok' => true, 'meldung' => '');
        }
        if ($vorgefunden && $antwort['art'] === Antwort::ABGELEHNT) {
            // Abgelehnt: den neuen Stand trotzdem als "gesehen" merken, sonst
            // versucht es jeder Lauf erneut. Erst eine weitere Aenderung am
            // Artikel loest den naechsten Versuch aus.
            $meldung = 'Aendern eines vorgefundenen Inserats abgelehnt: ' . $antwort['meldung'];
            $this->merken($bekannt, null, $neuerAbdruck, null, $meldung);
            $this->getLogger(__METHOD__)->warning('MaschinensucherMarkt::log.altInseratAbgelehnt', array(
                'artikel' => (int) $artikel['itemId'],
                'inserat' => (int) $inseratId,
                'meldung' => $antwort['meldung'],
            ));
            return array('ok' => false, 'meldung' => $meldung);
        }
        return $this->fehlschlag($bekannt, $antwort, 'Aendern');
    }

    /**
     * Verschickt: das Inserat loeschen.
     *
     * Die Zeile bleibt stehen, ohne Inserats-ID und als "geloescht". So
     * weiss der naechste Lauf, warum der (noch markierte) Artikel kein
     * Inserat hat, und fuehrt ihn nicht unter "nicht uebertragen". Kommt
     * wieder Ware, wird neu angelegt.
     *
     * Lehnt Maschinensucher das Loeschen ab (etwa bei Inseraten von vor dem
     * Plugin), wird stattdessen pausiert und nicht jeden Lauf neu versucht.
     */
    private function loeschen($bekannt, $inseratId, $grund)
    {
        $antwort = $this->api->loeschen($inseratId);
        if (Antwort::istOk($antwort) || $antwort['art'] === Antwort::FEHLT) {
            $bekannt->inseratId = 0;
            $bekannt->zustand = Verknuepfung::GELOESCHT;
            // Sonst hielte der Abgleich die Zeile fuer "angelegt, ID unbekannt".
            $bekannt->gesendetAm = 0;
            $bekannt->fingerabdruck = '';
            $bekannt->perApi = 0;
            $bekannt->meldung = 'Inserat ' . (int) $inseratId . ' geloescht: ' . $grund;
            $this->zuordnung->speichern($bekannt);
            return array('ok' => true, 'meldung' => '', 'inserat' => (int) $inseratId);
        }

        if ($antwort['art'] !== Antwort::ABGELEHNT) {
            // Netz, Zeitlimit, Serverfehler: naechster Lauf versucht es wieder.
            return $this->fehlschlag($bekannt, $antwort, 'Loeschen');
        }

        $bekannt->loeschenAbgelehnt = time();
        $meldung = 'Loeschen abgelehnt: ' . $antwort['meldung'];
        $this->getLogger(__METHOD__)->warning('MaschinensucherMarkt::log.loeschenAbgelehnt', array(
            'artikel' => (int) $bekannt->artikelId,
            'inserat' => (int) $inseratId,
            'meldung' => $antwort['meldung'],
        ));
        if ((string) $bekannt->zustand !== Verknuepfung::PAUSIERT) {
            $pause = $this->api->pausieren($inseratId);
            if (Antwort::istOk($pause)) {
                $bekannt->zustand = Verknuepfung::PAUSIERT;
                $meldung .= ' - stattdessen pausiert.';
            }
        }
        $this->merken($bekannt, null, null, null, $meldung);
        return array('ok' => false, 'meldung' => $meldung);
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
     * das Plugin verwaltet oder schon einmal markiert gesehen hat, deren
     * Markierung aber inzwischen fehlt.
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
            $uebernommen = (int) $zeile->gesendetAm > 0 || (int) $zeile->markiertGesehen > 0;
            if ($artikelId > 0 && $uebernommen && !isset($gesehen[$artikelId])) {
                $verwaltetOhneMarkierung[] = $artikelId;
            }
        }
        foreach ($this->suche->nachArtikelIds($verwaltetOhneMarkierung) as $dokument) {
            $variante = Suchdokument::alsVariante((array) $dokument);
            $eintraege[] = array(
                'variante' => $variante,
                // Zweite Meinung: Traegt das Dokument die Markierung doch,
                // hat die Markierungssuche den Artikel nur verpasst (etwa
                // waehrend Plenty den Suchindex neu aufbaut). Dann gilt er
                // als markiert und wird NICHT pausiert.
                'markiert' => Artikelabbildung::istMarkiert($variante, $flagId, $flagFeld),
                'dokument' => (array) $dokument,
            );
        }

        return $eintraege;
    }

    /**
     * Artikel-IDs, deren Varianten den Tag "Preis auf Anfrage" tragen. Eine
     * Suche je Lauf; scheitert sie, gehen die Preise wie bisher raus.
     *
     * @return array artikelId => true
     */
    private function preisAufAnfrage(array $nurDiese)
    {
        $tagId = $this->einstellungen->preisAufAnfrageTag();
        $heraus = array();
        if ($tagId <= 0) {
            return $heraus;
        }
        try {
            foreach ($this->suche->mitTag($tagId, $nurDiese) as $dokument) {
                $heraus[(int) Suchdokument::alsVariante((array) $dokument)['itemId']] = true;
            }
        } catch (\Throwable $e) {
            $this->getLogger(__METHOD__)->warning('MaschinensucherMarkt::log.tagNichtLesbar', array(
                'tag'     => $tagId,
                'meldung' => $e->getMessage(),
            ));
        }
        return $heraus;
    }

    /**
     * Welche Inserate bei Maschinensucher gehoeren zu Artikeln, die in Plenty
     * (noch) nicht markiert sind?
     *
     * Grundlage ist die vollstaendige Bestandsaufnahme ueber die API - nicht
     * die Inseratverwaltung im Browser, deren Seiten sich beim Blaettern
     * verschieben. Die Artikel-IDs kommen in Bloecken zu 100, kommagetrennt,
     * zum Einfuegen in die Plenty-Artikelsuche.
     */
    private function markierungsbericht(array $gefunden)
    {
        $markiert = array();
        foreach ($gefunden as $eintrag) {
            if ($eintrag['markiert']) {
                $markiert[(int) $eintrag['variante']['itemId']] = true;
            }
        }

        $inserate = 0;
        $fehlend = array();
        $ohneArtikelId = array();
        foreach ($this->zuordnung->alle() as $zeile) {
            if ((int) $zeile->inseratId <= 0) {
                continue;
            }
            $inserate++;
            $artikelId = (int) $zeile->artikelId;
            if ($artikelId <= 0) {
                if (count($ohneArtikelId) < 50) {
                    $ohneArtikelId[] = array('inserat' => (int) $zeile->inseratId, 'referenz' => (string) $zeile->internalId);
                }
                continue;
            }
            if (!isset($markiert[$artikelId])) {
                $fehlend[$artikelId] = true;
            }
        }

        // Gibt es diese Artikel in Plenty ueberhaupt noch?
        $fehlendIds = array_keys($fehlend);
        sort($fehlendIds);
        $vorhanden = array();
        if (count($fehlendIds) > 0) {
            foreach ($this->suche->nachArtikelIds($fehlendIds) as $dokument) {
                $vorhanden[(int) Suchdokument::alsVariante((array) $dokument)['itemId']] = true;
            }
        }
        $markieren = array();
        $nichtInPlenty = array();
        foreach ($fehlendIds as $id) {
            if (isset($vorhanden[$id])) {
                $markieren[] = $id;
            } else {
                $nichtInPlenty[] = $id;
            }
        }

        $bloecke = array();
        foreach (array_chunk($markieren, 100) as $block) {
            $bloecke[] = implode(',', $block);
        }

        $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.markierungFehlt', array(
            'inserateBeiMaschinensucher' => $inserate,
            'markierteArtikelInPlenty'   => count($markiert),
            'zuMarkieren'                => count($markieren),
            'artikelIdsZumMarkieren'     => $bloecke,
            'nichtInPlenty'              => implode(',', $nichtInPlenty),
            'ohneArtikelId'              => $ohneArtikelId,
        ));
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
