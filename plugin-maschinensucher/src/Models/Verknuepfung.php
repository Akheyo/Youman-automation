<?php

namespace MaschinensucherMarkt\Models;

use Plenty\Modules\Plugin\DataBase\Contracts\Model;

/**
 * Welcher Plenty-Artikel ist welches Maschinensucher-Inserat.
 *
 * Das ist die wichtigste Tabelle des Plugins. Ohne sie waere jeder Lauf
 * blind: Die API aendert ein Inserat nur ueber ihre eigene numerische ID,
 * und die steht nirgends in Plenty. Wer sie nicht kennt, kann nur anlegen —
 * und legt beim naechsten Lauf dasselbe noch einmal an.
 *
 * Gefuellt wird sie nicht von Hand, sondern aus GET /json/listing/all: Dort
 * traegt jedes bestehende Inserat neben seiner ID auch die internalId, und
 * das ist bei diesem Konto die Plenty-Artikel-ID. Die 591 Inserate, die es
 * vor dem Plugin schon gab, finden so von selbst ihren Artikel wieder.
 *
 * @property int    $id
 * @property int    $artikelId     Plenty-Artikel-ID (item), 0 wenn unbekannt
 * @property int    $variantenId   Plenty-Varianten-ID, 0 wenn unbekannt
 * @property int    $inseratId     Die ID bei Maschinensucher
 * @property string $internalId    Die eigene Referenz, wie sie drueben steht
 * @property int    $kategorieId   Rubrik des Inserats, von drueben uebernommen
 * @property string $zustand       aktiv | pausiert | geloescht | unbekannt
 * @property string $fingerabdruck Inhalt des zuletzt gesendeten Inserats
 * @property int    $gesendetAm    Unix-Zeit der letzten erfolgreichen Uebertragung
 * @property int    $gesehenAm     Unix-Zeit, zu der es drueben zuletzt auftauchte
 * @property string $meldung       Letzter Grund, warum es nicht durchging
 * @property int    $perApi        1 = vom Plugin ueber die API angelegt, 0 = vorgefunden
 */
class Verknuepfung extends Model
{
    const AKTIV     = 'aktiv';
    const PAUSIERT  = 'pausiert';
    const GELOESCHT = 'geloescht';
    const UNBEKANNT = 'unbekannt';

    public $id = 0;
    public $artikelId = 0;
    public $variantenId = 0;
    public $inseratId = 0;
    public $internalId = '';
    public $kategorieId = 0;
    public $zustand = self::UNBEKANNT;
    public $fingerabdruck = '';
    public $gesendetAm = 0;
    public $gesehenAm = 0;
    public $meldung = '';

    /**
     * Wurde das Inserat von diesem Plugin ueber die API angelegt?
     *
     * Davon haengt ab, was das Plugin damit tun darf. Laut API-Beschreibung
     * lassen sich nur ueber die API angelegte Inserate AENDERN ("only
     * listings which were created via the API can be updated"). Vorgefundene
     * Inserate — bei diesem Konto alle 594 von vor dem Plugin — kann es nur
     * pausieren und aktivieren. Ihr Inhalt bleibt, wie er drueben gepflegt
     * wurde.
     */
    public $perApi = 0;

    public function getTableName(): string
    {
        return 'MaschinensucherMarkt::Verknuepfung';
    }
}
