<?php

/**
 * NextBridge - Nextcloud integration for Roundcube.
 *
 * Bridges Roundcube with Nextcloud for file operations, calendar, and more.
 * When embedded in Nextcloud, functionality is provided by the parent
 * Nextcloud window via postMessage API.
 *
 * @author Laurent Dinclaux <laurent@gecka.nc>
 * @copyright 2026 Gecka
 * @license AGPL-3.0-or-later
 */

require_once __DIR__ . '/lib/nextbridge_engine.php';

/**
 * NextBridge RoundCube plugin main class.
 *
 * Provides Nextcloud integration for file attachments,
 * cloud storage, and calendar operations.
 */
class nextbridge extends rcube_plugin
{
    /**
     * Task filter - all tasks excluding login and logout.
     *
     * @var string
     */
    public $task = '?(?!login|logout).*';

    /**
     * RoundCube instance.
     *
     * @var rcube
     */
    public $rc;

    /**
     * NextBridge engine instance.
     *
     * @var nextbridge_engine
     */
    private $engine;

    /**
     * Initialize the plugin.
     *
     * @return void
     */
    public function init(): void
    {
        $this->rc = rcube::get_instance();
        $this->add_hook('startup', [$this, 'startup']);
    }

    /**
     * Startup hook handler, initializes NextBridge UI.
     *
     * @param array $args Hook arguments.
     *
     * @return array The hook arguments.
     */
    public function startup(array $args): array
    {
        if ($this->rc->output->type != 'html') {
            return $args;
        }

        if (!$this->engine) {
            $this->engine = new nextbridge_engine($this);
        }

        $this->engine->ui($this);

        return $args;
    }
}
