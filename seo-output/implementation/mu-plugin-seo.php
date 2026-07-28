<?php
/**
 * Plugin Name: A&B Solarenergy — SEO REST + Schema (mu-plugin)
 * Description: (1) Schaltet Yoast/Rank-Math-SEO-Metas für die REST-API frei, damit sie per
 *              Application Password automatisiert gesetzt werden können. (2) Gibt LocalBusiness/
 *              Organization- + WebSite-JSON-LD im <head> aus.
 * Version: 1.0.0
 *
 * INSTALLATION:
 *   Diese Datei nach  wp-content/mu-plugins/seo-abse.php  hochladen
 *   (Ordner mu-plugins ggf. anlegen). mu-plugins werden automatisch aktiviert.
 *
 * SICHERHEIT: Meta-Schreibzugriff erfordert 'edit_posts'-Capability (also authentifizierte
 * Anfrage mit ausreichenden Rechten). Alt-Texte/Standard-Metas gehen ohnehin nur mit Auth.
 */

if (!defined('ABSPATH')) exit;

/* ============================================================
 * TEIL 1 — SEO-Meta-Keys für REST-API registrieren
 * ============================================================ */
add_action('init', function () {
    $keys = array(
        // Yoast SEO
        '_yoast_wpseo_title',
        '_yoast_wpseo_metadesc',
        '_yoast_wpseo_focuskw',
        // Rank Math
        'rank_math_title',
        'rank_math_description',
        'rank_math_focus_keyword',
    );
    $post_types = array('post', 'page');
    foreach ($post_types as $pt) {
        foreach ($keys as $key) {
            register_post_meta($pt, $key, array(
                'type'          => 'string',
                'single'        => true,
                'show_in_rest'  => true,
                'auth_callback' => function () {
                    return current_user_can('edit_posts');
                },
            ));
        }
    }
});

/* ============================================================
 * TEIL 2 — JSON-LD Schema im <head>
 *   Vor dem Aktivieren PLATZHALTER unten ersetzen!
 *   Wenn Yoast/Rank Math bereits Organization/LocalBusiness ausgeben, TEIL 2
 *   deaktivieren (Konstante auf false), um Duplikate zu vermeiden.
 * ============================================================ */
if (!defined('ABSE_EMIT_SCHEMA')) define('ABSE_EMIT_SCHEMA', true);

add_action('wp_head', function () {
    if (!ABSE_EMIT_SCHEMA) return;

    $home = untrailingslashit(home_url());

    $graph = array(
        array(
            '@type' => 'Organization',
            '@id'   => $home . '/#organization',
            'name'  => 'A&B Solarenergy GmbH',
            'url'   => $home . '/',
            'logo'  => $home . '/wp-content/uploads/logo.png',   // <<< anpassen
            'email' => 'INFO@EXAMPLE.DE',                        // <<< anpassen
            'telephone' => '+49-XXXX-XXXXXX',                    // <<< anpassen
            'founder' => array(
                array('@type' => 'Person', 'name' => 'Rami Alkhidou'),
                array('@type' => 'Person', 'name' => 'Elias Boulos'),
            ),
            'address' => array(
                '@type' => 'PostalAddress',
                'streetAddress'   => 'Lange Stiege 66',
                'postalCode'      => '46325',
                'addressLocality' => 'Borken',
                'addressRegion'   => 'NRW',
                'addressCountry'  => 'DE',
            ),
            'sameAs' => array(
                // 'https://www.facebook.com/...',   // <<< anpassen/entfernen
            ),
        ),
        array(
            '@type' => array('LocalBusiness', 'ElectricalContractor'),
            '@id'   => $home . '/#localbusiness',
            'name'  => 'A&B Solarenergy GmbH',
            'description' => 'Fachbetrieb für Photovoltaik, Stromspeicher, Wallbox und Wärmepumpe in Borken und im Münsterland.',
            'url'   => $home . '/',
            'telephone' => '+49-XXXX-XXXXXX',                    // <<< anpassen
            'priceRange' => '€€',
            'parentOrganization' => array('@id' => $home . '/#organization'),
            'address' => array(
                '@type' => 'PostalAddress',
                'streetAddress'   => 'Lange Stiege 66',
                'postalCode'      => '46325',
                'addressLocality' => 'Borken',
                'addressRegion'   => 'NRW',
                'addressCountry'  => 'DE',
            ),
            'areaServed' => array(
                array('@type' => 'City', 'name' => 'Borken'),
                array('@type' => 'AdministrativeArea', 'name' => 'Kreis Borken'),
                array('@type' => 'AdministrativeArea', 'name' => 'Münsterland'),
            ),
            'openingHoursSpecification' => array(array(
                '@type' => 'OpeningHoursSpecification',
                'dayOfWeek' => array('Monday','Tuesday','Wednesday','Thursday','Friday'),
                'opens' => '08:00', 'closes' => '17:00',         // <<< anpassen
            )),
        ),
        array(
            '@type' => 'WebSite',
            '@id'   => $home . '/#website',
            'url'   => $home . '/',
            'name'  => 'A&B Solarenergy',
            'inLanguage' => 'de-DE',
            'publisher' => array('@id' => $home . '/#organization'),
            'potentialAction' => array(
                '@type' => 'SearchAction',
                'target' => array(
                    '@type' => 'EntryPoint',
                    'urlTemplate' => $home . '/?s={search_term_string}',
                ),
                'query-input' => 'required name=search_term_string',
            ),
        ),
    );

    $data = array('@context' => 'https://schema.org', '@graph' => $graph);
    echo "\n<script type=\"application/ld+json\">" .
        wp_json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) .
        "</script>\n";
}, 20);
