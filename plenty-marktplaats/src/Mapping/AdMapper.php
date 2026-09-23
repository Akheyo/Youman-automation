<?php

namespace Marktplaats\Mapping;

/**
 * Baut aus einer Plenty-Variante die Anzeige fuer die Marktplaats-API v2.
 *
 * Eingabe ist das Array, das VariationSource liefert (Plenty-Variante mit den
 * Relationen itemTexts, variationSalesPrices, images, itemImages,
 * variationDefaultCategory, variationCategories, item und dem Hersteller).
 *
 * Ergebnis:
 *   ad         Body fuer POST/PUT /v2/advertisements
 *   imageUrls  Bild-URLs fuer POST /v2/advertisements/{id}/images
 *   problems   Gruende, warum die Anzeige so nicht hochgeladen werden kann
 *   warnings   Hinweise, die den Upload nicht verhindern
 *   hash       Fingerabdruck von Anzeige + Bildern, um Aenderungen zu erkennen
 */
class AdMapper
{
    /** Felder, die nie aus Standard-Attributen ueberschrieben werden duerfen. */
    const CORE_FIELDS = ['itemId', 'categoryId', 'translations', 'priceModel', 'location', 'seller', 'status'];

    const PRICE_MODELS = ['fixed', 'bidding', 'see description'];

    public static function map(array $variation, array $settings): array
    {
        $problems = [];
        $warnings = [];

        // --- Texte ---------------------------------------------------------
        $text = self::pickText(self::arr($variation, 'itemTexts'), self::languages($settings));
        $titleField = self::str($settings, 'titleField', 'name1');
        $title = '';
        $description = '';
        if ($text === null) {
            $problems[] = 'Kein Artikeltext in den Sprachen ' . implode(', ', self::languages($settings)) . ' vorhanden.';
        } else {
            $title = TextCleaner::title(isset($text[$titleField]) && trim((string)$text[$titleField]) !== ''
                ? $text[$titleField]
                : (isset($text['name1']) ? $text['name1'] : ''));
            $description = TextCleaner::htmlToText(isset($text['description']) ? $text['description'] : '');
            if ($description === '' && isset($text['shortDescription'])) {
                $description = TextCleaner::htmlToText($text['shortDescription']);
            }
            $languages = self::languages($settings);
            if ($text['lang'] !== $languages[0]) {
                $warnings[] = 'Kein Text in "' . $languages[0] . '", verwendet wird "' . $text['lang'] . '".';
            }
        }
        if ($title === '') {
            $problems[] = 'Artikelname fehlt.';
        }
        if ($description === '') {
            // Marktplaats verlangt eine Beschreibung; der Titel ist besser als nichts
            $description = $title;
        }
        $footer = trim(TextCleaner::htmlToText(self::str($settings, 'descriptionFooter', '')));
        if ($footer !== '') {
            $description = trim($description . "\n\n" . $footer);
        }

        // --- Kategorie -----------------------------------------------------
        $categoryId = self::resolveCategory($variation, $settings);
        if ($categoryId <= 0) {
            $problems[] = 'Keine Marktplaats-Kategorie zugeordnet (Kategoriezuordnung oder Standardkategorie in der Konfiguration pflegen).';
        }

        // --- Preis ---------------------------------------------------------
        $priceModel = self::buildPriceModel($variation, $settings, $problems);

        // --- Standort ------------------------------------------------------
        $postcode = SettingsParser::postcode(self::str($settings, 'postcode', ''));
        if ($postcode === '') {
            $problems[] = 'Postleitzahl fuer den Anzeigenstandort fehlt in der Konfiguration.';
        } elseif (strlen($postcode) > 6) {
            $problems[] = 'Postleitzahl "' . $postcode . '" ist zu lang (Marktplaats erlaubt hoechstens 6 Zeichen, z. B. 1097DN).';
        }

        $ad = [
            'categoryId'   => $categoryId,
            'translations' => [[
                'locale'      => self::str($settings, 'locale', 'nl-NL'),
                'title'       => $title,
                'description' => $description,
            ]],
            'priceModel'   => $priceModel,
            'location'     => ['postcode' => $postcode],
        ];

        $seller = self::buildSeller($settings);
        if (count($seller) > 0) {
            $ad['seller'] = $seller;
        }

        // --- Attribute: Standard < Kategorie < Artikelzustand < GPSR --------
        foreach (self::buildAttributes($variation, $settings, $categoryId) as $key => $value) {
            $ad[$key] = $value;
        }

        // --- Bilder --------------------------------------------------------
        $imageUrls = self::pickImages($variation, $settings);
        if (count($imageUrls) === 0) {
            $warnings[] = 'Keine Bilder vorhanden.';
        }

        return [
            'ad'        => $ad,
            'imageUrls' => $imageUrls,
            'problems'  => $problems,
            'warnings'  => $warnings,
            'hash'      => self::hash($ad, $imageUrls),
        ];
    }

