<?php

namespace Marktplaats\Mapping;

/**
 * Macht aus Plenty-Texten (HTML aus dem Editor) das, was Marktplaats annimmt:
 * reinen Text mit Zeilenumbruechen und einen Titel innerhalb der Laengengrenze.
 *
 * Reine Funktionen ohne Plenty-Abhaengigkeit, damit sie lokal testbar sind.
 */
class TextCleaner
{
    /** Marktplaats schneidet Titel auf der Seite bei 60 Zeichen ab und lehnt laengere ab. */
    const TITLE_MAX_LENGTH = 60;

    /**
     * HTML in lesbaren Text umwandeln. Absaetze und Listen bleiben als
     * Zeilenumbrueche erhalten, alles andere faellt weg.
     */
    public static function htmlToText($html): string
    {
        $text = (string)$html;
        if ($text === '') {
            return '';
        }

        $text = str_replace(["\r\n", "\r"], "\n", $text);
        // Umbrueche im Quelltext haben in HTML keine Bedeutung
        $text = preg_replace('/\s*\n\s*/', ' ', $text);
        $text = preg_replace('/<\s*br\s*\/?\s*>/i', "\n", $text);
        $text = preg_replace('/<\s*li[^>]*>/i', "\n- ", $text);
        $text = preg_replace('/<\s*\/\s*(p|div|h[1-6]|ul|ol|tr|table|section|article)\s*>/i', "\n", $text);
        $text = preg_replace('/<\s*(p|div|h[1-6]|ul|ol|tr|table|section|article)(\s[^>]*)?>/i', "\n", $text);
        $text = strip_tags($text);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = str_replace("\xC2\xA0", ' ', $text);

        $zeilen = [];
        foreach (explode("\n", $text) as $zeile) {
            $zeilen[] = trim(preg_replace('/[ \t]+/', ' ', $zeile));
        }
        $text = implode("\n", $zeilen);
        // Hoechstens eine Leerzeile am Stueck
        $text = preg_replace("/\n{3,}/", "\n\n", $text);

        return trim($text);
    }

    /**
     * Titel bereinigen und auf die erlaubte Laenge kuerzen, moeglichst an einer
     * Wortgrenze, damit kein halbes Wort am Ende steht.
     */
    public static function title($raw, int $maxLength = self::TITLE_MAX_LENGTH): string
    {
        $title = self::htmlToText($raw);
        $title = trim(preg_replace('/\s+/', ' ', $title));

        return self::truncate($title, $maxLength);
    }

    public static function truncate(string $text, int $maxLength): string
    {
        if ($maxLength <= 0 || mb_strlen($text, 'UTF-8') <= $maxLength) {
            return $text;
        }

        $cut = mb_substr($text, 0, $maxLength, 'UTF-8');
        $lastSpace = mb_strrpos($cut, ' ', 0, 'UTF-8');
        // Nur an der Wortgrenze kuerzen, wenn dabei nicht zu viel verloren geht
        if ($lastSpace !== false && $lastSpace >= (int)floor($maxLength * 0.6)) {
            $cut = mb_substr($cut, 0, $lastSpace, 'UTF-8');
        }

        return rtrim($cut, " \t\n-,;:/");
    }
}
