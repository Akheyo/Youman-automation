<?php

namespace ShoppingSync\Domain;

/**
 * Entscheidet, ob ein Barcode als GTIN an Google gehen darf.
 *
 * Google darf nur echte, weltweit eindeutige Herstellernummern bekommen. Die
 * Erfassung legt aber für jeden Artikel eine hausinterne EAN-13 mit Präfix 20
 * an (GS1-Bereich 200–299, "restricted distribution"). Solche Codes sind
 * gültig gebildet, gehören aber keinem Hersteller – an Google übertragen,
 * würde das Produkt einem fremden oder gar keinem Katalogeintrag zugeordnet
 * und schlimmstenfalls abgelehnt. Deshalb fliegen alle Bereiche raus, die
 * GS1 für interne Zwecke, Gutscheine oder Mengen-/Preis-Codes reserviert.
 */
class Gtin
{
    /**
     * @return string|null Die normalisierte GTIN oder null, wenn sie nicht übertragen werden darf.
     */
    public static function normalize(string $code)
    {
        $digits = preg_replace('/[\s-]+/', '', trim($code));
        if ($digits === '' || !ctype_digit($digits)) {
            return null;
        }

        $length = strlen($digits);
        if (!in_array($length, [8, 12, 13, 14], true)) {
            return null;
        }
        if (ltrim($digits, '0') === '') {
            return null;
        }
        if (!self::hasValidCheckDigit($digits)) {
            return null;
        }
        if (self::isRestricted($digits)) {
            return null;
        }

        return $digits;
    }

    public static function hasValidCheckDigit(string $digits): bool
    {
        $body = substr($digits, 0, -1);
        $check = (int) substr($digits, -1);
        $sum = 0;
        $weight = 3;
        for ($i = strlen($body) - 1; $i >= 0; $i--) {
            $sum += ((int) $body[$i]) * $weight;
            $weight = $weight === 3 ? 1 : 3;
        }

        return (10 - ($sum % 10)) % 10 === $check;
    }

    /**
     * GS1-Bereiche, die nie einen Hersteller-Artikel bezeichnen.
     */
    public static function isRestricted(string $digits): bool
    {
        $length = strlen($digits);

        // GTIN-8: 0xxxxxxx und 2xxxxxxx sind RCN-8 (interne Nummern).
        if ($length === 8) {
            return $digits[0] === '0' || $digits[0] === '2';
        }

        // Alles andere auf GTIN-13 zurückführen: GTIN-12 bekommt eine
        // führende 0, bei GTIN-14 fällt die Packungs-Indikatorziffer weg.
        if ($length === 12) {
            $gtin13 = '0' . $digits;
        } elseif ($length === 14) {
            $gtin13 = substr($digits, 1);
        } else {
            $gtin13 = $digits;
        }

        $prefix3 = (int) substr($gtin13, 0, 3);

        return ($prefix3 >= 20 && $prefix3 <= 29)    // 020–029: interne Nummern (UPC 2x)
            || ($prefix3 >= 40 && $prefix3 <= 49)    // 040–049: interne Nummern (UPC 4x)
            || ($prefix3 >= 50 && $prefix3 <= 59)    // 050–059: Gutscheine (UPC 5x)
            || ($prefix3 >= 200 && $prefix3 <= 299)  // 200–299: hausintern (z. B. unsere 20er-EANs)
            || ($prefix3 >= 980 && $prefix3 <= 999); // 980–999: Quittungen, Gutscheine
    }

    /**
     * @param string[] $codes
     * @return string[] Nur die übertragbaren GTINs, ohne Duplikate.
     */
    public static function filter(array $codes): array
    {
        $result = [];
        foreach ($codes as $code) {
            $gtin = self::normalize((string) $code);
            if ($gtin !== null && !in_array($gtin, $result, true)) {
                $result[] = $gtin;
            }
        }

        return $result;
    }
}
