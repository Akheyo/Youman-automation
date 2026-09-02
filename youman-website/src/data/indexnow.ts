/**
 * Schlüssel für IndexNow.
 *
 * Kein Geheimnis: Er wird unter /<schluessel>.txt öffentlich ausgeliefert,
 * genau das ist der Nachweis, dass wir die Domain kontrollieren. Mit ihm
 * lassen sich ausschließlich Adressen dieser Domain melden, sonst nichts.
 * Deshalb steht er im Code und nicht in einem Secret: Ihn zu verstecken
 * würde nur sicherer aussehen, ohne es zu sein.
 *
 * Austauschen lässt er sich jederzeit. Hier ändern, dann liegt beim
 * nächsten Build die neue Datei unter der neuen Adresse, und der Workflow
 * meldet mit dem neuen Schlüssel.
 *
 * Format: 8 bis 128 Zeichen, nur a bis z, A bis Z, 0 bis 9 und Bindestrich.
 */
export const indexNowSchluessel = 'a7f3c2e9b41d4856ae0f92c7d3b18e64';
