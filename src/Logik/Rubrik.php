<?php

namespace MaschinensucherMarkt\Logik;

/**
 * Welche Maschinensucher-Rubrik ein Artikel bekommt.
 *
 * Gepflegt wird sie in Plenty als Auswahl-Eigenschaft: Jeder Auswahlwert
 * traegt als DEUTSCHEN Namen den Rubriknamen, den die Mitarbeiter lesen,
 * und als ENGLISCHEN Namen die Rubrik-ID bei Maschinensucher. Massgeblich
 * ist also immer der englische Wert.
 *
 * Das Suchdokument nennt am Artikel mal den Namen, mal die ID des gewaehlten
 * Werts. Deshalb wird in dieser Reihenfolge gedeutet:
 *
 *   1. ein englischer Wert, der eine Zahl ist        -> das ist die Rubrik
 *   2. eine Zahl, die eine bekannte Auswahl-ID ist   -> deren englischer Name
 *   3. ein Text, der einem Auswahlnamen entspricht   -> dessen englischer Name
 *   4. ein Text wie "Steuerungen (102)"              -> die Zahl in Klammern
 *
 * Eine Zahl, die weder englisch ist noch als Auswahl-ID bekannt, wird NICHT
 * als Rubrik genommen: Sie koennte genauso gut eine Auswahl-ID sein, und
 * eine falsche Rubrik ist schlimmer als die Auffangrubrik.
 */
class Rubrik
{
    /**
     * @param array $werte   aus Suchdokument::eigenschaft
     * @param array $auswahl Auswahl-ID => ['sprache' => 'name', ...]
     * @return array ['id' => int, 'grund' => string]
     */
    public static function aus(array $werte, array $auswahl)
    {
        if (count($werte) === 0) {
            return self::keine('Die Rubrik-Eigenschaft ist am Artikel nicht gesetzt.');
        }

        foreach ($werte as $wert) {
            if ($wert['lang'] === 'en' && self::istZahl($wert['value'])) {
                return self::rubrik((int) $wert['value'], 'englischer Wert der Eigenschaft');
            }
        }

        foreach ($werte as $wert) {
            if (self::istZahl($wert['value']) && isset($auswahl[(int) $wert['value']])) {
                $namen = $auswahl[(int) $wert['value']];
                if (isset($namen['en']) && self::istZahl($namen['en'])) {
                    return self::rubrik((int) $namen['en'], 'Auswahlwert ' . (int) $wert['value']);
                }
                return self::keine('Beim Auswahlwert ' . (int) $wert['value']
                    . ' steht als englischer Name keine Rubriknummer.');
            }
        }

        foreach ($werte as $wert) {
            $gesucht = mb_strtolower(trim($wert['value']), 'UTF-8');
            if ($gesucht === '') {
                continue;
            }
            foreach ($auswahl as $auswahlId => $namen) {
                foreach ($namen as $name) {
                    if (mb_strtolower(trim((string) $name), 'UTF-8') === $gesucht) {
                        if (isset($namen['en']) && self::istZahl($namen['en'])) {
                            return self::rubrik((int) $namen['en'], 'Auswahlwert "' . $wert['value'] . '"');
                        }
                        return self::keine('Beim Auswahlwert "' . $wert['value']
                            . '" steht als englischer Name keine Rubriknummer.');
                    }
                }
            }
        }

        foreach ($werte as $wert) {
            $treffer = array();
            if (preg_match('/[\(\[]\s*([0-9]+)\s*[\)\]]\s*$/', $wert['value'], $treffer)) {
                return self::rubrik((int) $treffer[1], 'Nummer im Namen "' . $wert['value'] . '"');
            }
        }

        $gesehen = array();
        foreach ($werte as $wert) {
            $gesehen[] = ($wert['lang'] !== '' ? $wert['lang'] . ':' : '') . $wert['value'];
        }
        return self::keine('Rubrik-Eigenschaft nicht lesbar (' . implode(', ', $gesehen) . ').');
    }

    private static function istZahl($wert)
    {
        return preg_match('/^[0-9]+$/', trim((string) $wert)) === 1 && (int) $wert > 0;
    }

    private static function rubrik($id, $grund)
    {
        return array('id' => (int) $id, 'grund' => $grund);
    }

    private static function keine($grund)
    {
        return array('id' => 0, 'grund' => $grund);
    }
}
