<?php

namespace ShoppingSync\Domain;

/**
 * Alles, was das Plugin aus Plenty über eine Variante wissen muss –
 * als einfache Daten, damit Abbildung und Entscheidungslogik ohne Plenty
 * testbar sind.
 */
class SourceProduct
{
    /** @var int */
    public $variationId;
    /** @var int */
    public $itemId;
    /** @var bool */
    public $isActive = false;
    /** @var float Netto-Warenbestand über die berücksichtigten Lager */
    public $stockNet = 0.0;
    /** @var string[] Namen aller Tags der Variante */
    public $tags = [];
    /**
     * Texte je Plenty-Sprache.
     * @var array<string, array{name1?: string, name2?: string, name3?: string, description?: string, shortDescription?: string, urlPath?: string}>
     */
    public $texts = [];
    /** @var array<int, float> Verkaufspreis-ID → Bruttopreis */
    public $prices = [];
    /** @var string[] Bild-URLs in Plenty-Reihenfolge */
    public $images = [];
    /** @var string|null Hersteller (Marke) */
    public $brand;
    /** @var string|null Modell / Herstellerteilenummer */
    public $mpn;
    /** @var string[] alle Barcodes der Variante, ungeprüft */
    public $barcodes = [];
    /** @var int|null Plenty-Artikelzustand */
    public $conditionId;
}
