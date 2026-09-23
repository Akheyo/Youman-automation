<?php

namespace Marktplaats\Mapping;

/**
 * Entscheidet je Variante, was beim Abgleich mit Marktplaats passieren muss.
 * Reine Logik, damit die Regeln lokal getestet werden koennen.
 */
class SyncPlanner
{
    const CREATE = 'create';
    const UPDATE = 'update';
    const IMAGES = 'images';
    const DELETE = 'delete';
    const INVALID = 'invalid';
    const NONE = 'none';

    const STATUS_ONLINE = 'online';
    const STATUS_ERROR = 'error';
    const STATUS_REMOVED = 'removed';

    /** Fehler, die sich durch Wiederholen nicht loesen (Daten muessen erst geaendert werden). */
    const ERROR_VALIDATION = 'validation';
    const ERROR_TRANSIENT = 'transient';

    /**
     * @param array|null $listing Gespeicherter Stand (mpItemId, status, adHash, imageHash, errorType)
     * @param bool       $wanted  Soll die Variante auf Marktplaats stehen?
     * @param array|null $mapped  Ergebnis von AdMapper::map (nur noetig, wenn $wanted)
     */
    public static function decide($listing, bool $wanted, $mapped = null): string
    {
        $online = is_array($listing)
            && !empty($listing['mpItemId'])
            && (isset($listing['status']) ? $listing['status'] : '') !== self::STATUS_REMOVED;

        if (!$wanted) {
            return $online ? self::DELETE : self::NONE;
        }

        if (!is_array($mapped) || count(isset($mapped['problems']) ? $mapped['problems'] : []) > 0) {
            return self::INVALID;
        }

        list($adHash, $imageHash) = AdMapper::splitHash($mapped['hash']);

        // Ein Validierungsfehler mit unveraenderten Daten wuerde nur wieder scheitern
        if (is_array($listing)
            && (isset($listing['status']) ? $listing['status'] : '') === self::STATUS_ERROR
            && (isset($listing['errorType']) ? $listing['errorType'] : '') === self::ERROR_VALIDATION
            && (isset($listing['adHash']) ? $listing['adHash'] : '') === $adHash
            && (isset($listing['imageHash']) ? $listing['imageHash'] : '') === $imageHash) {
            return self::NONE;
        }

        if (!$online) {
            return self::CREATE;
        }

        if ((isset($listing['status']) ? $listing['status'] : '') === self::STATUS_ERROR
            || (isset($listing['adHash']) ? $listing['adHash'] : '') !== $adHash) {
            return self::UPDATE;
        }

        if ((isset($listing['imageHash']) ? $listing['imageHash'] : '') !== $imageHash) {
            return self::IMAGES;
        }

        return self::NONE;
    }

    /**
     * Soll die Variante ueberhaupt auf Marktplaats stehen?
     */
    public static function wanted(bool $isActive, bool $visibleForMarket, $stockNet, bool $requireStock): bool
    {
        if (!$isActive || !$visibleForMarket) {
            return false;
        }
        if ($requireStock && ($stockNet === null || (float)$stockNet <= 0)) {
            return false;
        }

        return true;
    }

    /**
     * Fehlerantwort der Marktplaats-API in eine lesbare Zeile uebersetzen.
     * Beispiel: "validation-failure: translations[0].title: input-too-long (60)".
     */
    public static function describeError(int $status, $body): string
    {
        if (!is_array($body)) {
            $text = trim(strip_tags((string)$body));

            return 'HTTP ' . $status . ($text !== '' ? ': ' . TextCleaner::truncate($text, 300) : '');
        }

        $teile = [];
        $kopf = isset($body['code']) ? (string)$body['code'] : 'HTTP ' . $status;
        if (isset($body['message']) && $body['message'] !== '') {
            $kopf .= ' (' . $body['message'] . ')';
        }
        if (isset($body['details']) && is_array($body['details'])) {
            foreach ($body['details'] as $detail) {
                if (!is_array($detail)) {
                    continue;
                }
                $feld = isset($detail['field']) ? (string)$detail['field']
                    : (isset($detail['fields']) && is_array($detail['fields']) ? implode('/', $detail['fields']) : '');
                $zeile = ($feld !== '' ? $feld . ': ' : '') . (isset($detail['code']) ? $detail['code'] : '');
                if (isset($detail['value']) && $detail['value'] !== '') {
                    $zeile .= ' (' . (is_array($detail['value']) ? implode('|', $detail['value']) : $detail['value']) . ')';
                }
                $teile[] = $zeile;
            }
        }

        return $kopf . (count($teile) > 0 ? ': ' . implode('; ', $teile) : '');
    }

    /**
     * Welche Felder hat Marktplaats als unbekannt abgelehnt? Diese kommen aus den
     * Standard-Attributen und werden fuer einen zweiten Versuch entfernt.
     *
     * @return string[] Nur Felder, die keine Kernfelder sind; leer, wenn andere Fehler dabei sind
     */
    public static function unknownFields($body): array
    {
        if (!is_array($body) || !isset($body['details']) || !is_array($body['details']) || count($body['details']) === 0) {
            return [];
        }

        $felder = [];
        foreach ($body['details'] as $detail) {
            $code = is_array($detail) && isset($detail['code']) ? $detail['code'] : '';
            $feld = is_array($detail) && isset($detail['field']) ? (string)$detail['field'] : '';
            if (!in_array($code, ['unknown-field', 'field-not-editable'], true) || $feld === '' || in_array($feld, AdMapper::CORE_FIELDS, true)) {
                return [];
            }
            $felder[] = $feld;
        }

        return array_values(array_unique($felder));
    }

    /**
     * Wiederholen lohnt bei Serverfehlern, Zeitueberschreitung, Ratenbegrenzung und
     * Anmeldeproblemen (die sind nach dem erneuten Verbinden weg). Alles andere
     * liegt an den Artikeldaten.
     */
    public static function errorType(int $status): string
    {
        return in_array($status, [0, 401, 403, 429], true) || $status >= 500
            ? self::ERROR_TRANSIENT
            : self::ERROR_VALIDATION;
    }
}
