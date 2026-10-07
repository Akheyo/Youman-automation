<?php

namespace ShoppingSync\Domain;

/**
 * Baut aus einer Plenty-Variante das ProductInput der Google Merchant API (v1)
 * für genau einen Markt.
 *
 * Grundsatz: Nichts wird erfunden. Fehlt etwas Pflichtiges (Preis, Bild,
 * Zustand, Produktgruppe …), gibt es einen Fehler statt eines Ratewerts.
 * Fehlt etwas Optionales (GTIN, MPN, Marke), wird es weggelassen und
 * identifierExists entsprechend gesetzt.
 */
class ProductMapper
{
    const TITLE_MAX = 150;
    const DESCRIPTION_MAX = 5000;

    /** @var Settings */
    private $settings;

    public function __construct(Settings $settings)
    {
        $this->settings = $settings;
    }

    /**
     * Welche Produktgruppe hat die Variante? Genau ein type_*-Tag ist erlaubt.
     *
     * @return array{type: ProductTypeConfig|null, error: string|null}
     */
    public function resolveType(SourceProduct $product): array
    {
        $found = [];
        foreach ($product->tags as $tag) {
            if (isset($this->settings->types[$tag])) {
                $found[$tag] = $this->settings->types[$tag];
            }
        }

        if (count($found) === 0) {
            return [
                'type' => null,
                'error' => 'Kein Produktgruppen-Tag gesetzt (erwartet einer von: ' . implode(', ', array_keys($this->settings->types)) . ').',
            ];
        }
        if (count($found) > 1) {
            return [
                'type' => null,
                'error' => 'Mehrere Produktgruppen-Tags gesetzt (' . implode(', ', array_keys($found)) . ') – bitte genau einen.',
            ];
        }

        return ['type' => reset($found), 'error' => null];
    }

    public function map(SourceProduct $product, MarketConfig $market): MappingResult
    {
        $result = new MappingResult();

        $typeResult = $this->resolveType($product);
        if ($typeResult['error'] !== null) {
            $result->errors[] = $typeResult['error'];
        }
        /** @var ProductTypeConfig|null $type */
        $type = $typeResult['type'];

        $texts = $product->texts[$market->textLanguage] ?? null;
        if ($texts === null) {
            $result->errors[] = "Keine Texte in der Plenty-Sprache \"{$market->textLanguage}\".";
            $texts = [];
        }

        $attributes = [];

        $title = $this->title($texts);
        if ($title === '') {
            $result->errors[] = 'Titel fehlt (' . $this->settings->titleField . ' in "' . $market->textLanguage . '").';
        } else {
            $attributes['title'] = $title;
        }

        $description = self::plainText((string) ($texts['description'] ?? ''));
        if ($description === '') {
            $description = self::plainText((string) ($texts['shortDescription'] ?? ''));
        }
        if ($description === '') {
            $result->errors[] = 'Beschreibung fehlt.';
        } else {
            $attributes['description'] = self::cut($description, self::DESCRIPTION_MAX);
        }

        $link = $this->link($product, $market, $texts);
        if ($link === null) {
            $result->errors[] = 'Produkt-URL kann nicht gebaut werden (URL-Pfad fehlt in "' . $market->textLanguage . '").';
        } else {
            $attributes['link'] = $link;
        }

        $images = array_values(array_unique(array_filter(array_map('trim', $product->images))));
        if ($images === []) {
            $result->errors[] = 'Kein Bild vorhanden.';
        } else {
            $attributes['imageLink'] = $images[0];
            $additional = array_slice($images, 1, $this->settings->maxAdditionalImages);
            if ($additional !== []) {
                $attributes['additionalImageLinks'] = $additional;
            }
        }

        $attributes['availability'] = $product->stockNet > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK';

        $price = $product->prices[$market->salesPriceId] ?? null;
        if ($price === null || $price <= 0) {
            $result->errors[] = "Kein Preis > 0 im Verkaufspreis {$market->salesPriceId}.";
        } else {
            $attributes['price'] = self::price($price, $market->currency);
        }

        $condition = $product->conditionId !== null
            ? ($this->settings->conditionMap[(string) $product->conditionId] ?? null)
            : null;
        if ($condition === null) {
            $result->errors[] = 'Artikelzustand ' . ($product->conditionId === null ? '(leer)' : $product->conditionId)
                . ' ist keinem Google-Zustand zugeordnet.';
        } else {
            $attributes['condition'] = $condition;
        }

        $brand = trim((string) $product->brand);
        if ($brand !== '') {
            $attributes['brand'] = self::cut($brand, 70);
        } else {
            $result->warnings[] = 'Kein Hersteller hinterlegt – Marke wird nicht übertragen.';
        }

        $mpn = trim((string) $product->mpn);
        if ($mpn !== '') {
            $attributes['mpn'] = self::cut($mpn, 70);
        }

        $gtins = Gtin::filter($product->barcodes);
        if ($gtins !== []) {
            $attributes['gtins'] = $gtins;
        } elseif ($product->barcodes !== []) {
            $result->warnings[] = 'Barcodes vorhanden, aber keine echte Hersteller-GTIN (z. B. interne 20er-EAN) – GTIN wird nicht übertragen.';
        }

        if ($gtins === [] && ($brand === '' || $mpn === '')) {
            $attributes['identifierExists'] = false;
        }

        if ($type !== null) {
            $attributes['productTypes'] = [$type->productTypeFor($market->contentLanguage)];
            $attributes['customLabel0'] = $type->customLabel0;
            if ($type->googleProductCategory !== null) {
                $attributes['googleProductCategory'] = $type->googleProductCategory;
            }

            $shipping = $market->shippingFor($type->tag);
            if ($shipping['shippingLabel'] !== null) {
                $attributes['shippingLabel'] = $shipping['shippingLabel'];
            }
            $rates = [];
            foreach ($shipping['rates'] as $rate) {
                $rates[] = self::shippingRate($rate, $market);
            }
            if ($rates !== []) {
                $attributes['shipping'] = $rates;
            }
            $result->typeTag = $type->tag;
        }

        if ($result->errors === []) {
            $result->productInput = [
                'offerId' => $this->settings->offerId($product->variationId),
                'contentLanguage' => $market->contentLanguage,
                'feedLabel' => $market->feedLabel,
                'productAttributes' => $attributes,
            ];
        }

        return $result;
    }

