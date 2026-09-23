<?php

namespace Marktplaats\Services;

use Plenty\Modules\Item\Manufacturer\Contracts\ManufacturerRepositoryContract;
use Plenty\Modules\Item\Variation\Contracts\VariationSearchRepositoryContract;
use Plenty\Modules\StockManagement\Stock\Contracts\StockRepositoryContract;
use Plenty\Plugin\Log\Loggable;

/**
 * Liest Varianten aus Plenty – genau in der Form, die AdMapper erwartet.
 *
 * Welche Varianten auf Marktplaats sollen, entscheidet Plenty selbst: aktiv und
 * unter "Verfuegbarkeit > Maerkte" fuer die Herkunft "Marktplaats" freigegeben.
 */
class VariationSource
{
    use Loggable;

    const WITH = [
        'item',
        'itemTexts',
        'variationSalesPrices',
        'images',
        'itemImages',
        'variationDefaultCategory',
        'variationCategories',
        'variationMarkets',
    ];

    /** @var array<int, array> Hersteller-Cache fuer einen Lauf */
    private $manufacturers = [];

    /**
     * Eine Seite der fuer Marktplaats freigegebenen, aktiven Varianten.
     *
     * @return array{variations: array[], lastPage: bool}
     */
    public function page(int $page, int $perPage, float $referrerId, bool $withStock): array
    {
        /** @var VariationSearchRepositoryContract $search */
        $search = pluginApp(VariationSearchRepositoryContract::class);
        $search->setFilters([
            'isActive'   => true,
            'referrerId' => self::referrerFilter($referrerId),
        ]);
        $search->setSearchParams([
            'with'         => self::WITH,
            'page'         => $page,
            'itemsPerPage' => $perPage,
        ]);

        $result = $search->search();
        $variations = [];
        foreach (self::rows($result->getResult()) as $row) {
            $variation = $this->enrich(self::toArray($row), $referrerId, $withStock);
            // Der Filter hat schon nach Herkunft gesucht. Liefert Plenty die Maerkte mit,
            // wird trotzdem nachgeprueft – falls der Filter einmal ignoriert wird, sollen
            // nicht alle aktiven Artikel auf Marktplaats landen.
            if (!array_key_exists('variationMarkets', $variation)) {
                $variation['visibleForMarket'] = true;
            }
            $variations[] = $variation;
        }

        return ['variations' => $variations, 'lastPage' => (bool)$result->isLastPage()];
    }

    /**
     * Eine einzelne Variante, egal ob freigegeben (fuer Vorschau und Einzelabgleich).
     *
     * @return array|null
     */
    public function one(int $variationId, float $referrerId, bool $withStock)
    {
        /** @var VariationSearchRepositoryContract $search */
        $search = pluginApp(VariationSearchRepositoryContract::class);
        $search->setFilters(['id' => $variationId]);
        $search->setSearchParams(['with' => self::WITH, 'page' => 1, 'itemsPerPage' => 1]);

        foreach (self::rows($search->search()->getResult()) as $row) {
            return $this->enrich(self::toArray($row), $referrerId, $withStock);
        }

        return null;
    }

    private function enrich(array $variation, float $referrerId, bool $withStock): array
    {
        $variation['visibleForMarket'] = self::isVisibleFor($variation, $referrerId);
        $variation['manufacturer'] = $this->manufacturer($variation);
        $variation['stockNet'] = $withStock ? $this->stockNet((int)$variation['id']) : null;

        return $variation;
    }

    public static function isVisibleFor(array $variation, float $referrerId): bool
    {
        $markets = isset($variation['variationMarkets']) && is_array($variation['variationMarkets']) ? $variation['variationMarkets'] : [];
        foreach ($markets as $market) {
            if (is_array($market) && isset($market['marketId']) && (float)$market['marketId'] === $referrerId) {
                return true;
            }
        }

        return false;
    }

    private function manufacturer(array $variation): array
    {
        $id = isset($variation['item']['manufacturerId']) ? (int)$variation['item']['manufacturerId'] : 0;
        if ($id <= 0) {
            return [];
        }
        if (!isset($this->manufacturers[$id])) {
            try {
                /** @var ManufacturerRepositoryContract $repository */
                $repository = pluginApp(ManufacturerRepositoryContract::class);
                $this->manufacturers[$id] = self::toArray($repository->findById($id));
            } catch (\Exception $e) {
                $this->manufacturers[$id] = [];
            }
        }

        return $this->manufacturers[$id];
    }

    /**
     * Netto-Warenbestand ueber alle Vertriebslager. null = nicht ermittelbar.
     */
    private function stockNet(int $variationId)
    {
        try {
            /** @var StockRepositoryContract $stock */
            $stock = pluginApp(StockRepositoryContract::class);
            $stock->setFilters(['variationId' => $variationId]);
            $sum = 0.0;
            foreach (self::rows($stock->listStockByWarehouseType('sales', ['stockNet'], 1, 100)->getResult()) as $row) {
                $row = self::toArray($row);
                $sum += isset($row['stockNet']) ? (float)$row['stockNet'] : 0.0;
            }

            return $sum;
        } catch (\Exception $e) {
            $this->getLogger('VariationSource')->warning('Marktplaats::log.stockFailed', [
                'variationId' => $variationId,
                'error'       => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Ergebnislisten kommen als Array oder Collection.
     */
    private static function rows($result): array
    {
        if (is_array($result)) {
            return $result;
        }
        if (is_object($result)) {
            return (array)$result->toArray();
        }

        return [];
    }

    /**
     * Plenty liefert je nach Kontext Modelle oder Arrays.
     */
    private static function toArray($row): array
    {
        if (is_array($row)) {
            return $row;
        }
        if (is_object($row)) {
            return (array)$row->toArray();
        }

        return [];
    }

    /**
     * Hauptherkuenfte haben ganze IDs (z. B. 142), Unterherkuenfte Nachkommastellen (104.01).
     */
    private static function referrerFilter(float $referrerId)
    {
        return floor($referrerId) === $referrerId ? (int)$referrerId : $referrerId;
    }
}
