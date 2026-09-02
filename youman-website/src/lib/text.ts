/**
 * Teilt einen Absatz nach dem ersten Satz.
 *
 * Gebraucht, um den ersten Satz eines Einleitungstexts als Vorspann zu
 * setzen und den Rest als Fliesstext. Die Texte in `src/data/*.ts` sind
 * dafuer geschrieben: Der erste Satz traegt die Aussage, danach kommt die
 * Erlaeuterung.
 *
 * Getrennt wird am ersten Satzzeichen, auf das ein Leerzeichen folgt.
 * Abkuerzungen mit Punkt ("z. B.") kommen in diesen Texten nicht vor; wer
 * eine einfuegt, sieht den Bruch sofort auf der Seite.
 */
export function ersterSatz(text: string): { satz: string; rest: string } {
  const treffer = text.match(/^(.+?[.!?])\s+([\s\S]+)$/);
  return treffer ? { satz: treffer[1], rest: treffer[2] } : { satz: text, rest: '' };
}
