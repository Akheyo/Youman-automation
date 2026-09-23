<?php

/**
 * Laedt eine Datei und gibt sie base64-kodiert zurueck.
 *
 * Fuer die Bilder: Maschinensucher nimmt sie nicht als Adresse entgegen,
 * sondern will den Inhalt. Die Bilder liegen aber auf Plentys Bildserver,
 * also muessen sie erst geholt werden.
 *
 *   status  int    HTTP-Status
 *   base64  string der Inhalt, leer im Fehlerfall
 *   bytes   int    Groesse vor der Kodierung
 *   fehler  string leer, wenn alles glattging
 */

$url = (string) SdkRestApi::getParam('url', '');
$hoechstens = (int) SdkRestApi::getParam('hoechstens', 10485760); // 10 MB, wie die API sie zulaesst

$antwort = array('status' => 0, 'base64' => '', 'bytes' => 0, 'fehler' => '');

if ($url === '') {
    $antwort['fehler'] = 'Keine Adresse angegeben.';
    return $antwort;
}

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_MAXREDIRS, 3);
curl_setopt($ch, CURLOPT_TIMEOUT, 60);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);

$inhalt = curl_exec($ch);
$antwort['status'] = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);

if ($inhalt === false) {
    $antwort['fehler'] = 'Bild nicht ladbar: ' . curl_error($ch);
    curl_close($ch);
    return $antwort;
}
curl_close($ch);

$groesse = strlen($inhalt);
$antwort['bytes'] = $groesse;

if ($antwort['status'] < 200 || $antwort['status'] >= 300) {
    $antwort['fehler'] = 'Bildserver antwortet mit ' . $antwort['status'] . '.';
    return $antwort;
}

if ($groesse > $hoechstens) {
    // Lieber ohne dieses Bild als mit einem abgelehnten Aufruf.
    $antwort['fehler'] = 'Bild ist groesser als erlaubt (' . $groesse . ' Bytes).';
    return $antwort;
}

$antwort['base64'] = base64_encode($inhalt);

return $antwort;
