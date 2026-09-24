<?php

namespace MaschinensucherMarkt\Logik;

/**
 * Welche Maschinensucher-Rubrik ein Artikel bekommt.
 *
 * Gepflegt wird sie in Plenty als Auswahl-Eigenschaft. Zwei Schreibweisen
 * fuer einen Auswahlwert sind moeglich:
 *
 *   - Name "Steuerungen (102)": die Rubrik-ID in Klammern am Namen.
 *     Das einfachste — nur ein Feld, und die Mitarbeiter lesen den Namen.
 *   - Deutscher Name "Steuerungen", englischer Name "102".
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
                $id = self::ausNamen($auswahl[(int) $wert['value']]);
                if ($id > 0) {
                    return self::rubrik($id, 'Auswahlwert ' . (int) $wert['value']);
                }
                return self::keine('Beim Auswahlwert ' . (int) $wert['value']
                    . ' steht keine Rubriknummer - weder in Klammern am Namen noch als englischer Name.');
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
                        $id = self::ausNamen($namen);
                        if ($id > 0) {
                            return self::rubrik($id, 'Auswahlwert "' . $wert['value'] . '"');
                        }
                        return self::keine('Beim Auswahlwert "' . $wert['value']
                            . '" steht keine Rubriknummer - weder in Klammern am Namen noch als englischer Name.');
                    }
                }
            }
        }

        foreach ($werte as $wert) {
            $id = self::inKlammern($wert['value']);
            if ($id > 0) {
                return self::rubrik($id, 'Nummer im Namen "' . $wert['value'] . '"');
            }
        }

        $gesehen = array();
        foreach ($werte as $wert) {
            $gesehen[] = ($wert['lang'] !== '' ? $wert['lang'] . ':' : '') . $wert['value'];
        }
        return self::keine('Rubrik-Eigenschaft nicht lesbar (' . implode(', ', $gesehen) . ').');
    }

    /**
     * Die Rubrik-ID aus den Namen eines Auswahlwerts: englischer Name als
     * Zahl, sonst eine Zahl in Klammern am Ende irgendeines Namens.
     */
    private static function ausNamen(array $namen)
    {
        if (isset($namen['en']) && self::istZahl($namen['en'])) {
            return (int) $namen['en'];
        }
        foreach ($namen as $name) {
            $id = self::inKlammern($name);
            if ($id > 0) {
                return $id;
            }
        }
        return 0;
    }

    /** "Steuerungen (102)" -> 102, sonst 0. */
    private static function inKlammern($text)
    {
        $treffer = array();
        if (preg_match('/[\(\[]\s*([0-9]+)\s*[\)\]]\s*$/', trim((string) $text), $treffer)) {
            return (int) $treffer[1];
        }
        return 0;
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
