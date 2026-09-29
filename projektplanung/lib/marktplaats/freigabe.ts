/**
 * Das Wort, das getippt werden muss, bevor etwas veröffentlicht wird.
 *
 * Eine eigene Datei, weil es an zwei Stellen gebraucht wird: in der
 * Oberfläche (die den Knopf sperrt) und in der API-Route (die den Aufruf
 * abweist). Stünde es zweimal im Code, ließe sich eines der beiden ändern —
 * und die Sicherung wäre dann genau in der Richtung offen, in der es zählt.
 *
 * Das Modul enthält bewusst nichts weiter: Es wird auch vom Browser-Bundle
 * geladen, und alles andere zöge den Plenty- und Marktplaats-Client mit
 * hinein.
 */
export const FREIGABEWORT = 'VEROEFFENTLICHEN';
