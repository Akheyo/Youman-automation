<?php

namespace MaschinensucherMarkt\Services;

use MaschinensucherMarkt\Models\Verknuepfung;
use Plenty\Modules\Plugin\DataBase\Contracts\DataBase;

/**
 * Lesen und Schreiben der Zuordnung Artikel <-> Inserat.
 *
 * Bewusst duenn gehalten: Was eine Zuordnung BEDEUTET, entscheidet der
 * Abgleich. Hier steht nur, wie sie in die Tabelle kommt und wieder heraus.
 */
class Zuordnung
{
    /** @var DataBase */
    private $db;

    public function __construct(DataBase $db)
    {
        $this->db = $db;
    }

    /**
     * @return Verknuepfung|null
     */
    public function zuArtikel($artikelId)
    {
        $artikelId = (int) $artikelId;
        if ($artikelId <= 0) {
            return null;
        }
        $zeilen = $this->db->query(Verknuepfung::class)
            ->where('artikelId', '=', $artikelId)
            ->get();
        return is_array($zeilen) && count($zeilen) > 0 ? $zeilen[0] : null;
    }

    /**
     * @return Verknuepfung|null
     */
    public function zuInserat($inseratId)
    {
        $inseratId = (int) $inseratId;
        if ($inseratId <= 0) {
            return null;
        }
        $zeilen = $this->db->query(Verknuepfung::class)
            ->where('inseratId', '=', $inseratId)
            ->get();
        return is_array($zeilen) && count($zeilen) > 0 ? $zeilen[0] : null;
    }

    /**
     * Alle Zuordnungen, nach Artikel-ID abgelegt.
     *
     * Der Abgleich laedt sie einmal und arbeitet dann im Speicher: Bei ein
     * paar hundert Inseraten ist das billiger als eine Abfrage je Artikel,
     * und der Lauf laeuft ohnehin ueber den ganzen Stamm.
     */
    public function alleNachArtikel()
    {
        $karte = array();
        $zeilen = $this->db->query(Verknuepfung::class)->get();
        foreach ((array) $zeilen as $zeile) {
            $karte[(int) $zeile->artikelId] = $zeile;
        }
        return $karte;
    }

    public function alle()
    {
        $zeilen = $this->db->query(Verknuepfung::class)->get();
        return is_array($zeilen) ? $zeilen : array();
    }

    /**
     * Holt die Zuordnung zu einem Inserat oder legt eine neue an — ohne sie
     * zu speichern. Das uebernimmt der Aufrufer, wenn er fertig gefuellt hat.
     *
     * @return Verknuepfung
     */
    public function neu()
    {
        return pluginApp(Verknuepfung::class);
    }

    public function speichern(Verknuepfung $verknuepfung)
    {
        $this->db->save($verknuepfung);
        return $verknuepfung;
    }

    public function entfernen(Verknuepfung $verknuepfung)
    {
        $this->db->delete($verknuepfung);
    }

    public function anzahl()
    {
        return count($this->alle());
    }
}
