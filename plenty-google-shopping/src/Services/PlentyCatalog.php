<?php

namespace ShoppingSync\Services;

use Plenty\Modules\Item\Item\Contracts\ItemRepositoryContract;
use Plenty\Modules\Item\ItemImage\Contracts\ItemImageRepositoryContract;
use Plenty\Modules\Item\Manufacturer\Contracts\ManufacturerRepositoryContract;
use Plenty\Modules\Item\Variation\Contracts\VariationRepositoryContract;
use Plenty\Modules\Item\VariationBarcode\Contracts\VariationBarcodeRepositoryContract;
use Plenty\Modules\Item\VariationDescription\Contracts\VariationDescriptionRepositoryContract;
use Plenty\Modules\Item\VariationSalesPrice\Contracts\VariationSalesPriceRepositoryContract;
use Plenty\Modules\Item\VariationStock\Contracts\VariationStockRepositoryContract;
use Plenty\Modules\Tag\Contracts\TagRelationshipRepositoryContract;
use Plenty\Modules\Tag\Contracts\TagRepositoryContract;
use Plenty\Plugin\Log\Loggable;
use ShoppingSync\Domain\SourceProduct;

/**
 * Liest Artikeldaten aus Plenty und gibt sie als SourceProduct zurück.
 *
 * Die einzige Stelle, die Plenty-Artikeldaten kennt. Alles danach arbeitet
 * mit einfachen Daten.
 */
class PlentyCatalog
{
    use Loggable;

    const TAG_TYPE_VARIATION = 'variation';

    /** @var array<string, int[]> Tag-Name → Varianten-IDs (Cache pro Lauf) */
    private $tagCache = [];

    /**
     * Alle Varianten, die einen der Tags tragen.
     *
     * @param string[] $tagNames
     * @return array<int, string[]> Varianten-ID → Namen der gefundenen Tags
     */
    public function tagsByVariation(array $tagNames): array
    {
        $result = [];
        foreach (array_unique($tagNames) as $tagName) {
            foreach ($this->variationIdsWithTag($tagName) as $variationId) {
                $result[$variationId][] = $tagName;
            }
        }

        return $result;
    }

    /**
     * @return int[]
     */
    public function variationIdsWithTag(string $tagName): array
    {
        if (isset($this->tagCache[$tagName])) {
            return $this->tagCache[$tagName];
        }

        $ids = [];
        try {
            /** @var TagRepositoryContract $tags */
            $tags = pluginApp(TagRepositoryContract::class);
            $tag = $tags->getTagByName($tagName);
            $tagId = (int) self::field($tag, 'id');

            if ($tagId > 0) {
                /** @var TagRelationshipRepositoryContract $relations */
                $relations = pluginApp(TagRelationshipRepositoryContract::class);
                foreach ($relations->findByTagId($tagId) as $relation) {
                    if ((string) self::field($relation, 'tagType') === self::TAG_TYPE_VARIATION) {
                        $ids[] = (int) self::field($relation, 'relationshipValue');
                    }
                }
            }
        } catch (\Throwable $e) {
            // Tag existiert (noch) nicht – dann trägt ihn auch keine Variante.
            $this->getLogger(__METHOD__)->info('ShoppingSync::log.tagNotFound', ['tag' => $tagName, 'error' => $e->getMessage()]);
        }

        $ids = array_values(array_unique(array_filter($ids)));
        $this->tagCache[$tagName] = $ids;

        return $ids;
    }

    /**
     * @param string[] $tagNames Tags, die die Variante laut Tag-Abfrage trägt
     * @param string[] $languages Plenty-Sprachen, deren Texte gebraucht werden
     * @param int[] $salesPriceIds
     * @param int[] $warehouseIds leer = alle Lager
     * @return SourceProduct|null null, wenn die Variante nicht (mehr) existiert
     */
    public function load(int $variationId, array $tagNames, array $languages, array $salesPriceIds, array $warehouseIds)
    {
        /** @var VariationRepositoryContract $variations */
        $variations = pluginApp(VariationRepositoryContract::class);
        try {
            $variation = $variations->findById($variationId);
        } catch (\Throwable $e) {
            return null;
        }
        if ($variation === null || (int) self::field($variation, 'id') <= 0) {
            return null;
        }

        $product = new SourceProduct();
        $product->variationId = $variationId;
        $product->itemId = (int) self::field($variation, 'itemId');
        $product->isActive = (bool) self::field($variation, 'isActive');
        $product->tags = array_values(array_unique($tagNames));

        $model = trim((string) self::field($variation, 'model'));
        $product->mpn = $model !== '' ? $model : null;

        $this->loadTexts($product, $languages);
        $this->loadPrices($product, $salesPriceIds);
        $this->loadImages($product);
        $this->loadBarcodes($product);
        $this->loadStock($product, $warehouseIds);
        $this->loadItem($product);

        return $product;
    }

