<?php

namespace Plenty\Plugin\Log;

/**
 * Ersatz fuer Plentys Logger in lokalen Tests (Plenty stellt den echten zur Laufzeit).
 */
trait Loggable
{
    public function getLogger($identifier = '')
    {
        return new class {
            public $eintraege = [];

            public function __call($name, $args)
            {
                $this->eintraege[] = [$name, $args];

                return $this;
            }
        };
    }
}
