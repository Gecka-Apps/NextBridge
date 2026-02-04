<?php

/**
 * NextBridge Engine - Nextcloud integration for Roundcube
 *
 * Operations are handled by the Nextcloud bridge via postMessage API.
 * This class only provides UI integration (buttons, scripts).
 *
 * @author Laurent Dinclaux <laurent@gecka.nc>
 * @copyright 2026 Gecka
 * @license AGPL-3.0-or-later
 */

/**
 * NextBridge Engine class.
 *
 * Handles UI integration for Nextcloud features in Roundcube.
 * Operations are handled by the Nextcloud bridge via postMessage API.
 */
class nextbridge_engine
{
    /**
     * Plugin instance.
     *
     * @var nextbridge
     */
    private $plugin;

    /**
     * Constructor.
     *
     * @param nextbridge $plugin The NextBridge plugin instance.
     */
    public function __construct(nextbridge $plugin)
    {
        $this->plugin = $plugin;
    }

    /**
     * Initialize user interface elements.
     *
     * Adds buttons, scripts, and styles for Nextcloud integration.
     *
     * @param nextbridge $plugin The NextBridge plugin instance.
     *
     * @return void
     */
    public function ui(nextbridge $plugin): void
    {
        $plugin->add_texts('localization/');

        $includeScript = false;

        if ($plugin->rc->task == 'mail') {
            if ($plugin->rc->action == 'compose') {
                $includeScript = true;
            } elseif (in_array($plugin->rc->action, array('show', 'preview', 'get'))) {
                $includeScript = true;

                if ($plugin->rc->action == 'get') {
                    // Add "Save as" button into attachment toolbar (attachment preview page)
                    $plugin->add_button(array(
                        'id'         => 'nextbridge-saveas',
                        'name'       => 'nextbridge-saveas',
                        'type'       => 'link',
                        'onclick'    => 'nextbridge_save_attachment(); return false;',
                        'class'      => 'button buttonPas nextbridge-saveas',
                        'classact'   => 'button nextbridge-saveas',
                        'label'      => 'nextbridge.save',
                        'title'      => 'nextbridge.saveto',
                    ), 'toolbar');
                } else {
                    // Add "Save to cloud" button into attachment context menu
                    $plugin->add_button(array(
                        'id'         => 'nextbridge-attachmenusaveas',
                        'name'       => 'nextbridge-attachmenusaveas',
                        'type'       => 'link',
                        'wrapper'    => 'li',
                        'onclick'    => 'nextbridge_save_attachment(this); return false;',
                        'class'      => 'icon active nextbridge-saveas',
                        'classact'   => 'icon active nextbridge-saveas',
                        'innerclass' => 'icon active nextbridge-saveas',
                        'label'      => 'nextbridge.saveto',
                    ), 'attachmentmenu');

                    // Add "Add to calendar" button into attachment context menu (for .ics files)
                    // Hidden by default, shown by JS when attachment is a calendar file
                    $plugin->add_button(array(
                        'id'         => 'nextbridge-addtocalendar',
                        'name'       => 'nextbridge-addtocalendar',
                        'type'       => 'link',
                        'wrapper'    => 'li style="display:none"',
                        'onclick'    => 'nextbridge_add_to_calendar(this); return false;',
                        'class'      => 'icon nextbridge-calendar',
                        'classact'   => 'icon active nextbridge-calendar',
                        'innerclass' => 'icon nextbridge-calendar',
                        'label'      => 'nextbridge.addtocalendar',
                    ), 'attachmentmenu');
                }
            }

            // Add labels for JS
            $plugin->add_label('save', 'cancel', 'saveto', 'saveall', 'fromcloud', 'attaching', 'sharelink', 'linkinserted', 'addtocalendar', 'eventadded', 'eventupdated', 'selectcalendar');
        }

        // Include CSS
        $plugin->include_stylesheet($plugin->local_skin_path() . '/style.css');

        // Include JS
        if ($includeScript) {
            $plugin->include_script('nextbridge.js');
        }
    }
}
