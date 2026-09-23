<?php

/**
 * Ein winziger Prüfer — kein PHPUnit, keine Abhängigkeit.
 *
 * Plugins für PlentyONE lassen sich nicht lokal ausführen: Die
 * Plenty-Klassen gibt es nur im Livesystem. Die reine Logik aber schon, und
 * genau dort sitzen die Fehler, die teuer sind (Preis, Einheiten, Spalten,
 * Anführungszeichen). Diese Datei macht sie mit einem `php tests/run.php`
 * prüfbar, ohne dass jemand erst Composer und PHPUnit einrichten muss.
 */
class Pruefer
{
    private $bestanden = 0;
    private $fehler = array();
    private $gruppe = '';

    public function gruppe($name)
    {
        $this->gruppe = $name;
    }

    public function gleich($erwartet, $bekommen, $was)
    {
        if ($erwartet === $bekommen) {
            $this->bestanden++;
            return;
        }
        $this->fehler[] = sprintf(
            "%s — %s\n    erwartet: %s\n    bekommen: %s",
            $this->gruppe,
            $was,
            $this->zeige($erwartet),
            $this->zeige($bekommen)
        );
    }

    public function wahr($bedingung, $was)
    {
        $this->gleich(true, (bool) $bedingung, $was);
    }

    public function enthaelt($nadel, $heuhaufen, $was)
    {
        if (is_array($heuhaufen)) {
            $heuhaufen = implode(' ', $heuhaufen);
        }
        if (strpos((string) $heuhaufen, $nadel) !== false) {
            $this->bestanden++;
            return;
        }
        $this->fehler[] = sprintf(
            "%s — %s\n    „%s\" kommt nicht vor in: %s",
            $this->gruppe,
            $was,
            $nadel,
            $this->zeige($heuhaufen)
        );
    }

    private function zeige($wert)
    {
        return str_replace(array("\r", "\n"), array('\r', '\n'), var_export($wert, true));
    }

    public function bericht()
    {
        $gesamt = $this->bestanden + count($this->fehler);
        if (count($this->fehler) === 0) {
            echo "\n{$this->bestanden} Prüfungen, alle bestanden.\n";
            return 0;
        }
        echo "\n" . count($this->fehler) . " von {$gesamt} Prüfungen fehlgeschlagen:\n\n";
        foreach ($this->fehler as $fehler) {
            echo "  " . $fehler . "\n\n";
        }
        return 1;
    }
}
