<?php

namespace ShoppingSync\Domain;

/**
 * Produktgruppe, erkannt am Plenty-Tag (z. B. "type_klimakammer").
 *
 * Bewusst getrennt von der Freigabe (shopping_ads): Die Gruppe sagt, WAS das
 * Produkt ist – daraus entstehen product_type und custom_label_0, über die
 * die dauerhaft laufende Kampagne ihre Produkte auswählt.
 */
class ProductTypeConfig
{
    /** @var string */
    public $tag;
    /** @var array<string, string> product_type je Sprache; Schlüssel "*" gilt für alle */
    public $productType;
    /** @var string */
    public $customLabel0;
    /** @var string|null */
    public $googleProductCategory;

    /**
     * @return ProductTypeConfig|null
     */
    public static function fromArray(string $tag, $data, array &$errors)
    {
        $tag = trim($tag);
        if ($tag === '') {
            $errors[] = 'Produktgruppe ohne Tag-Namen.';
            return null;
        }
        if (!is_array($data)) {
            $errors[] = "Produktgruppe {$tag}: Eintrag muss ein Objekt sein.";
            return null;
        }

        $type = new self();
        $type->tag = $tag;

        $productType = $data['productType'] ?? '';
        if (is_string($productType)) {
            $type->productType = trim($productType) !== '' ? ['*' => trim($productType)] : [];
        } elseif (is_array($productType)) {
            $type->productType = [];
            foreach ($productType as $lang => $value) {
                if (trim((string) $value) !== '') {
                    $type->productType[strtolower((string) $lang)] = trim((string) $value);
                }
            }
        } else {
            $type->productType = [];
        }

        $type->customLabel0 = trim((string) ($data['customLabel0'] ?? ''));
        $category = trim((string) ($data['googleProductCategory'] ?? ''));
        $type->googleProductCategory = $category !== '' ? $category : null;

        $before = count($errors);
        if ($type->productType === []) {
            $errors[] = "Produktgruppe {$tag}: \"productType\" fehlt (z. B. \"Klimakammern > Klimaprüfschränke\").";
        }
        if ($type->customLabel0 === '') {
            $errors[] = "Produktgruppe {$tag}: \"customLabel0\" fehlt (z. B. \"klimakammer\").";
        } elseif (mb_strlen($type->customLabel0) > 100) {
            $errors[] = "Produktgruppe {$tag}: \"customLabel0\" ist länger als 100 Zeichen.";
        }

        return count($errors) === $before ? $type : null;
    }

    public function productTypeFor(string $language): string
    {
        if (isset($this->productType[$language])) {
            return $this->productType[$language];
        }
        if (isset($this->productType['*'])) {
            return $this->productType['*'];
        }

        // product_type sieht der Kunde nie; er dient nur der Kampagnen-
        // Struktur. Fehlt eine Übersetzung, ist die erste Fassung besser als
        // ein Produkt, das deswegen nicht übertragen wird.
        return (string) reset($this->productType);
    }
}
