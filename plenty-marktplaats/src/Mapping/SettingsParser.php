<?php

namespace Marktplaats\Mapping;

/**
 * Liest die Freitextfelder aus der Plugin-Konfiguration.
 *
 * Fehler in einer Zeile werfen nicht, sondern landen in $fehler, damit ein
 * Tippfehler in einer Zuordnung nicht den ganzen Abgleich stoppt.
 */
class SettingsParser
{
    /**
     * Kategoriezuordnung, eine Zeile je Kategorie:
     *
     *   1234 = 567      Plenty-Kategorie 1234 -> Marktplaats-Kategorie 567
     *   1235: 568       Doppelpunkt geht auch
     *   # Kommentar
     *
     * @return array{map: array<int,int>, fehler: string[]}
     */
    public static function categoryMap($text): array
    {
        $map = [];
        $fehler = [];

        $zeilen = preg_split('/\r\n|\r|\n|;/', (string)$text);
        foreach ($zeilen as $nr => $zeile) {
            $zeile = trim(preg_replace('/#.*$/', '', $zeile));
            if ($zeile === '') {
                continue;
            }
            if (!preg_match('/^(\d+)\s*[=:>\-]+\s*(\d+)$/', $zeile, $treffer)) {
                $fehler[] = 'Kategoriezuordnung Zeile ' . ($nr + 1) . ' nicht lesbar: "' . $zeile . '" (erwartet: PlentyID = MarktplaatsID)';
                continue;
            }
            $map[(int)$treffer[1]] = (int)$treffer[2];
        }

        return ['map' => $map, 'fehler' => $fehler];
    }

    /**
     * JSON-Objekt aus einem Konfigurationsfeld. Leeres Feld = leeres Objekt.
     *
     * @return array{wert: array, fehler: string[]}
     */
    public static function jsonObject($text, string $feldname): array
    {
        $text = trim((string)$text);
        if ($text === '') {
            return ['wert' => [], 'fehler' => []];
        }

        $wert = json_decode($text, true);
        if (!is_array($wert)) {
            return ['wert' => [], 'fehler' => [$feldname . ' ist kein gueltiges JSON-Objekt.']];
        }

        return ['wert' => $wert, 'fehler' => []];
    }

    /**
     * Sprachliste wie "nl, de" -> ['nl', 'de'].
     *
     * @return string[]
     */
    public static function languages($text, string $standard = 'nl'): array
    {
        $sprachen = [];
        foreach (preg_split('/[\s,;]+/', strtolower((string)$text)) as $sprache) {
            if (preg_match('/^[a-z]{2}$/', $sprache) && !in_array($sprache, $sprachen, true)) {
                $sprachen[] = $sprache;
            }
        }

        return count($sprachen) > 0 ? $sprachen : [$standard];
    }

    /**
     * Niederlaendische Postleitzahl normalisieren: "1097 dn" -> "1097DN".
     */
    public static function postcode($text): string
    {
        return strtoupper(preg_replace('/\s+/', '', (string)$text));
    }
}
