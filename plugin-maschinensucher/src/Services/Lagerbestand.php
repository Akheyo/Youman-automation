<?php

namespace MaschinensucherMarkt\Services;

use MaschinensucherMarkt\Logik\Artikelabbildung;
use Plenty\Modules\Item\VariationStock\Contracts\VariationStockRepositoryContract;
use Plenty\Plugin\Log\Loggable;

/**
 * Der Warenbestand (physisch) einer Variante, direkt aus dem Lager.
 *
 * Der Suchindex liefert nur den Netto-Bestand (28.09. im Live-System:
 * warenbestand war bei allen Artikeln null). Fuer die Frage "verschickt?"
 * braucht es den physischen - er wird deshalb nur fuer die Kandidaten
 * nachgelesen: markiert, Inserat vorhanden, netto 0. Ein paar Aufrufe je
 * Lauf, nicht der ganze Stamm.
 */
class Lagerbestand
{
    use Loggable;

    /** @var bool nur einmal je Lauf warnen */
    private $gewarnt = false;

    /** @var bool die erste Antwort einmal je Lauf ins Protokoll */
    private $gezeigt = false;

    /**
     * @return float|null null, wenn nicht lesbar - dann wird nie geloescht
     */
    public function warenbestand($variantenId)
    {
        $variantenId = (int) $variantenId;
        if ($variantenId <= 0) {
            return null;
        }
        try {
            $lager = pluginApp(VariationStockRepositoryContract::class);
            // Spalten ausdruecklich nennen: Mit leerer Liste kam live eine Zeile
            // ohne jedes Feld zurueck (28.09., ersteZeile: []).
            $zeilen = $lager->listStockByWarehouse(
                $variantenId,
                array('warehouseId', 'physicalStock', 'reservedStock', 'netStock'),
                1,
                200
            );
        } catch (\Throwable $e) {
            if (!$this->gewarnt) {
                $this->gewarnt = true;
                $this->getLogger(__METHOD__)->warning('MaschinensucherMarkt::log.lagerNichtLesbar', array(
                    'variante' => $variantenId,
                    'meldung'  => $e->getMessage(),
                ));
            }
            return null;
        }

        // Kein (array)-Cast: Auf einer Sammlung ergibt der nur deren
        // interne Eigenschaften (so schon bei den Auftragspositionen).
        // Manche Plenty-Listen kommen als Seite: {page, totalsCount, entries}.
        if (is_array($zeilen) && isset($zeilen['entries']) && is_array($zeilen['entries'])) {
            $zeilen = $zeilen['entries'];
        }
        $gelesen = array();
        if ($zeilen !== null) {
            foreach ($zeilen as $zeile) {
                $gelesen[] = $this->alsArray($zeile);
            }
        }

        if (!$this->gezeigt && count($gelesen) === 0) {
            // Nur wenn das Lager nichts liefert, einmal je Lauf zeigen, was
            // zurueckkam. Der Normalfall ist geprueft und braucht keinen
            // Eintrag mehr.
            $this->gezeigt = true;
            $this->getLogger(__METHOD__)->info('MaschinensucherMarkt::log.lagerGelesen', array(
                'variante'   => $variantenId,
                'zeilen'     => count($gelesen),
                'art'        => is_array($zeilen) ? 'array' : (is_object($zeilen) ? 'objekt' : 'anderes'),
                'ersteZeile' => count($gelesen) > 0 ? $gelesen[0] : null,
            ));
        }

        return Artikelabbildung::warenbestand(array('stock' => $gelesen));
    }

    /**
     * Eine Lagerzeile als Array. Plenty liefert Modelle; isset() auf ihre
     * Felder ist dort immer false (magische Eigenschaften) - deshalb
     * toArray(), und nur wenn das scheitert, die Felder direkt.
     */
    private function alsArray($zeile)
    {
        if (is_array($zeile)) {
            return $zeile;
        }
        try {
            $arr = $zeile->toArray();
            if (is_array($arr)) {
                return $arr;
            }
        } catch (\Throwable $e) {
        }
        try {
            return array(
                'physicalStock' => $zeile->physicalStock,
                'netStock'      => $zeile->netStock,
            );
        } catch (\Throwable $e) {
            return array();
        }
    }
}
