<?php

/**
 * Einziger Weg nach draussen: Plenty-Plugins duerfen selbst keine HTTP-Aufrufe
 * machen, externe SDK-Skripte schon (sie laufen auf getrennten Servern).
 *
 * Parameter (ueber LibraryCallContract):
 *   method   GET | POST | PUT | PATCH | DELETE
 *   url      vollstaendige Adresse
 *   headers  zusaetzliche Header
 *   json     Body als JSON (Array) – oder
 *   form     Body als Formular (Token-Endpunkt)
 *
 * Rueckgabe: ['status' => int, 'body' => array|string, 'error' => string]
 * status 0 = keine Antwort (Netzwerk, Zeitueberschreitung).
 */

$method = strtoupper((string)SdkRestApi::getParam('method', 'GET'));
$url = (string)SdkRestApi::getParam('url', '');
$headers = SdkRestApi::getParam('headers', []);
$json = SdkRestApi::getParam('json', null);
$form = SdkRestApi::getParam('form', null);

$options = [
    'http_errors'     => false,
    'timeout'         => 60,
    'connect_timeout' => 15,
    'headers'         => array_merge(['Accept' => 'application/json'], is_array($headers) ? $headers : []),
];
if (is_array($form)) {
    $options['form_params'] = $form;
} elseif ($json !== null) {
    $options['body'] = json_encode($json, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $options['headers']['Content-Type'] = 'application/json';
}

try {
    $client = new \GuzzleHttp\Client();
    $response = $client->request($method, $url, $options);
    $raw = (string)$response->getBody();
    $decoded = json_decode($raw, true);

    return [
        'status' => $response->getStatusCode(),
        'body'   => is_array($decoded) ? $decoded : mb_substr($raw, 0, 2000),
        'error'  => '',
    ];
} catch (\Throwable $e) {
    return [
        'status' => 0,
        'body'   => '',
        'error'  => get_class($e) . ': ' . $e->getMessage(),
    ];
}