    /**
     * Fingerabdruck fuer die Aenderungserkennung. Anzeige und Bilder getrennt,
     * damit nur die Bilder neu geschickt werden, wenn sich nur die geaendert haben.
     */
    public static function hash(array $ad, array $imageUrls): string
    {
        return md5(json_encode(self::sortKeys($ad))) . ':' . md5(json_encode(array_values($imageUrls)));
    }

    /**
     * @return array{0: string, 1: string} [Anzeige-Hash, Bilder-Hash]
     */
    public static function splitHash($hash): array
    {
        $teile = explode(':', (string)$hash, 2);

        return [$teile[0], isset($teile[1]) ? $teile[1] : ''];
    }

    // -----------------------------------------------------------------------

    /**
     * @return array|null Textzeile in der ersten verfuegbaren Sprache
     */
    public static function pickText(array $texts, array $languages)
    {
        foreach ($languages as $lang) {
            foreach ($texts as $text) {
                if (!is_array($text) || !isset($text['lang']) || strtolower((string)$text['lang']) !== $lang) {
                    continue;
                }
                $hatName = trim((string)(isset($text['name1']) ? $text['name1'] : '')) !== '';
                if ($hatName) {
                    $text['lang'] = $lang;

                    return $text;
                }
            }
        }

        return null;
    }

    public static function resolveCategory(array $variation, array $settings): int
    {
        $map = isset($settings['categoryMap']) && is_array($settings['categoryMap']) ? $settings['categoryMap'] : [];

        foreach (self::plentyCategoryIds($variation) as $plentyCategoryId) {
            if (isset($map[$plentyCategoryId]) && (int)$map[$plentyCategoryId] > 0) {
                return (int)$map[$plentyCategoryId];
            }
        }

        return (int)(isset($settings['defaultCategoryId']) ? $settings['defaultCategoryId'] : 0);
    }

    /**
     * Plenty-Kategorien der Variante, Standardkategorie zuerst.
     *
     * @return int[]
     */
    public static function plentyCategoryIds(array $variation): array
    {
        $ids = [];
        foreach (self::arr($variation, 'variationDefaultCategory') as $default) {
            if (is_array($default) && isset($default['branchId'])) {
                $ids[] = (int)$default['branchId'];
            }
        }
        foreach (self::arr($variation, 'variationCategories') as $category) {
            if (is_array($category) && isset($category['categoryId'])) {
                $ids[] = (int)$category['categoryId'];
            }
        }

        return array_values(array_unique(array_filter($ids)));
    }

    private static function buildPriceModel(array $variation, array $settings, array &$problems): array
    {
        $modelType = self::str($settings, 'priceModel', 'fixed');
        if (!in_array($modelType, self::PRICE_MODELS, true)) {
            $problems[] = 'Unbekanntes Preismodell "' . $modelType . '".';
            $modelType = 'fixed';
        }
        if ($modelType === 'see description') {
            return ['modelType' => $modelType];
        }

        $salesPriceId = (int)(isset($settings['salesPriceId']) ? $settings['salesPriceId'] : 0);
        $price = self::salesPrice($variation, $salesPriceId);
        $cents = $price === null ? 0 : (int)round($price * 100);

        if ($modelType === 'bidding') {
            // Ohne Preis zeigt Marktplaats "Bieden" – das ist beim Bieten erlaubt
            return $cents > 0 ? ['modelType' => $modelType, 'askingPrice' => $cents] : ['modelType' => $modelType];
        }

        if ($salesPriceId <= 0) {
            $problems[] = 'Kein Verkaufspreis in der Konfiguration ausgewaehlt.';
        } elseif ($price === null) {
            $problems[] = 'Verkaufspreis ' . $salesPriceId . ' ist an der Variante nicht hinterlegt.';
        } elseif ($cents <= 0) {
            $problems[] = 'Verkaufspreis ist 0.';
        }

        return ['modelType' => $modelType, 'askingPrice' => max(0, $cents)];
    }

