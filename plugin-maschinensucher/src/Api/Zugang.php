<?php

namespace MaschinensucherMarkt\Api;

use MaschinensucherMarkt\Logik\Antwort;
use MaschinensucherMarkt\Services\Einstellungen;
use Plenty\Modules\Plugin\Libs\Contracts\LibraryCallContract;
use Plenty\Plugin\Log\Loggable;

/**
 * Die Maschinensucher-API, ein Aufruf je Methode.
 *
 * Jede Methode gibt zurueck, was Antwort::lesen() daraus macht — nie eine
 * rohe HTTP-Antwort und nie eine Ausnahme. Aufrufer entscheiden anhand von
 * 'art', was zu tun ist.
 */
class Zugang
{
    use Loggable;

    const BASIS = 'https://api.machineseeker.com';

    /** @var LibraryCallContract */
    private $ruf;

    /** @var Einstellungen */
    private $einstellungen;

    public function __construct(LibraryCallContract $ruf, Einstellungen $einstellungen)
    {
        $this->ruf = $ruf;
        $this->einstellungen = $einstellungen;
    }

    // ---- Nachschlagewerke ------------------------------------------------

    /**
     * Der Rubrikbaum. Gibt die gueltigen categoryId zurueck.
     */
    public function kategoriebaum($sprache = 'de-de')
    {
        return $this->anfragen('GET', 'json/category/tree', null, array(), 60, $sprache);
    }

    public function produktarten($kategorieId = null)
    {
        $abfrage = array();
        if ($kategorieId !== null && (int) $kategorieId > 0) {
            $abfrage['categoryId'] = (int) $kategorieId;
        }
        return $this->anfragen('GET', 'json/product/types', null, $abfrage);
    }

    public function produktmerkmale($produktart = '')
    {
        $abfrage = array();
        if ((string) $produktart !== '') {
            $abfrage['productType'] = (string) $produktart;
        }
        return $this->anfragen('GET', 'json/product/properties', null, $abfrage);
    }

    // ---- Inserate lesen ---------------------------------------------------

    /**
     * Eine Seite der eigenen Inserate. Die Grundlage fuer die Zuordnung zum
     * Plenty-Artikelstamm: Jeder Eintrag traegt id, internalId und categoryId.
     */
    public function alleInserate($seite = 1)
    {
        return $this->anfragen('GET', 'json/listing/all', null, array('page' => max(1, (int) $seite)));
    }

    /**
     * Steht drueben ueberhaupt schon etwas?
     *
     * Ein Aufruf, eine Zahl. Er entscheidet, ob ein Konto leer ist — und
     * damit, ob ohne Zuordnung geschrieben werden darf. Im Zweifel, also
     * wenn die Frage nicht beantwortet werden kann, lautet die Antwort JA:
     * Dann wird lieber nicht geschrieben.
     */
    public function hatInserate()
    {
        $antwort = $this->alleInserate(1);
        if (!Antwort::istOk($antwort)) {
            return true;
        }
        $daten = $antwort['daten'];
        if (isset($daten['totalListingCount'])) {
            return (int) $daten['totalListingCount'] > 0;
        }
        return isset($daten['listings']) && count((array) $daten['listings']) > 0;
    }

    public function inserat($id)
    {
        return $this->anfragen('GET', 'json/listing', null, array('id' => (int) $id));
    }

    // ---- Inserate schreiben -----------------------------------------------

    public function anlegen(array $inserat)
    {
        return $this->anfragen('POST', 'json/listing', $inserat);
    }

    /**
     * Aendern. Die Plattform-ID gehoert in den Koerper, nicht in die Adresse.
     */
    public function aendern($id, array $inserat)
    {
        $inserat['id'] = (int) $id;
        return $this->anfragen('PUT', 'json/listing', $inserat);
    }

    public function loeschen($id)
    {
        return $this->anfragen('DELETE', 'json/listing', array('id' => (int) $id));
    }

    // ---- Schalten ----------------------------------------------------------

    /**
     * Offline nehmen, ohne es zu verlieren: Laufzeit, Aufrufe und Anfragen
     * bleiben erhalten, und ein aktivieren() holt es unveraendert zurueck.
     * Deshalb wird bei fehlendem Bestand pausiert und nicht geloescht.
     */
    public function pausieren($id)
    {
        return $this->anfragen('POST', 'json/listing/pause', array('id' => (int) $id));
    }

    public function aktivieren($id)
    {
        return $this->anfragen('POST', 'json/listing/activate', array('id' => (int) $id));
    }

    public function verlaengern($id, $monate)
    {
        return $this->anfragen('POST', 'json/listing/extend', array(
            'id' => (int) $id,
            'extendMonths' => max(1, min(12, (int) $monate)),
        ));
    }

    // ---- Dateien ------------------------------------------------------------

    /**
     * Ein Bild, base64-kodiert. Muss VOR dem Inserat hochgeladen werden; die
     * Antwort liefert einen vorlaeufigen Namen, den das Inserat referenziert.
     */
    public function bildHochladen($dateiname, $base64)
    {
        return $this->anfragen('POST', 'json/listing-asset/image', array(
            'name' => (string) $dateiname,
            'data' => (string) $base64,
        ), array(), 120);
    }

    // ---- Unterbau -------------------------------------------------------------

    private function anfragen($methode, $pfad, $koerper = null, array $abfrage = array(), $zeitlimit = 60, $sprache = '')
    {
        $daten = array(
            'basis'     => self::BASIS,
            'pfad'      => $pfad,
            'methode'   => $methode,
            'token'     => $this->einstellungen->apiToken(),
            'abfrage'   => $abfrage,
            'zeitlimit' => $zeitlimit,
            'sprache'   => (string) $sprache,
        );
        if ($koerper !== null) {
            $daten['koerper'] = $koerper;
        }

        try {
            $roh = $this->ruf->call('MaschinensucherMarkt::ruf', $daten);
        } catch (\Throwable $e) {
            // Selbst wenn der Bibliotheksaufruf selbst scheitert, soll der
            // Aufrufer dieselbe Form bekommen wie sonst.
            $roh = array('status' => 0, 'daten' => array(), 'roh' => '', 'fehler' => $e->getMessage());
        }

        $gelesen = Antwort::lesen(is_array($roh) ? $roh : array());


        if ($gelesen['art'] !== Antwort::OK) {
            $this->getLogger(__METHOD__)->warning('MaschinensucherMarkt::log.apiFehler', array(
                'methode' => $methode,
                'pfad'    => $pfad,
                'art'     => $gelesen['art'],
                'meldung' => $gelesen['meldung'],
            ));
        }

        return $gelesen;
    }
}
