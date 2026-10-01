<?php

namespace MaschinensucherMarkt\Services;

use MaschinensucherMarkt\Api\Zugang;
use MaschinensucherMarkt\Logik\Antwort;
use Plenty\Modules\Item\ItemImage\Contracts\ItemImageRepositoryContract;
use Plenty\Modules\Plugin\Libs\Contracts\LibraryCallContract;
use Plenty\Plugin\Log\Loggable;

/**
 * Bilder nach Maschinensucher bringen.
 *
 * Umstaendlicher als erwartet: Die API nimmt keine Adressen entgegen,
 * sondern den Bildinhalt selbst, base64-kodiert, ein Aufruf je Bild. Jedes
 * Bild muss also erst von Plentys Bildserver geholt, dann kodiert, dann
 * einzeln hochgeladen werden. Erst danach darf das Inserat die vorlaeufigen
 * Namen nennen, die dabei zurueckkommen.
 *
 * Weil das teuer ist, laeuft es nur fuer Artikel, die tatsaechlich
 * uebertragen werden — und nur, wenn sich an den Bildern etwas getan hat.
 */
class Bilder
{
    use Loggable;

    /** Die API nimmt hoechstens acht Bilder je Inserat sinnvoll an. */
    const HOECHSTENS = 8;

    /** @var ItemImageRepositoryContract */
    private $bilder;

    /** @var Zugang */
    private $api;

    /** @var LibraryCallContract */
    private $ruf;

    /** @var array Original-Adresse => kleinere Fassung als Ersatz */
    private $ersatz = array();

    /** @var string warum das letzte Bild nicht ladbar war */
    private $letzterFehler = '';

    public function __construct(
        ItemImageRepositoryContract $bilder,
        Zugang $api,
        LibraryCallContract $ruf
    ) {
        $this->bilder = $bilder;
        $this->api = $api;
        $this->ruf = $ruf;
    }

    /**
     * Laedt die Bilder eines Artikels hoch und gibt die vorlaeufigen Namen
     * zurueck, die ins Inserat gehoeren.
     *
     * Schlaegt ein einzelnes Bild fehl, geht es ohne dieses weiter. Ein
     * Inserat mit vier statt fuenf Fotos ist immer noch ein Inserat; eines,
     * das an einem kaputten Bild scheitert, ist keines.
     *
     * @return array
     */
    public function hochladen($itemId, $bekannt = null, $adressen = null)
    {
        if (!is_array($adressen)) {
            $adressen = $this->adressen((int) $itemId);
        }
        if (count($adressen) === 0) {
            return array();
        }

        $namen = array();
        foreach ($adressen as $stelle => $adresse) {
            $inhalt = $this->laden($adresse);
            if ($inhalt === null && isset($this->ersatz[$adresse])) {
                $inhalt = $this->laden($this->ersatz[$adresse]);
            }
            if ($inhalt === null) {
                $this->getLogger(__METHOD__)->warning('MaschinensucherMarkt::log.bildNichtLadbar', array(
                    'artikel' => (int) $itemId,
                    'adresse' => $adresse,
                    'meldung' => $this->letzterFehler,
                ));
                continue;
            }

            $antwort = $this->api->bildHochladen($this->dateiname($adresse, $stelle), $inhalt);
            if (!Antwort::istOk($antwort)) {
                $this->getLogger(__METHOD__)->warning('MaschinensucherMarkt::log.bildAbgelehnt', array(
                    'artikel' => (int) $itemId,
                    'adresse' => $adresse,
                    'meldung' => $antwort['meldung'],
                ));
                continue;
            }

            $name = isset($antwort['daten']['image']) ? (string) $antwort['daten']['image'] : '';
            if ($name !== '') {
                $namen[] = $name;
            }
        }

        return $namen;
    }

    /**
     * Die Bildadressen eines Artikels, hoechstens acht, in der in Plenty
     * gepflegten Reihenfolge.
     */
    public function adressen($itemId)
    {
        $adressen = array();

        try {
            $roh = $this->bilder->findByItemId((int) $itemId);
        } catch (\Throwable $e) {
            return array();
        }

        // Plenty liefert Modelle. Ein (array)-Cast darauf ergibt nur interne
        // Felder - keine Bildadresse, und der Artikel ging ohne Bilder raus
        // (01.10., Inserat A22859605). Deshalb toArray().
        $liste = array();
        foreach ((array) $roh as $bild) {
            $liste[] = $this->alsArray($bild);
        }
        usort($liste, function ($a, $b) {
            $pa = isset($a['position']) ? (int) $a['position'] : 0;
            $pb = isset($b['position']) ? (int) $b['position'] : 0;
            return $pa - $pb;
        });

        foreach ($liste as $bild) {
            $adresse = '';
            // Das Original fuer die beste Qualitaet; die mittlere Groesse als
            // Ersatz, falls das Original nicht ladbar oder zu gross ist.
            foreach (array('url', 'urlMiddle', 'urlPreview', 'path') as $schluessel) {
                if (isset($bild[$schluessel]) && trim((string) $bild[$schluessel]) !== '') {
                    $adresse = trim((string) $bild[$schluessel]);
                    break;
                }
            }
            if ($adresse === '') {
                continue;
            }
            if (isset($bild['urlMiddle']) && trim((string) $bild['urlMiddle']) !== '' && trim((string) $bild['urlMiddle']) !== $adresse) {
                $this->ersatz[$adresse] = trim((string) $bild['urlMiddle']);
            }
            $adressen[] = $adresse;
            if (count($adressen) >= self::HOECHSTENS) {
                break;
            }
        }

        return $adressen;
    }

    private function laden($adresse)
    {
        $this->letzterFehler = '';
        try {
            $roh = $this->ruf->call('MaschinensucherMarkt::holen', array('url' => $adresse));
        } catch (\Throwable $e) {
            $this->letzterFehler = $e->getMessage();
            return null;
        }

        if (!is_array($roh) || !isset($roh['base64']) || $roh['base64'] === '') {
            $this->letzterFehler = is_array($roh) && isset($roh['fehler']) ? (string) $roh['fehler'] : 'leere Antwort';
            return null;
        }

        return (string) $roh['base64'];
    }

    /**
     * Die API will einen Namen mit erlaubter Endung. Was auf dem Bildserver
     * steht, ist dafuer nicht immer brauchbar.
     */
    private function dateiname($adresse, $stelle)
    {
        $endung = 'jpg';
        $ohneAbfrage = (string) $adresse;
        $fragezeichen = strpos($ohneAbfrage, '?');
        if ($fragezeichen !== false) {
            $ohneAbfrage = substr($ohneAbfrage, 0, $fragezeichen);
        }
        if (preg_match('/\.(jpg|jpeg|png|bmp)$/i', $ohneAbfrage, $treffer) === 1) {
            $endung = strtolower($treffer[1]);
        }
        return 'bild-' . ((int) $stelle + 1) . '.' . $endung;
    }

    private function alsArray($bild)
    {
        if (is_array($bild)) {
            return $bild;
        }
        try {
            $arr = $bild->toArray();
            if (is_array($arr)) {
                return $arr;
            }
        } catch (\Throwable $e) {
        }
        try {
            return array(
                'urlMiddle'  => $bild->urlMiddle,
                'urlPreview' => $bild->urlPreview,
                'url'        => $bild->url,
                'position'   => $bild->position,
            );
        } catch (\Throwable $e) {
            return array();
        }
    }
}
