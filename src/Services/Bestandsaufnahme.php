<?php

namespace MaschinensucherMarkt\Services;

use MaschinensucherMarkt\Api\Zugang;
use MaschinensucherMarkt\Logik\Antwort;
use MaschinensucherMarkt\Logik\Bestandsabgleich;
use MaschinensucherMarkt\Models\Verknuepfung;
use Plenty\Plugin\Log\Loggable;

/**
 * Liest alle Inserate bei Maschinensucher und legt die Zuordnung an.
 *
 * Das ist der Schritt, der vor allem anderen kommt — und der einzige, der
 * den bestehenden Bestand rettet. Ohne ihn kennt das Plugin keine einzige
 * Inserats-ID und wuerde zu jeder Maschine, die es dort laengst gibt, eine
 * zweite anlegen.
 *
 * Er ist absichtlich SCHREIBFAUL: Er legt Zuordnungen an und schreibt fort,
 * was drueben steht. Er loescht nichts und aendert drueben nichts. Man kann
 * ihn beliebig oft laufen lassen.
 */
class Bestandsaufnahme
{
    use Loggable;

    /** Reissleine: mehr Seiten holt niemand versehentlich. */
    const MAX_SEITEN = 200;

    /** @var Zugang */
    private $api;

    /** @var Zuordnung */
    private $zuordnung;

    /** @var Einstellungen */
    private $einstellungen;

    public function __construct(Zugang $api, Zuordnung $zuordnung, Einstellungen $einstellungen)
    {
        $this->api = $api;
        $this->zuordnung = $zuordnung;
        $this->einstellungen = $einstellungen;
    }

