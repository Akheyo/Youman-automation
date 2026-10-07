<?php

namespace ShoppingSync\Domain;

/**
 * Hilfen rund um Produktnamen und den Prüfstatus bei Google.
 */
class GoogleStatus
{
    const APPROVED = 'approved';
    const PENDING = 'pending';
    const DISAPPROVED = 'disapproved';
    const UNKNOWN = 'unknown';

    /**
     * Ressourcen-Segment contentLanguage~feedLabel~offerId. Enthält ein Teil
     * Zeichen wie / % ~, verlangt die API die base64url-Form (ohne Padding).
     */
    public static function productSegment(string $contentLanguage, string $feedLabel, string $offerId): string
    {
        $plain = $contentLanguage . '~' . $feedLabel . '~' . $offerId;
        if (preg_match('/[\/%~?#\s]/', $offerId)) {
            return rtrim(strtr(base64_encode($plain), '+/', '-_'), '=');
        }

        return $plain;
    }

    /**
     * Fasst ein verarbeitetes Produkt (products.list) für ein Land zusammen.
     *
     * @return array{status: string, issues: array<int, array{severity: string, attribute: string, description: string}>}
     */
    public static function summarize(array $product, string $country): array
    {
        $status = self::UNKNOWN;
        $destinations = $product['productStatus']['destinationStatuses'] ?? [];

        foreach ($destinations as $destination) {
            // Shopping-Anzeigen sind das, wofür wir zahlen – daran messen wir.
            if (($destination['reportingContext'] ?? '') !== 'SHOPPING_ADS') {
                continue;
            }
            if (in_array($country, $destination['disapprovedCountries'] ?? [], true)) {
                $status = self::DISAPPROVED;
            } elseif (in_array($country, $destination['pendingCountries'] ?? [], true)) {
                $status = self::PENDING;
            } elseif (in_array($country, $destination['approvedCountries'] ?? [], true)) {
                $status = self::APPROVED;
            }
        }

        $issues = [];
        foreach ($product['productStatus']['itemLevelIssues'] ?? [] as $issue) {
            $countries = $issue['applicableCountries'] ?? [];
            if ($countries !== [] && !in_array($country, $countries, true)) {
                continue;
            }
            $issues[] = [
                'severity' => (string) ($issue['severity'] ?? ''),
                'attribute' => (string) ($issue['attribute'] ?? ''),
                'description' => trim(($issue['description'] ?? '') . ' ' . ($issue['detail'] ?? '')),
            ];
        }

        return ['status' => $status, 'issues' => $issues];
    }
}
