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
    public function hochladen($itemId, $bekannt = null)
    {
        $adressen = $this->adressen((int) $itemId);
        if (count($adressen) === 0) {
            return array();
        }

        $namen = array();
        foreach ($adressen as $stelle => $adresse) {
            $inhalt = $this->laden($adresse);
            if ($inhalt === null) {
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

        foreach ((array) $roh as $bild) {
            $bild = (array) $bild;
            $adresse = '';
            foreach (array('urlMiddle', 'urlPreview', 'url', 'path') as $schluessel) {
                if (isset($bild[$schluessel]) && trim((string) $bild[$schluessel]) !== '') {
                    $adresse = trim((string) $bild[$schluessel]);
                    break;
                }
            }
            if ($adresse === '') {
                continue;
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
        try {
            $roh = $this->ruf->call('MaschinensucherMarkt::holen', array('url' => $adresse));
        } catch (\Throwable $e) {
            return null;
        }

        if (!is_array($roh) || !isset($roh['base64']) || $roh['base64'] === '') {
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
}