    /**
     * Eine Etappe der Bestandsaufnahme.
     *
     * WARUM IN ETAPPEN: Die Aufnahme liest alle Inserate bei Maschinensucher,
     * seitenweise, und schreibt je Inserat eine Zuordnung. Beim ersten Mal
     * sind das bei diesem Konto sieben Aufrufe mit vollen Inseratsdaten und
     * sechshundert Schreibvorgaenge. Im Flow laeuft das als gewoehnliche
     * Anfrage — und die wurde am 23.09. mittendrin abgebrochen, ohne jede
     * Spur im Protokoll: Einen harten Abbruch an einer Zeitgrenze kann kein
     * Fangnetz auffangen.
     *
     * Deshalb arbeitet jede Etappe nur so viele Seiten ab, wie in das
     * Zeitbudget passen, und merkt sich nach JEDER Seite, wo es weitergeht.
     * Wird sie trotzdem abgebrochen, ist hoechstens eine Seite verloren und
     * wird beim naechsten Mal wiederholt. Erst wenn die letzte Seite
     * geschrieben ist, gilt die Aufnahme als vollstaendig.
     *
     * @param float $budget Sekunden, nach denen keine neue Seite mehr begonnen wird
     * @return array Bericht
     */
    public function etappe($budget)
    {
        $beginn = microtime(true);

        if (!$this->einstellungen->apiEingerichtet()) {
            return $this->abbruch('Es ist kein API-Token hinterlegt.');
        }

        $praefix = $this->einstellungen->nummernPraefix();
        $seite = $this->zuordnung->naechsteSeite();
        $ersteSeite = $seite;
        $gesamtSeiten = 0;
        $gelesen = 0;
        $neu = 0;
        $aktualisiert = 0;
        $fertig = false;

        while (true) {
            $antwort = $this->api->alleInserate($seite);

            if (!Antwort::istOk($antwort)) {
                // Der Merker bleibt auf dieser Seite stehen; die naechste
                // Etappe versucht es erneut. Aus einer halb gelesenen Liste
                // wird nie geschlossen, ein Inserat gebe es nicht mehr.
                return $this->abbruch(
                    'Seite ' . $seite . ' konnte nicht gelesen werden: ' . $antwort['meldung'],
                    $gelesen
                );
            }

            $daten = $antwort['daten'];
            $gesamtSeiten = isset($daten['totalPageNumber']) ? (int) $daten['totalPageNumber'] : $gesamtSeiten;

            $inhalt = Bestandsabgleich::seiteLesen($daten, $praefix);
            $geschrieben = $this->fortschreiben($inhalt);
            $gelesen += count($inhalt);
            $neu += $geschrieben['neu'];
            $aktualisiert += $geschrieben['aktualisiert'];

            if (!Bestandsabgleich::weitereSeite($daten, $seite) || count($inhalt) === 0 || $seite >= self::MAX_SEITEN) {
                $fertig = true;
                break;
            }

            $seite++;
            // Nach jeder Seite festhalten. Stirbt die Etappe jetzt, geht es
            // genau hier weiter.
            $this->zuordnung->naechsteSeiteMerken($seite);

            if (microtime(true) - $beginn >= (float) $budget) {
                break;
            }
        }

        if ($fertig) {
            // Erst jetzt, mit allen Zuordnungen in der Tabelle, darf der
            // Abgleich schreiben. Die naechste Runde beginnt wieder vorn und
            // haelt die Zuordnung aktuell.
            $this->zuordnung->bestandGelesenMerken();
            $this->zuordnung->naechsteSeiteMerken(1);
        }

        $bericht = array(
            'ok'           => true,
            'vollstaendig' => $fertig,
            'seiten'       => $ersteSeite . ' bis ' . $seite . ($gesamtSeiten > 0 ? ' von ' . $gesamtSeiten : ''),
            'gelesen'      => $gelesen,
            'neu'          => $neu,
            'aktualisiert' => $aktualisiert,
            'dauer'        => round(microtime(true) - $beginn, 1),
        );

        if ($fertig) {
            $bilanz = $this->zuordnung->bilanz();
            $bericht['inserateGesamt'] = $bilanz['gesamt'];
            $bericht['zugeordnet'] = $bilanz['zugeordnet'];
            $bericht['ohneZuordnung'] = $bilanz['ohneZuordnung'];
            $bericht['aktiv'] = $bilanz['aktiv'];
            $bericht['pausiert'] = $bilanz['pausiert'];

            $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.bestandGelesen', $bericht);

            if (count($bilanz['doppelteArtikel']) > 0) {
                $this->getLogger(__METHOD__)->warning('MaschinensucherMarkt::log.doppelteInserate', array(
                    'artikel' => array_slice($bilanz['doppelteArtikel'], 0, 50),
                ));
            }
        } else {
            $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.bestandEtappe', $bericht);
        }

        return $bericht;
    }

