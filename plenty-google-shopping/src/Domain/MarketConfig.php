<?php

namespace ShoppingSync\Domain;

/**
 * Ein Zielmarkt (Land) im Merchant Center.
 *
 * Nichts davon ist fest programmiert: Land, Sprache, Währung, Preis, URL und
 * Versand kommen aus der Plugin-Konfiguration. Österreich oder Frankreich
 * sind damit ein weiterer Eintrag in der Liste, kein neuer Code.
 */
class MarketConfig
{
    /** @var string ISO 3166-1 alpha-2, z. B. "DE" */
    public $country;
    /** @var bool */
    public $active;
    /** @var string Feed-Label im Merchant Center, z. B. "DE" */
    public $feedLabel;
    /** @var string ISO 639-1, Sprache des Angebots bei Google, z. B. "de" */
    public $contentLanguage;
    /** @var string Plenty-Sprache, aus der Titel/Beschreibung/URL gelesen werden */
    public $textLanguage;
    /** @var string ISO 4217, z. B. "EUR" */
    public $currency;
    /** @var int Plenty-Verkaufspreis-ID, deren Preis bei Google landet */
    public $salesPriceId;
    /** @var string Shop-Basis-URL ohne abschließenden Slash */
    public $shopUrl;
    /** @var string Platzhalter: {shopUrl} {urlPath} {itemId} {variationId} {lang} */
    public $linkTemplate;
    /** @var array<string, array> Versand je Produktgruppen-Tag; Schlüssel "default" als Rückfall */
    public $shipping;

    /**
     * @param array $data
     * @param string[] $errors wird um Fehlermeldungen ergänzt
     * @return MarketConfig|null
     */
    public static function fromArray($data, array &$errors)
    {
        if (!is_array($data)) {
            $errors[] = 'Markt-Eintrag ist kein Objekt.';
            return null;
        }

        $market = new self();
        $market->country = strtoupper(trim((string) ($data['country'] ?? '')));
        $label = $market->country !== '' ? $market->country : '?';

        if (!preg_match('/^[A-Z]{2}$/', $market->country)) {
            $errors[] = "Markt {$label}: \"country\" muss ein zweistelliger Ländercode sein (z. B. DE).";
            return null;
        }

        $market->active = !array_key_exists('active', $data) || self::toBool($data['active']);
        $market->feedLabel = strtoupper(trim((string) ($data['feedLabel'] ?? $market->country)));
        $market->contentLanguage = strtolower(trim((string) ($data['contentLanguage'] ?? '')));
        $market->textLanguage = strtolower(trim((string) ($data['textLanguage'] ?? $market->contentLanguage)));
        $market->currency = strtoupper(trim((string) ($data['currency'] ?? '')));
        $market->salesPriceId = (int) ($data['salesPriceId'] ?? 0);
        $market->shopUrl = rtrim(trim((string) ($data['shopUrl'] ?? '')), '/');
        $market->linkTemplate = trim((string) ($data['linkTemplate'] ?? '{shopUrl}/{urlPath}_{itemId}_{variationId}'));
        $market->shipping = is_array($data['shipping'] ?? null) ? $data['shipping'] : [];

        $before = count($errors);
        if (!preg_match('/^[A-Z0-9_-]{1,20}$/', $market->feedLabel)) {
            $errors[] = "Markt {$label}: \"feedLabel\" darf nur A–Z, 0–9, - und _ enthalten (max. 20 Zeichen).";
        }
        if (!preg_match('/^[a-z]{2}$/', $market->contentLanguage)) {
            $errors[] = "Markt {$label}: \"contentLanguage\" fehlt (zweistelliger Sprachcode, z. B. de).";
        }
        if (!preg_match('/^[a-z]{2}$/', $market->textLanguage)) {
            $errors[] = "Markt {$label}: \"textLanguage\" muss ein Plenty-Sprachcode sein (z. B. de).";
        }
        if (!preg_match('/^[A-Z]{3}$/', $market->currency)) {
            $errors[] = "Markt {$label}: \"currency\" fehlt (z. B. EUR).";
        }
        if ($market->salesPriceId <= 0) {
            $errors[] = "Markt {$label}: \"salesPriceId\" fehlt (ID des Plenty-Verkaufspreises).";
        }
        if (!preg_match('#^https://#', $market->shopUrl)) {
            $errors[] = "Markt {$label}: \"shopUrl\" muss mit https:// beginnen.";
        }
        foreach ($market->shipping as $key => $rule) {
            self::validateShipping($label, (string) $key, $rule, $errors);
        }

        return count($errors) === $before ? $market : null;
    }

    /**
     * Versandangaben für eine Produktgruppe in diesem Markt.
     *
     * @return array{shippingLabel: string|null, rates: array}
     */
    public function shippingFor(string $typeTag): array
    {
        $rule = $this->shipping[$typeTag] ?? ($this->shipping['default'] ?? []);

        return [
            'shippingLabel' => isset($rule['shippingLabel']) && $rule['shippingLabel'] !== ''
                ? (string) $rule['shippingLabel']
                : null,
            'rates' => is_array($rule['rates'] ?? null) ? $rule['rates'] : [],
        ];
    }

    private static function validateShipping(string $label, string $key, $rule, array &$errors)
    {
        if (!is_array($rule)) {
            $errors[] = "Markt {$label}: Versand \"{$key}\" muss ein Objekt sein.";
            return;
        }
        foreach ((array) ($rule['rates'] ?? []) as $index => $rate) {
            $price = $rate['price'] ?? null;
            if (!is_numeric($price) || (float) $price < 0) {
                $errors[] = "Markt {$label}: Versand \"{$key}\", Rate " . ($index + 1) . ': "price" muss eine Zahl ≥ 0 sein.';
            }
            foreach (['minHandlingTime', 'maxHandlingTime', 'minTransitTime', 'maxTransitTime'] as $field) {
                if (isset($rate[$field]) && (!is_numeric($rate[$field]) || (int) $rate[$field] < 0)) {
                    $errors[] = "Markt {$label}: Versand \"{$key}\", Rate " . ($index + 1) . ": \"{$field}\" muss eine ganze Zahl ≥ 0 sein.";
                }
            }
        }
    }

    private static function toBool($value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        return in_array(strtolower(trim((string) $value)), ['1', 'true', 'yes', 'ja', 'on'], true);
    }
}