    /**
     * @return float|null Bruttopreis in Euro
     */
    public static function salesPrice(array $variation, int $salesPriceId)
    {
        foreach (self::arr($variation, 'variationSalesPrices') as $row) {
            if (is_array($row) && isset($row['salesPriceId'], $row['price']) && (int)$row['salesPriceId'] === $salesPriceId) {
                return (float)$row['price'];
            }
        }

        return null;
    }

    private static function buildSeller(array $settings): array
    {
        $seller = [];
        $src = isset($settings['seller']) && is_array($settings['seller']) ? $settings['seller'] : [];

        if (isset($src['sellerName']) && trim((string)$src['sellerName']) !== '') {
            $seller['sellerName'] = TextCleaner::truncate(trim((string)$src['sellerName']), 60);
        }
        if (isset($src['phoneNumber']) && trim((string)$src['phoneNumber']) !== '') {
            $seller['phoneNumber'] = preg_replace('/[^\d+]/', '', (string)$src['phoneNumber']);
        }
        if (isset($src['showEmail']) && $src['showEmail'] !== '') {
            $seller['showEmail'] = (bool)$src['showEmail'];
        }

        return $seller;
    }

    public static function buildAttributes(array $variation, array $settings, int $categoryId): array
    {
        $result = [];
        $config = isset($settings['attributes']) && is_array($settings['attributes']) ? $settings['attributes'] : [];

        foreach (['*', (string)$categoryId] as $key) {
            if (isset($config[$key]) && is_array($config[$key])) {
                foreach ($config[$key] as $name => $value) {
                    $result[$name] = $value;
                }
            }
        }

        // Artikelzustand aus Plenty (0 = Neu, 1 = Gebraucht, ...) auf den Marktplaats-Wert abbilden
        $conditionAttribute = self::str($settings, 'conditionAttribute', '');
        $conditionMap = isset($settings['conditionMap']) && is_array($settings['conditionMap']) ? $settings['conditionMap'] : [];
        $item = isset($variation['item']) && is_array($variation['item']) ? $variation['item'] : [];
        if ($conditionAttribute !== '' && isset($item['condition']) && isset($conditionMap[(string)$item['condition']])) {
            $result[$conditionAttribute] = $conditionMap[(string)$item['condition']];
        }

        if (!empty($settings['sendGpsr'])) {
            foreach (self::gpsr($variation, $settings) as $name => $value) {
                if ($value !== '') {
                    $result[$name] = $value;
                }
            }
        }

        foreach (self::CORE_FIELDS as $core) {
            unset($result[$core]);
        }

        return $result;
    }

    /**
     * GPSR-Pflichtangaben: Hersteller aus Plenty, sonst die Angaben aus der Konfiguration.
     */
    public static function gpsr(array $variation, array $settings): array
    {
        $m = isset($variation['manufacturer']) && is_array($variation['manufacturer']) ? $variation['manufacturer'] : [];
        $fallback = isset($settings['manufacturerFallback']) && is_array($settings['manufacturerFallback']) ? $settings['manufacturerFallback'] : [];

        $name = self::firstFilled([self::str($m, 'legalName', ''), self::str($m, 'externalName', ''), self::str($m, 'name', '')]);
        $strasse = trim(self::str($m, 'street', '') . ' ' . self::str($m, 'houseNo', ''));
        $ort = trim(self::str($m, 'postcode', '') . ' ' . self::str($m, 'town', ''));
        $address = trim(implode(', ', array_filter([$strasse, $ort])));
        $email = self::str($m, 'email', '');

        // Nur vollstaendige Herstellerdaten verwenden, sonst die Rueckfalldaten
        if ($name === '' || $address === '' || $email === '') {
            $name = $name !== '' ? $name : self::str($fallback, 'tradename', '');
            $address = $address !== '' ? $address : self::str($fallback, 'address', '');
            $email = $email !== '' ? $email : self::str($fallback, 'email', '');
        }

        return [
            'manufacturerTradename' => $name,
            'manufacturerAddress'   => $address,
            'manufacturerEmail'     => $email,
        ];
    }