    private function loadTexts(SourceProduct $product, array $languages)
    {
        /** @var VariationDescriptionRepositoryContract $descriptions */
        $descriptions = pluginApp(VariationDescriptionRepositoryContract::class);
        foreach (array_unique($languages) as $lang) {
            try {
                $text = $descriptions->find($product->variationId, $lang);
            } catch (\Throwable $e) {
                continue;
            }
            if ($text === null) {
                continue;
            }
            $product->texts[$lang] = [
                'name1' => (string) self::field($text, 'name'),
                'name2' => (string) self::field($text, 'name2'),
                'name3' => (string) self::field($text, 'name3'),
                'description' => (string) self::field($text, 'description'),
                'shortDescription' => (string) self::field($text, 'previewDescription'),
                'urlPath' => (string) self::field($text, 'urlPath'),
            ];
        }
    }

    private function loadPrices(SourceProduct $product, array $salesPriceIds)
    {
        /** @var VariationSalesPriceRepositoryContract $prices */
        $prices = pluginApp(VariationSalesPriceRepositoryContract::class);
        foreach (array_unique($salesPriceIds) as $salesPriceId) {
            try {
                $price = $prices->show((int) $salesPriceId, $product->variationId);
            } catch (\Throwable $e) {
                continue;
            }
            if ($price !== null) {
                $product->prices[(int) $salesPriceId] = (float) self::field($price, 'price');
            }
        }
    }

    private function loadImages(SourceProduct $product)
    {
        /** @var ItemImageRepositoryContract $images */
        $images = pluginApp(ItemImageRepositoryContract::class);
        try {
            $list = $images->findByVariationId($product->variationId);
            if (empty($list)) {
                $list = $images->findByItemId($product->itemId);
            }
        } catch (\Throwable $e) {
            $list = [];
        }

        $sorted = [];
        foreach ((array) $list as $image) {
            $url = trim((string) self::field($image, 'url'));
            if ($url !== '') {
                $sorted[] = ['position' => (int) self::field($image, 'position'), 'url' => $url];
            }
        }
        usort($sorted, function ($a, $b) {
            return $a['position'] <=> $b['position'];
        });
        $product->images = array_column($sorted, 'url');
    }

    private function loadBarcodes(SourceProduct $product)
    {
        /** @var VariationBarcodeRepositoryContract $barcodes */
        $barcodes = pluginApp(VariationBarcodeRepositoryContract::class);
        try {
            foreach ((array) $barcodes->findByVariationId($product->variationId) as $barcode) {
                $code = trim((string) self::field($barcode, 'code'));
                if ($code !== '') {
                    $product->barcodes[] = $code;
                }
            }
        } catch (\Throwable $e) {
            // Keine Barcodes ist ein gültiger Zustand.
        }
    }

    private function loadStock(SourceProduct $product, array $warehouseIds)
    {
        /** @var VariationStockRepositoryContract $stock */
        $stock = pluginApp(VariationStockRepositoryContract::class);
        $sum = 0.0;
        try {
            foreach ((array) $stock->listStockByWarehouse($product->variationId) as $row) {
                $warehouseId = (int) self::field($row, 'warehouseId');
                if ($warehouseIds !== [] && !in_array($warehouseId, $warehouseIds, true)) {
                    continue;
                }
                $sum += (float) self::field($row, 'netStock');
            }
        } catch (\Throwable $e) {
            // Bestand unbekannt → 0. So wird im Zweifel nicht beworben.
            $this->getLogger(__METHOD__)->warning('ShoppingSync::log.stockUnavailable', [
                'variationId' => $product->variationId,
                'error' => $e->getMessage(),
            ]);
        }
        $product->stockNet = $sum;
    }

    private function loadItem(SourceProduct $product)
    {
        /** @var ItemRepositoryContract $items */
        $items = pluginApp(ItemRepositoryContract::class);
        try {
            $item = $items->show($product->itemId, ['id', 'condition', 'manufacturerId']);
        } catch (\Throwable $e) {
            return;
        }

        $condition = self::field($item, 'condition');
        $product->conditionId = $condition === null || $condition === '' ? null : (int) $condition;

        $manufacturerId = (int) self::field($item, 'manufacturerId');
        if ($manufacturerId > 0) {
            try {
                /** @var ManufacturerRepositoryContract $manufacturers */
                $manufacturers = pluginApp(ManufacturerRepositoryContract::class);
                $manufacturer = $manufacturers->findById($manufacturerId);
                $name = trim((string) self::field($manufacturer, 'externalName'));
                if ($name === '') {
                    $name = trim((string) self::field($manufacturer, 'name'));
                }
                $product->brand = $name !== '' ? $name : null;
            } catch (\Throwable $e) {
                $product->brand = null;
            }
        }
    }

    /**
     * Plenty liefert je nach Repository Modelle oder Arrays.
     */
    private static function field($source, string $name)
    {
        if (is_array($source)) {
            return $source[$name] ?? null;
        }
        if (is_object($source)) {
            return $source->$name ?? null;
        }

        return null;
    }
}
