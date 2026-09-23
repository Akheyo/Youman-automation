<?php

namespace MaschinensucherMarkt\Logik;

/**
 * Die Importdatei: aus Inseraten wird eine Tabelle.
 *
 * Zwei Dinge können dabei schiefgehen, beide sind hier abgefangen:
 *
 * 1. EIN TRENNZEICHEN IM TEXT. Steht in der Beschreibung ein Semikolon,
 *    zerfällt die Zeile in zwei — ab da ist alles verschoben. Jedes Feld wird
 *    deshalb in Anführungszeichen gesetzt, sobald es Trennzeichen,
 *    Anführungszeichen oder Umbrüche enthält (RFC 4180).
 *
 * 2. EIN ZEILENUMBRUCH IM TEXT. Formal erlaubt, solange das Feld in
 *    Anführungszeichen steht — aber ein Importer, der die Datei zuerst in
 *    Zeilen schneidet und erst dann in Spalten, zerlegt daran den halben
 *    Katalog. Umbrüche werden deshalb standardmäßig zu Leerzeichen.
 *
 * Nur statische Methoden: siehe Spaltenplan.php — im Plugin-Code ist `new`
 * nicht erlaubt.
 */
class Csv
{
    const ZEILENENDE = "\r\n";

    /** Ein einzelnes Feld, nach RFC 4180 gesichert. */
    public static function feld($wert, $trenner = ';', $umbrueche = 'entfernen')
    {
        $text = (string) $wert;

        if ($umbrueche !== 'behalten') {
            $text = preg_replace('/\s*\r?\n\s*/', ' ', $text);
            $text = preg_replace('/ {2,}/', ' ', $text);
            $text = trim($text);
        }

        $mussQuoten = strpos($text, $trenner) !== false
            || strpos($text, '"') !== false
            || strpos($text, "\n") !== false
            || strpos($text, "\r") !== false;

        return $mussQuoten ? '"' . str_replace('"', '""', $text) . '"' : $text;
    }

    /** Eine Zeile aus den Werten eines Inserats, in der Reihenfolge des Plans. */
    public static function zeile(array $werte, array $spalten, $trenner = ';', $umbrueche = 'entfernen')
    {
        $teile = array();
        foreach ($spalten as $spalte) {
            $feld = $spalte['feld'];
            $wert = $feld !== null && isset($werte[$feld]) ? $werte[$feld] : '';
            $teile[] = self::feld($wert, $trenner, $umbrueche);
        }
        return implode($trenner, $teile);
    }

    /** Die Kopfzeile. */
    public static function kopfzeile(array $spalten, $trenner = ';', $umbrueche = 'entfernen')
    {
        $teile = array();
        foreach ($spalten as $spalte) {
            $teile[] = self::feld($spalte['kopf'], $trenner, $umbrueche);
        }
        return implode($trenner, $teile);
    }

    /**
     * Die ganze Datei.
     *
     * Mit abschließendem Zeilenende: Manche Importer verschlucken sonst den
     * letzten Datensatz, weil sie auf den Umbruch warten.
     *
     * @param array $inserate Liste von Wert-Arrays
     * @param array $plan     Ergebnis von Spaltenplan::bauen()
     */
    public static function datei(array $inserate, array $plan, $trenner = ';', $umbrueche = 'entfernen', $mitKopfzeile = true)
    {
        $spalten = isset($plan['spalten']) ? $plan['spalten'] : array();
        $zeilen = array();

        if ($mitKopfzeile) {
            $zeilen[] = self::kopfzeile($spalten, $trenner, $umbrueche);
        }
        foreach ($inserate as $werte) {
            $zeilen[] = self::zeile($werte, $spalten, $trenner, $umbrueche);
        }

        return implode(self::ZEILENENDE, $zeilen) . self::ZEILENENDE;
    }

    /**
     * Text in der Kodierung, die die Gegenstelle erwartet.
     *
     * UTF-8 bekommt ein BOM: Ohne das lesen ältere Importer "Größe" als
     * "GrÃ¶ÃŸe", und der Fehler fällt erst im fertigen Inserat auf. Bei
     * latin1 werden Zeichen, die es dort nicht gibt, ersetzt statt die Datei
     * zu zerstören.
     */
    public static function kodiere($text, $kodierung = 'utf-8')
    {
        if ($kodierung === 'latin1') {
            $ersetzt = str_replace(
                array('‘', '’', '‚', '“', '”', '„', '–', '—', '…', '·', '€'),
                array("'", "'", "'", '"', '"', '"', '-', '-', '...', '-', 'EUR'),
                $text
            );
            return mb_convert_encoding($ersetzt, 'ISO-8859-1', 'UTF-8');
        }
        return "\xEF\xBB\xBF" . $text;
    }
}
