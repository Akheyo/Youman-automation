<?php

/**
 * Der einzige Weg dieses Plugins nach draussen.
 *
 * Im Plugin-Code selbst ist kein HTTP moeglich: Der Build laesst dort weder
 * "new" noch curl zu. Plenty fuehrt Dateien unter resources/lib dagegen
 * ausserhalb dieses Sandkastens aus — deshalb liegt der Aufruf hier und wird
 * ueber LibraryCallContract angestossen.
 *
 * Rueckgabe ist immer ein Array mit denselben Schluesseln, auch im Fehlerfall.
 * Wer diese Funktion aufruft, soll nie zwischen "Antwort" und "Ausnahme"
 * unterscheiden muessen:
 *
 *   status  int    HTTP-Status, 0 wenn die Verbindung gar nicht zustande kam
 *   daten   array  die ausgelesene JSON-Antwort
 *   roh     string die ersten 2000 Zeichen der Antwort, fuer die Fehlersuche
 *   fehler  string leer, wenn alles glattging
 */

$basis    = (string) SdkRestApi::getParam('basis', 'https://api.machineseeker.com');
$pfad     = (string) SdkRestApi::getParam('pfad', '');
$methode  = strtoupper((string) SdkRestApi::getParam('methode', 'GET'));
$token    = (string) SdkRestApi::getParam('token', '');
$koerper  = SdkRestApi::getParam('koerper', null);
$abfrage  = SdkRestApi::getParam('abfrage', array());
$zeitlimit = (int) SdkRestApi::getParam('zeitlimit', 60);

$antwort = array('status' => 0, 'daten' => array(), 'roh' => '', 'fehler' => '');

if ($token === '') {
    $antwort['fehler'] = 'Kein API-Token hinterlegt.';
    return $antwort;
}

$url = rtrim($basis, '/') . '/' . ltrim($pfad, '/');
if (is_array($abfrage) && count($abfrage) > 0) {
    $url .= '?' . http_build_query($abfrage);
}

$kopfzeilen = array(
    'Authorization: Bearer ' . $token,
    'Accept: application/json',
);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $methode);
curl_setopt($ch, CURLOPT_TIMEOUT, $zeitlimit);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);

if ($koerper !== null) {
    $json = json_encode($koerper);
    $kopfzeilen[] = 'Content-Type: application/json';
    $kopfzeilen[] = 'Content-Length: ' . strlen($json);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
}

curl_setopt($ch, CURLOPT_HTTPHEADER, $kopfzeilen);

$roh = curl_exec($ch);
$antwort['status'] = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);

if ($roh === false) {
    // Verbindungsfehler, nicht Ablehnung: Der Unterschied entscheidet
    // spaeter darueber, ob ein Inserat als verarbeitet gilt.
    $antwort['fehler'] = 'Verbindung fehlgeschlagen: ' . curl_error($ch);
    curl_close($ch);
    return $antwort;
}
curl_close($ch);

$antwort['roh'] = substr((string) $roh, 0, 2000);

$gelesen = json_decode((string) $roh, true);
if (is_array($gelesen)) {
    $antwort['daten'] = $gelesen;
} elseif ($antwort['status'] >= 200 && $antwort['status'] < 300) {
    $antwort['fehler'] = 'Antwort war kein JSON.';
}

return $antwort;
