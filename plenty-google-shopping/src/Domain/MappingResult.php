<?php

namespace ShoppingSync\Domain;

class MappingResult
{
    /** @var array|null ProductInput für die Merchant API, null bei Fehlern */
    public $productInput;
    /** @var string|null erkannter Produktgruppen-Tag */
    public $typeTag;
    /** @var string[] verhindern die Übertragung */
    public $errors = [];
    /** @var string[] Hinweise, Übertragung läuft trotzdem */
    public $warnings = [];

    public function isValid(): bool
    {
        return $this->errors === [] && $this->productInput !== null;
    }

    /**
     * Fingerabdruck der übertragenen Daten. Ändert sich irgendein Feld
     * (Preis, Text, Bild, Bestand …), ändert sich der Hash – nur dann
     * wird bei Google aktualisiert.
     */
    public function hash(): string
    {
        return $this->productInput === null ? '' : sha1(json_encode(self::sortKeys($this->productInput)));
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
