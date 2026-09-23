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
 *    Katalog. Wir wissen nicht, wie ihrer arbeitet, und ein zerschossener
 *    Import kostet mehr als ein verlorener Absatz. Umbrüche werden deshalb
 *    standardmäßig zu Leerzeichen.
 */
class Csv
{
    const ZEILENENDE = "\r\n";

    /** @var string */
    private $trenner;

    /** @var bool */
    private $umbrueche;

    /**
     * @param string $trenner
     * @param string $umbrueche 'entfernen' (Vorgabe) oder 'behalten'
     */
    public function __construct($trenner = ';', $umbrueche = 'entfernen')
    {
        $this->trenner = $trenner === '' ? ';' : $trenner;
        $this->umbrueche = $umbrueche === 'behalten';
    }

    /** Ein einzelnes Feld, nach RFC 4180 gesichert. */
    public function feld($wert)
    {
        $text = (string) $wert;

        if (!$this->umbrueche) {
            $text = preg_replace('/\s*\r?\n\s*/', ' ', $text);
            $text = preg_replace('/ {2,}/', ' ', $text);
            $text = trim($text);
        }

        $mussQuoten = strpos($text, $this->trenner) !== false
            || strpos($text, '"') !== false
            || strpos($text, "\n") !== false
            || strpos($text, "\r") !== false;

        return $mussQuoten ? '"' . str_replace('"', '""', $text) . '"' : $text;
    }

    /** Eine Zeile aus den Werten eines Inserats, in der Reihenfolge des Plans. */
    public function zeile(array $werte, Spaltenplan $plan)
    {
        $teile = array();
        foreach ($plan->spalten as $spalte) {
            $feld = $spalte['feld'];
            $teile[] = $this->feld($feld !== null && isset($werte[$feld]) ? $werte[$feld] : '');
        }
        return implode($this->trenner, $teile);
    }

    /** Die Kopfzeile. */
    public function kopfzeile(Spaltenplan $plan)
    {
        $teile = array();
        foreach ($plan->spalten as $spalte) {
            $teile[] = $this->feld($spalte['kopf']);
        }
        return implode($this->trenner, $teile);
    }

    /**
     * Die ganze Datei.
     *
     * Mit abschließendem Zeilenende: Manche Importer verschlucken sonst den
     * letzten Datensatz, weil sie auf den Umbruch warten.
     */
    public function datei(array $inserate, Spaltenplan $plan, $mitKopfzeile = true)
    {
        $zeilen = array();
        if ($mitKopfzeile) {
            $zeilen[] = $this->kopfzeile($plan);
        }
        foreach ($inserate as $werte) {
            $zeilen[] = $this->zeile($werte, $plan);
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