    private function title(array $texts): string
    {
        $field = $this->settings->titleField;
        $title = self::plainText((string) ($texts[$field] ?? ''));
        if ($title === '' && $field !== 'name1') {
            $title = self::plainText((string) ($texts['name1'] ?? ''));
        }
        $title = preg_replace('/\s+/u', ' ', $title);

        return self::cut($title, self::TITLE_MAX);
    }

    /**
     * @return string|null
     */
    private function link(SourceProduct $product, MarketConfig $market, array $texts)
    {
        $urlPath = trim((string) ($texts['urlPath'] ?? ''), " /");
        if ($urlPath === '' && strpos($market->linkTemplate, '{urlPath}') !== false) {
            return null;
        }

        return strtr($market->linkTemplate, [
            '{shopUrl}' => $market->shopUrl,
            '{urlPath}' => $urlPath,
            '{itemId}' => (string) $product->itemId,
            '{variationId}' => (string) $product->variationId,
            '{lang}' => $market->textLanguage,
        ]);
    }

    private static function price(float $amount, string $currency): array
    {
        return [
            'amountMicros' => sprintf('%.0f', round($amount * 1000000)),
            'currencyCode' => $currency,
        ];
    }

    private static function shippingRate(array $rate, MarketConfig $market): array
    {
        $entry = [
            'price' => self::price((float) $rate['price'], $market->currency),
            'country' => $market->country,
        ];
        if (isset($rate['service']) && trim((string) $rate['service']) !== '') {
            $entry['service'] = trim((string) $rate['service']);
        }
        foreach (['minHandlingTime', 'maxHandlingTime', 'minTransitTime', 'maxTransitTime'] as $field) {
            if (isset($rate[$field]) && $rate[$field] !== '') {
                $entry[$field] = (string) (int) $rate[$field];
            }
        }

        return $entry;
    }

    /**
     * HTML aus der Plenty-Beschreibung in lesbaren Klartext verwandeln.
     */
    public static function plainText(string $html): string
    {
        $text = preg_replace('#<\s*(br|/p|/div|/li|/h[1-6]|/tr)\b[^>]*>#i', "\n", $html);
        $text = preg_replace('#<\s*li\b[^>]*>#i', '- ', $text);
        $text = strip_tags($text);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = str_replace("\u{00A0}", ' ', $text);
        $text = preg_replace('/[ \t]+/u', ' ', $text);
        $text = preg_replace('/ *\n */u', "\n", $text);
        $text = preg_replace('/\n{3,}/u', "\n\n", $text);

        return trim($text);
    }

    /**
     * Auf Höchstlänge kürzen, möglichst an einer Wortgrenze.
     */
    public static function cut(string $text, int $max): string
    {
        if (mb_strlen($text) <= $max) {
            return $text;
        }
        $short = mb_substr($text, 0, $max);
        $space = mb_strrpos($short, ' ');
        if ($space !== false && $space > $max * 0.6) {
            $short = mb_substr($short, 0, $space);
        }

        return rtrim($short, " ,;:-");
    }
}
