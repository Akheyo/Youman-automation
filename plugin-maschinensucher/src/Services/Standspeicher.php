<?php

namespace MaschinensucherMarkt\Services;

use MaschinensucherMarkt\Models\Abholung;
use MaschinensucherMarkt\Models\Stand;
use Plenty\Modules\Plugin\DataBase\Contracts\DataBase;

/**
 * Der Stand und das Abholprotokoll in der Plugin-Datenbank.
 *
 * Zwei kleine Tabellen, aber sie tragen die beiden Fragen, die man einer
 * Strecke, die nachts von allein läuft, sonst nicht ansehen kann: Was hat der
 * letzte Lauf ergeben — und war überhaupt jemand da, um die Datei zu holen?
 */
class Standspeicher
{
    /** @var DataBase */
    private $db;

    public function __construct(DataBase $db)
    {
        $this->db = $db;
    }

    /** Die eine Standzeile. Gibt es sie noch nicht, entsteht sie hier. */
    public function stand()
    {
        $zeilen = $this->db->query(Stand::class)->get();
        if (is_array($zeilen) && count($zeilen) > 0) {
            return $zeilen[0];
        }
        $stand = pluginApp(Stand::class);
        $stand->gebautAm = 0;
        $stand->inserate = 0;
        $stand->uebersprungen = 0;
        $stand->freiBis = 0;
        $stand->meldung = '';
        return $stand;
    }

    public function standSpeichern(Stand $stand)
    {
        $this->db->save($stand);
    }

    /**
     * Inserate des letzten erfolgreichen Laufs — Grundlage der Notbremse.
     * Null, solange noch nie einer durchgelaufen ist.
     */
    public function letzteMenge()
    {
        $stand = $this->stand();
        return $stand->gebautAm > 0 ? (int) $stand->inserate : null;
    }

    /** Bis wann ein Rückgang freigegeben ist. */
    public function freiBis()
    {
        $wert = (int) $this->stand()->freiBis;
        return $wert > 0 ? $wert : null;
    }

    /**
     * Schreibt einen Abruf mit.
     *
     * Wirft NICHT: Ein Protokolleintrag, der klemmt, darf den Marktplatz
     * nicht aufhalten.
     */
    public function abholungMerken($ok, $inserate, $bytes, $absender, $kennung, $meldung = '')
    {
        try {
            $eintrag = pluginApp(Abholung::class);
            $eintrag->geholtAm = time();
            $eintrag->ok = (bool) $ok;
            $eintrag->inserate = (int) $inserate;
            $eintrag->bytes = (int) $bytes;
            $eintrag->absender = substr((string) $absender, 0, 60);
            $eintrag->kennung = substr((string) $kennung, 0, 250);
            $eintrag->meldung = substr((string) $meldung, 0, 500);
            $this->db->save($eintrag);
        } catch (\Throwable $e) {
            // bewusst geschluckt
        }
    }

    /** Die letzten Abrufe, neueste zuerst — für das Protokoll im Log. */
    public function letzteAbholungen($anzahl = 5)
    {
        $zeilen = $this->db->query(Abholung::class)->orderBy('geholtAm', 'desc')->limit($anzahl)->get();
        return is_array($zeilen) ? $zeilen : array();
    }
}