    /**
     * Die gelesenen Inserate in die Zuordnungstabelle schreiben.
     *
     * Vorhandene Zeilen werden fortgeschrieben, nicht ersetzt: Was das
     * Plugin selbst ueber ein Inserat weiss — wann es zuletzt gesendet hat,
     * welchen Inhalt — soll eine Bestandsaufnahme nicht wegwischen.
     */
    private function fortschreiben(array $inserate)
    {
        $jetzt = time();
        $neu = 0;
        $aktualisiert = 0;

        $bekannt = array();
        // Zeilen, die der Abgleich nach dem Anlegen ohne ID gespeichert hat.
        // Das zugehoerige Inserat taucht hier ueber seine Referenz auf; es
        // bekommt diese Zeile, statt dass eine zweite danebengestellt wird.
        $ohneId = array();
        foreach ($this->zuordnung->alle() as $zeile) {
            if ((int) $zeile->inseratId > 0) {
                $bekannt[(int) $zeile->inseratId] = $zeile;
            } elseif ((int) $zeile->artikelId > 0) {
                $ohneId[(int) $zeile->artikelId] = $zeile;
            }
        }

        foreach ($inserate as $inserat) {
            $inseratId = (int) $inserat['inseratId'];
            $artikelId = (int) $inserat['artikelId'];
            $zustand = $this->zustand($inserat['zustand']);
            $waise = ($artikelId > 0 && isset($ohneId[$artikelId])) ? $ohneId[$artikelId] : null;

            if ($waise !== null && !isset($bekannt[$inseratId])) {
                // Die ID nachtragen. Alles, was der Abgleich beim Anlegen
                // festgehalten hat — perApi, gesendetAm, Fingerabdruck —
                // bleibt so erhalten.
                $zeile = $waise;
                $zeile->inseratId = $inseratId;
                unset($ohneId[$artikelId]);
                $bekannt[$inseratId] = $zeile;
                $aktualisiert++;
            } elseif (isset($bekannt[$inseratId])) {
                $zeile = $bekannt[$inseratId];

                if ($waise !== null) {
                    // Beide gibt es schon (so am 24.09. passiert): Was die
                    // Zeile ohne ID weiss, geht auf die richtige ueber, dann
                    // verschwindet sie.
                    $this->uebernehmen($zeile, $waise);
                    $this->zuordnung->entfernen($waise);
                    unset($ohneId[$artikelId]);
                } elseif ((string) $zeile->internalId === (string) $inserat['internalId']
                    && (int) $zeile->kategorieId === (int) $inserat['kategorieId']
                    && (string) $zeile->zustand === $zustand
                    && ($artikelId <= 0 || (int) $zeile->artikelId === $artikelId)) {
                    // Nur schreiben, was sich geaendert hat. Sonst speichert
                    // jeder Lauf alle Zeilen neu — bei sechshundert Inseraten
                    // der teuerste Teil des ganzen Laufs, fuer nichts.
                    continue;
                }
                $aktualisiert++;
            } else {
                $zeile = $this->zuordnung->neu();
                $zeile->inseratId = $inseratId;
                $neu++;
            }

            $zeile->internalId = (string) $inserat['internalId'];
            $zeile->kategorieId = (int) $inserat['kategorieId'];
            $zeile->zustand = $zustand;
            $zeile->gesehenAm = $jetzt;

            // Die Artikel-ID nur setzen, wenn sie ableitbar war. Eine einmal
            // gefundene Zuordnung durch eine 0 zu ersetzen waere ein
            // Rueckschritt — etwa wenn jemand drueben die Referenz loescht.
            if ($artikelId > 0) {
                $zeile->artikelId = $artikelId;
            }

            $this->zuordnung->speichern($zeile);
        }

        return array('neu' => $neu, 'aktualisiert' => $aktualisiert);
    }

    /**
     * Was der Abgleich beim Anlegen wusste, auf die gefundene Zeile uebertragen.
     */
    private function uebernehmen(Verknuepfung $ziel, Verknuepfung $quelle)
    {
        if ((int) $quelle->perApi === 1) {
            $ziel->perApi = 1;
        }
        if ((int) $quelle->gesendetAm > (int) $ziel->gesendetAm) {
            $ziel->gesendetAm = (int) $quelle->gesendetAm;
            $ziel->fingerabdruck = (string) $quelle->fingerabdruck;
        }
        if ((int) $ziel->variantenId <= 0 && (int) $quelle->variantenId > 0) {
            $ziel->variantenId = (int) $quelle->variantenId;
        }
    }

    private function zustand($gelesen)
    {
        if ($gelesen === Bestandsabgleich::AKTIV) {
            return Verknuepfung::AKTIV;
        }
        if ($gelesen === Bestandsabgleich::PAUSIERT) {
            return Verknuepfung::PAUSIERT;
        }
        return Verknuepfung::UNBEKANNT;
    }

    private function abbruch($meldung, $bisher = 0)
    {
        $this->getLogger(__METHOD__)->error('MaschinensucherMarkt::log.bestandNichtGelesen', array(
            'meldung' => $meldung,
            'bisher'  => $bisher,
        ));
        return array('ok' => false, 'meldung' => $meldung, 'gelesen' => $bisher);
    }
}
