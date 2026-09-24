<?php

namespace MaschinensucherMarkt\Services;

use Plenty\Modules\Property\V2\Contracts\PropertySelectionRepositoryContract;
use Plenty\Plugin\Log\Loggable;

/**
 * Die Auswahlwerte der Rubrik-Eigenschaft mit ihren Namen je Sprache.
 *
 * Einmal je Lauf gelesen und dann im Speicher gehalten: Die Eigenschaft hat
 * so viele Werte, wie es genutzte Rubriken gibt, und jeder Artikel im Lauf
 * braucht dieselbe Tabelle.
 */
class Rubrikauswahl
{
    use Loggable;

    const JE_SEITE = 100;
    const MAX_SEITEN = 30;

    /** @var PropertySelectionRepositoryContract */
    private $auswahl;

    /** @var array Eigenschafts-ID => Auswahl-ID => ['sprache' => 'name'] */
    private $gelesen = array();

    public function __construct(PropertySelectionRepositoryContract $auswahl)
    {
        $this->auswahl = $auswahl;
    }

    /**
     * @return array Auswahl-ID => ['de' => 'Steuerungen', 'en' => '102', ...]
     */
    public function karte($eigenschaftId)
    {
        $eigenschaftId = (int) $eigenschaftId;
        if ($eigenschaftId <= 0) {
            return array();
        }
        if (isset($this->gelesen[$eigenschaftId])) {
            return $this->gelesen[$eigenschaftId];
        }

        $karte = array();
        try {
            for ($seite = 1; $seite <= self::MAX_SEITEN; $seite++) {
                $antwort = $this->auswahl->searchByPropertyId($eigenschaftId, array('names'), self::JE_SEITE, $seite);
                $eintraege = $this->eintraege($antwort);
                foreach ($eintraege as $eintrag) {
                    $id = (int) $this->wert($eintrag, 'id');
                    if ($id > 0) {
                        $karte[$id] = $this->namen($this->wert($eintrag, 'names'));
                    }
                }
                if (count($eintraege) < self::JE_SEITE) {
                    break;
                }
            }
        } catch (\Throwable $e) {
            // Ohne Tabelle geht es trotzdem: Steht die Rubriknummer im
            // Suchdokument direkt als englischer Wert, wird sie so gefunden.
            $this->getLogger(__METHOD__)->warning('MaschinensucherMarkt::log.rubrikauswahlFehlt', array(
                'eigenschaft' => $eigenschaftId,
                'meldung'     => $e->getMessage(),
            ));
        }

        $this->gelesen[$eigenschaftId] = $karte;
        return $karte;
    }

    /**
     * Die Liste aus der Antwort — Plenty liefert je nach Stand eine Liste
     * oder ein seitenweises Ergebnis.
     */
    private function eintraege($antwort)
    {
        if (is_array($antwort)) {
            return isset($antwort['entries']) && is_array($antwort['entries']) ? $antwort['entries'] : $antwort;
        }
        if (is_object($antwort)) {
            $liste = $antwort->getResult();
            if (is_array($liste)) {
                return $liste;
            }
            $heraus = array();
            foreach ($liste as $eintrag) {
                $heraus[] = $eintrag;
            }
            return $heraus;
        }
        return array();
    }

    private function namen($roh)
    {
        $namen = array();
        if ($roh === null) {
            return $namen;
        }
        foreach ($roh as $name) {
            $sprache = strtolower((string) $this->wert($name, 'lang'));
            if ($sprache !== '') {
                $namen[$sprache] = trim((string) $this->wert($name, 'name'));
            }
        }
        return $namen;
    }

    /**
     * Ein Feld aus einem Eintrag, der ein Array oder ein Modell sein kann.
     * Ausgeschrieben statt ueber einen variablen Eigenschaftsnamen: Den
     * laesst der Plugin-Build nicht zu.
     */
    private function wert($eintrag, $feld)
    {
        if (is_array($eintrag)) {
            return isset($eintrag[$feld]) ? $eintrag[$feld] : null;
        }
        if (!is_object($eintrag)) {
            return null;
        }
        if ($feld === 'id') {
            return $eintrag->id;
        }
        if ($feld === 'names') {
            return $eintrag->names;
        }
        if ($feld === 'lang') {
            return $eintrag->lang;
        }
        if ($feld === 'name') {
            return $eintrag->name;
        }
        return null;
    }
}
