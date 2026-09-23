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
     * @return array Bericht
     */
    public function lauf()
    {
        $beginn = microtime(true);

        if (!$this->einstellungen->apiEingerichtet()) {
            return $this->abbruch('Es ist kein API-Token hinterlegt.');
        }

        $praefix = $this->einstellungen->nummernPraefix();

        $gelesen = array();
        for ($seite = 1; $seite <= self::MAX_SEITEN; $seite++) {
            $antwort = $this->api->alleInserate($seite);

            if (!Antwort::istOk($antwort)) {
                // Mitten im Lesen abzubrechen ist richtig: Eine halbe Liste
                // saehe aus wie "diese Inserate gibt es nicht mehr", und
                // genau daraus duerfen nie Schluesse gezogen werden.
                return $this->abbruch(
                    'Seite ' . $seite . ' konnte nicht gelesen werden: ' . $antwort['meldung'],
                    count($gelesen)
                );
            }

            $seiteninhalt = Bestandsabgleich::seiteLesen($antwort['daten'], $praefix);
            foreach ($seiteninhalt as $eintrag) {
                $gelesen[] = $eintrag;
            }

            if (!Bestandsabgleich::weitereSeite($antwort['daten'], $seite) || count($seiteninhalt) === 0) {
                break;
            }
        }

        $bilanz = Bestandsabgleich::bilanz($gelesen);
        $geschrieben = $this->fortschreiben($gelesen);

        // Erst jetzt, mit allen Zuordnungen in der Tabelle, darf der Abgleich
        // schreiben. Bricht der Lauf vorher ab, fehlt dieser Merker, und der
        // naechste Lauf faengt die Aufnahme von vorn an.
        $this->zuordnung->bestandGelesenMerken();

        $bericht = array(
            'ok'              => true,
            'gelesen'         => $bilanz['gesamt'],
            'zugeordnet'      => $bilanz['zugeordnet'],
            'ohneZuordnung'   => $bilanz['ohneZuordnung'],
            'aktiv'           => $bilanz['aktiv'],
            'pausiert'        => $bilanz['pausiert'],
            'neu'             => $geschrieben['neu'],
            'aktualisiert'    => $geschrieben['aktualisiert'],
            'doppelteArtikel' => $bilanz['doppelteArtikel'],
            'dauer'           => round(microtime(true) - $beginn, 1),
        );

        $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.bestandGelesen', $bericht);

        if (count($bilanz['doppelteArtikel']) > 0) {
            $this->getLogger(__METHOD__)->warning('MaschinensucherMarkt::log.doppelteInserate', array(
                'artikel' => array_slice($bilanz['doppelteArtikel'], 0, 50),
            ));
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
        foreach ($this->zuordnung->alle() as $zeile) {
            $bekannt[(int) $zeile->inseratId] = $zeile;
        }

        foreach ($inserate as $inserat) {
            $inseratId = (int) $inserat['inseratId'];
            $artikelId = (int) $inserat['artikelId'];
            $zustand = $this->zustand($inserat['zustand']);

            if (isset($bekannt[$inseratId])) {
                $zeile = $bekannt[$inseratId];

                // Nur schreiben, was sich geaendert hat. Sonst speichert jeder
                // Lauf alle Zeilen neu — bei sechshundert Inseraten der
                // teuerste Teil des ganzen Laufs, fuer nichts.
                $unveraendert = (string) $zeile->internalId === (string) $inserat['internalId']
                    && (int) $zeile->kategorieId === (int) $inserat['kategorieId']
                    && (string) $zeile->zustand === $zustand
                    && ($artikelId <= 0 || (int) $zeile->artikelId === $artikelId);
                if ($unveraendert) {
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
