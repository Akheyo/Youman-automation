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
            $zeilen = $lager->listStockByWarehouse($variantenId, array(), 1, 200);
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

        $gelesen = array();
        foreach ((array) $zeilen as $zeile) {
            if (is_array($zeile)) {
                $gelesen[] = $zeile;
            } elseif (is_object($zeile)) {
                $gelesen[] = array(
                    'physicalStock' => isset($zeile->physicalStock) ? $zeile->physicalStock : null,
                    'netStock'      => isset($zeile->netStock) ? $zeile->netStock : null,
                );
            }
        }
        return Artikelabbildung::warenbestand(array('stock' => $gelesen));
    }
}
