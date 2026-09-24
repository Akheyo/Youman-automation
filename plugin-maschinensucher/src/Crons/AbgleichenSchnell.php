<?php

namespace MaschinensucherMarkt\Crons;

/**
 * Derselbe Abgleich im Fuenf-Minuten-Takt.
 *
 * Eigene Klasse, damit er im Protokoll vom 15-Minuten-Plan zu unterscheiden
 * ist: So laesst sich ablesen, ob Plenty den Fuenf-Minuten-Takt auf diesem
 * System ueberhaupt ausfuehrt. Der 15-Minuten-Plan bleibt als Netz
 * angemeldet; die Sperre in Abgleichen verhindert, dass beide gleichzeitig
 * arbeiten.
 */
class AbgleichenSchnell extends Abgleichen
{
    protected function name()
    {
        return 'Abgleich (5 Minuten)';
    }
}