    /**
     * Bilder der Variante (sonst des Artikels), nach Position, ohne Doppelte.
     * Sind Bilder gezielt fuer den Marktplaats-Herkunft freigegeben, nur diese.
     *
     * @return string[]
     */
    public static function pickImages(array $variation, array $settings): array
    {
        $images = self::arr($variation, 'images');
        if (count($images) === 0) {
            $images = self::arr($variation, 'itemImages');
        }

        $referrerId = (float)(isset($settings['referrerId']) ? $settings['referrerId'] : 0);
        if ($referrerId > 0) {
            $freigegeben = array_values(array_filter($images, function ($image) use ($referrerId) {
                return self::imageAvailableFor($image, $referrerId);
            }));
            if (count($freigegeben) > 0) {
                $images = $freigegeben;
            }
        }

        usort($images, function ($a, $b) {
            $pa = is_array($a) && isset($a['position']) ? (int)$a['position'] : 0;
            $pb = is_array($b) && isset($b['position']) ? (int)$b['position'] : 0;

            return $pa - $pb;
        });

        $max = (int)(isset($settings['maxImages']) ? $settings['maxImages'] : 24);
        $urls = [];
        foreach ($images as $image) {
            if (!is_array($image)) {
                continue;
            }
            $url = self::firstFilled([self::str($image, 'url', ''), self::str($image, 'urlMiddle', '')]);
            $fileType = strtolower(self::str($image, 'fileType', ''));
            // Marktplaats nimmt kein GIF
            if ($url === '' || $fileType === 'gif' || preg_match('/\.gif(\?|$)/i', $url)) {
                continue;
            }
            if (strpos($url, '//') === 0) {
                $url = 'https:' . $url;
            }
            if (!preg_match('#^https?://#i', $url) || in_array($url, $urls, true)) {
                continue;
            }
            $urls[] = $url;
            if ($max > 0 && count($urls) >= $max) {
                break;
            }
        }

        return $urls;
    }

    private static function imageAvailableFor($image, float $referrerId): bool
    {
        if (!is_array($image) || !isset($image['availabilities']) || !is_array($image['availabilities'])) {
            return false;
        }
        foreach ($image['availabilities'] as $availability) {
            if (is_array($availability)
                && isset($availability['type'], $availability['value'])
                && $availability['type'] === 'marketplace'
                && (float)$availability['value'] === $referrerId) {
                return true;
            }
        }

        return false;
    }

    // --- kleine Helfer -----------------------------------------------------

    private static function languages(array $settings): array
    {
        $languages = isset($settings['languages']) && is_array($settings['languages']) ? array_values($settings['languages']) : [];

        return count($languages) > 0 ? $languages : ['nl'];
    }

    private static function arr(array $source, string $key): array
    {
        return isset($source[$key]) && is_array($source[$key]) ? array_values($source[$key]) : [];
    }

    private static function str(array $source, string $key, string $default): string
    {
        return isset($source[$key]) ? trim((string)$source[$key]) : $default;
    }

    private static function firstFilled(array $values): string
    {
        foreach ($values as $value) {
            if (trim((string)$value) !== '') {
                return trim((string)$value);
            }
        }

        return '';
    }

    private static function sortKeys($value)
    {
        if (!is_array($value)) {
            return $value;
        }
        $isList = array_keys($value) === range(0, count($value) - 1);
        if (!$isList) {
            ksort($value);
        }
        foreach ($value as $key => $inner) {
            $value[$key] = self::sortKeys($inner);
        }

        return $value;
    }
}
