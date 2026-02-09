/**
 * NextBridge - Nextcloud integration for Roundcube
 *
 * Provides seamless integration with Nextcloud when Roundcube is embedded
 * via the nextcloud-roundcube app. Communicates with Nextcloud through
 * postMessage API to access files, calendars, and other services.
 *
 * @author Laurent Dinclaux <laurent@gecka.nc>
 * @copyright 2026 Gecka
 * @license AGPL-3.0-or-later
 */

// Store current attachment ID and MIME type when menu opens
var nextbridge_current_attachment_id = null;
var nextbridge_current_attachment_mime = null;

window.rcmail && rcmail.addEventListener('init', function () {
    var hasAttachments = rcmail.env.attachments && Object.keys(rcmail.env.attachments).length > 0;

    // Listen for attachment menu opening to capture the attachment ID and enable/disable calendar button
    rcmail.addEventListener('menu-open', function(e) {
        if (e.name == 'attachmentmenu' && e.props && e.props.id) {
            nextbridge_current_attachment_id = e.props.id;

            // Get MIME type from attachment data
            // Format can be either { id: "mimetype" } or { id: { mimetype: "...", name: "..." } }
            var attData = rcmail.env.attachments ? rcmail.env.attachments[e.props.id] : null;
            var mimeType = null;
            var filename = '';

            if (typeof attData === 'string') {
                // Simple format: attData is the MIME type directly
                mimeType = attData;
                // Try to get filename from DOM
                filename = nextbridge_get_filename_from_dom(e.props.id);
            } else if (attData && typeof attData === 'object') {
                // Object format
                mimeType = attData.mimetype;
                filename = attData.name || attData.filename || '';
            }

            nextbridge_current_attachment_mime = mimeType;

            // Show/hide calendar button based on file type
            var calendarBtn = $('#nextbridge-addtocalendar');
            if (calendarBtn.length) {
                var isCalendarFile = nextbridge_is_calendar_file(mimeType, filename);
                calendarBtn.closest('li').toggle(isCalendarFile);
            }
        }
    });

    if (rcmail.task == 'mail') {
        if (rcmail.env.action == 'compose') {
            // Add "Attach from cloud" button
            var elem = $('#compose-attachments > div');
            var attachBtn = $('<button class="btn btn-secondary nextbridge-attach nextbridge-cloud" type="button">')
                .attr('tabindex', $('button', elem).attr('tabindex') || 0)
                .text(rcmail.gettext('nextbridge.fromcloud'))
                .click(function () { nextbridge_selector_dialog(); });
            elem.append('<br />', attachBtn);

            // Add "Insert share link" button
            var shareLinkBtn = $('<button class="btn btn-secondary nextbridge-attach nextbridge-sharelink" type="button">')
                .attr('tabindex', $('button', elem).attr('tabindex') || 0)
                .text(rcmail.gettext('nextbridge.sharelink'))
                .click(function () { nextbridge_insert_share_link(); });
            elem.append('<br />', shareLinkBtn);

            // Register commands to skip warning message on compose page
            $.merge(rcmail.env.compose_commands, ['files-list', 'files-sort', 'files-search', 'files-search-reset']);
        }
        // Mail preview - add "Save all" button
        else if ((rcmail.env.action == 'show' || rcmail.env.action == 'preview') && hasAttachments) {
            var header_links = $('#message-header .header-links');
            if (header_links.length) {
                var existingBtn = header_links.find('.nextbridge-saveall');
                if (existingBtn.length) {
                    existingBtn.off('click').on('click', function (e) {
                        e.preventDefault();
                        nextbridge_save_all_attachments();
                        return false;
                    });
                } else {
                    header_links.append(
                        $('<a href="#" class="button nextbridge-saveall">')
                            .text(rcmail.gettext('nextbridge.saveall'))
                            .on('click', function (e) {
                                e.preventDefault();
                                nextbridge_save_all_attachments();
                                return false;
                            })
                    );
                }
            }
        }
    }
});

/**
 * Get the Nextcloud bridge, searching up the frame hierarchy if needed.
 */
function nextbridge_get_bridge() {
    // Check current window first
    if (window.NextcloudBridge) {
        return window.NextcloudBridge;
    }
    // Check parent windows (Roundcube may use nested iframes)
    var win = window;
    while (win !== win.parent) {
        win = win.parent;
        try {
            if (win.NextcloudBridge) {
                return win.NextcloudBridge;
            }
        } catch (e) {
            // Cross-origin access denied
            break;
        }
    }
    return null;
}

/**
 * Check if Nextcloud file bridge is available.
 */
function nextbridge_has_bridge() {
    return !!nextbridge_get_bridge();
}

/**
 * File picker dialog - pick files from Nextcloud and attach to email.
 */
function nextbridge_selector_dialog() {
    if (!nextbridge_has_bridge()) {
        rcmail.display_message(rcmail.gettext('nextbridge.bridgeunavailable'), 'error');
        return;
    }

    var id = Date.now();

    // Show loading indicator
    rcmail.add2attachment_list(id, {
        name: '',
        html: '<span>' + rcmail.get_label('nextbridge.attaching') + '</span>',
        classname: 'uploading',
        complete: false,
    });

    // Open Nextcloud file picker via bridge
    nextbridge_get_bridge().pickFiles({ multiple: true })
        .then(function(files) {
            if (!files || !files.length) {
                rcmail.remove_from_attachment_list(id);
                return;
            }

            // Process each file
            var processed = 0;
            files.forEach(function(file, index) {
                var fileId = id + '_' + index;

                // Convert base64 to blob
                var blob = nextbridge_get_bridge().base64ToBlob(file.content, file.mimeType);
                var fileObj = new File([blob], file.name, { type: file.mimeType });

                // Upload to Roundcube
                var formData = new FormData();
                formData.append('_attachments[]', fileObj);
                formData.append('_id', rcmail.env.compose_id);
                formData.append('_uploadid', fileId);
                formData.append('_token', rcmail.env.request_token);

                var uploadUrl = rcmail.env.comm_path
                    + '&_action=upload'
                    + '&_remote=1'
                    + '&_from=compose'
                    + '&_id=' + encodeURIComponent(rcmail.env.compose_id)
                    + '&_uploadid=' + encodeURIComponent(fileId);

                $.ajax({
                    url: uploadUrl,
                    type: 'POST',
                    data: formData,
                    processData: false,
                    contentType: false,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-Roundcube-Request': rcmail.env.request_token
                    },
                    xhrFields: { withCredentials: true },
                    success: function(response) {
                        processed++;
                        if (typeof response === 'string') {
                            try { response = JSON.parse(response); } catch (e) {}
                        }
                        if (processed === files.length) {
                            rcmail.remove_from_attachment_list(id);
                        }
                        if (response && response.exec) {
                            var execCode = response.exec.replace(/this\./g, 'rcmail.');
                            eval(execCode);
                        }
                    },
                    error: function(xhr, status, error) {
                        processed++;
                        if (processed === files.length) {
                            rcmail.remove_from_attachment_list(id);
                        }
                        rcmail.display_message(rcmail.gettext('nextbridge.uploadfailed').replace('$name', file.name), 'error');
                    }
                });
            });
        })
        .catch(function() {
            rcmail.remove_from_attachment_list(id);
            // Silent - user cancelled or timeout
        });
}

/**
 * Save a single attachment to Nextcloud.
 * Called from onclick handler on attachment menu button.
 *
 * @param {HTMLElement} btn - The button element (used to get attachment ID from menu context)
 */
function nextbridge_save_attachment(btn) {
    if (!nextbridge_has_bridge()) {
        rcmail.display_message(rcmail.gettext('nextbridge.bridgeunavailable'), 'error');
        return;
    }

    var attachmentId = null;
    var filename = null;

    // Get attachment ID from menu context
    if (rcmail.env.action == 'get') {
        // Attachment preview page
        attachmentId = rcmail.env.part;
        filename = rcmail.env.filename;
    } else {
        // Get ID from stored attachment ID (set when menu opens)
        attachmentId = nextbridge_current_attachment_id;
        // Try to get filename from attachment element
        if (attachmentId) {
            filename = nextbridge_get_filename_from_dom(attachmentId);
        }
    }

    if (!attachmentId || !filename) {
        rcmail.display_message(rcmail.gettext('nextbridge.attachmenterror'), 'error');
        return;
    }

    nextbridge_save_attachment_to_cloud(attachmentId, filename);
}

/**
 * Save all attachments to Nextcloud.
 */
function nextbridge_save_all_attachments() {
    if (!nextbridge_has_bridge()) {
        rcmail.display_message(rcmail.gettext('nextbridge.bridgeunavailable'), 'error');
        return;
    }

    var attachments = [];
    $.each(rcmail.env.attachments || {}, function(attId, attData) {
        // Get filename from various sources
        var filename = attData.name || attData.filename;

        // If no filename found, try to get it from the DOM element
        if (!filename) {
            filename = nextbridge_get_filename_from_dom(attId);
        }

        // Skip if we still can't get a valid filename
        if (!filename || filename === attId) {
            return; // Skip this attachment
        }

        attachments.push({
            id: attId,
            filename: filename
        });
    });

    if (!attachments.length) {
        rcmail.display_message(rcmail.gettext('nextbridge.noattachments'), 'warning');
        return;
    }

    var lock = rcmail.set_busy(true, 'saving');
    var bridge = nextbridge_get_bridge();

    // Download all attachments first, then save them all at once
    var filesToSave = [];
    var downloadPromises = attachments.map(function(attachment) {
        return nextbridge_download_attachment(attachment.id).then(function(data) {
            filesToSave.push({
                filename: attachment.filename,
                content: data.base64,
                mimeType: data.mimeType
            });
        }).catch(function() {
            // Silent - download failed
        });
    });

    Promise.all(downloadPromises).then(function() {
        if (!filesToSave.length) {
            rcmail.set_busy(false, null, lock);
            rcmail.display_message(rcmail.gettext('nextbridge.downloaderror'), 'error');
            return;
        }

        // Save all files at once (single folder picker)
        return bridge.saveFiles(filesToSave);
    }).then(function(savedPath) {
        rcmail.set_busy(false, null, lock);
        if (savedPath) {
            rcmail.display_message(rcmail.gettext('nextbridge.attachmentssaved').replace('$count', filesToSave.length), 'confirmation');
        }
    }).catch(function(error) {
        rcmail.set_busy(false, null, lock);
        var errorMessage = error && error.message ? error.message : String(error);
        if (errorMessage !== 'Cancelled') {
            rcmail.display_message(rcmail.gettext('nextbridge.saveallerror'), 'error');
        }
        // Silent if cancelled
    });
}

/**
 * Download an attachment from Roundcube and return base64 content.
 */
function nextbridge_download_attachment(attachmentId) {
    var downloadUrl = rcmail.url('get', {
        _uid: rcmail.env.uid,
        _mbox: rcmail.env.mailbox,
        _part: attachmentId,
        _download: 1,
        _token: rcmail.env.request_token
    });

    return fetch(downloadUrl, {
        credentials: 'include',
        headers: {
            'X-Roundcube-Request': rcmail.env.request_token
        }
    })
        .then(function(response) {
            if (!response.ok) {
                throw new Error('Failed to fetch attachment');
            }
            return response.blob();
        })
        .then(function(blob) {
            return nextbridge_get_bridge().blobToBase64(blob).then(function(base64) {
                return {
                    base64: base64,
                    mimeType: blob.type || 'application/octet-stream'
                };
            });
        });
}

/**
 * Save a single attachment to Nextcloud.
 */
function nextbridge_save_attachment_to_cloud(attachmentId, filename) {
    var lock = rcmail.set_busy(true, 'saving');

    nextbridge_download_and_save(attachmentId, filename, function(success, error) {
        rcmail.set_busy(false, null, lock);
        if (success) {
            rcmail.display_message(rcmail.gettext('nextbridge.attachmentsaved'), 'confirmation');
        } else if (error !== 'Cancelled') {
            rcmail.display_message(rcmail.gettext('nextbridge.saveerror'), 'error');
        }
        // Silent if cancelled by user
    });
}

/**
 * Download attachment from Roundcube and save to Nextcloud via bridge.
 */
function nextbridge_download_and_save(attachmentId, filename, callback) {
    nextbridge_download_attachment(attachmentId)
        .then(function(data) {
            return nextbridge_get_bridge().saveFile(filename, data.base64, data.mimeType);
        })
        .then(function() {
            callback(true, null);
        })
        .catch(function(error) {
            var errorMessage = error && error.message ? error.message : String(error);
            callback(false, errorMessage);
        });
}

/**
 * Insert a share link into the email body.
 * Opens the Nextcloud file picker, creates a public share link, and inserts it.
 */
function nextbridge_insert_share_link() {
    if (!nextbridge_has_bridge()) {
        rcmail.display_message(rcmail.gettext('nextbridge.bridgeunavailable'), 'error');
        return;
    }

    var lock = rcmail.set_busy(true, 'loading');

    nextbridge_get_bridge().createShareLink()
        .then(function(result) {
            rcmail.set_busy(false, null, lock);
            if (result && result.url) {
                // Insert the link into the email body
                var linkHtml = '<a href="' + result.url + '">' + result.url + '</a>';
                nextbridge_insert_at_cursor(linkHtml);
                rcmail.display_message(rcmail.gettext('nextbridge.linkinserted'), 'confirmation');
            }
        })
        .catch(function(error) {
            rcmail.set_busy(false, null, lock);
            var errorMessage = error && error.message ? error.message : String(error);
            if (errorMessage !== 'Cancelled') {
                rcmail.display_message(errorMessage, 'error');
            }
            // Silent if cancelled
        });
}

/**
 * Insert HTML content at the cursor position in the email editor.
 * Works with both TinyMCE (HTML mode) and plain text editor.
 */
function nextbridge_insert_at_cursor(html) {
    // Check if TinyMCE editor is active
    if (window.tinyMCE && tinyMCE.activeEditor && !tinyMCE.activeEditor.isHidden()) {
        // Insert in TinyMCE (HTML editor)
        tinyMCE.activeEditor.execCommand('mceInsertContent', false, html);
    } else {
        // Plain text mode - insert URL only (strip HTML)
        var plainText = html.replace(/<[^>]*>/g, '');
        var textarea = $('#composebody');
        if (textarea.length) {
            var cursorPos = textarea[0].selectionStart;
            var textBefore = textarea.val().substring(0, cursorPos);
            var textAfter = textarea.val().substring(cursorPos);
            textarea.val(textBefore + plainText + textAfter);
            // Move cursor after inserted text
            var newPos = cursorPos + plainText.length;
            textarea[0].setSelectionRange(newPos, newPos);
            textarea.focus();
        }
    }
}

// Legacy function names for compatibility
function nextbridge_directory_selector_dialog(id) {
    if (id) {
        // Single attachment save
        var filename = nextbridge_get_filename_from_dom(id);
        if (filename) {
            nextbridge_save_attachment_to_cloud(id, filename);
        }
    } else {
        // Save all
        nextbridge_save_all_attachments();
    }
}

/**
 * Check if a file is a calendar file based on MIME type or filename.
 *
 * @param {string} mimeType - The MIME type of the attachment
 * @param {string} filename - The filename of the attachment
 * @returns {boolean}
 */
function nextbridge_is_calendar_file(mimeType, filename) {
    // Check MIME type
    if (mimeType) {
        var calendarMimeTypes = [
            'text/calendar',
            'application/ics',
            'text/x-vcalendar'
        ];
        if (calendarMimeTypes.indexOf(mimeType.toLowerCase()) !== -1) {
            return true;
        }
    }

    // Check file extension
    if (filename) {
        var ext = filename.split('.').pop().toLowerCase();
        if (ext === 'ics' || ext === 'ical' || ext === 'ifb' || ext === 'vcs') {
            return true;
        }
    }

    return false;
}

/**
 * Add a calendar attachment to Nextcloud Calendar.
 * Called from onclick handler on attachment menu button.
 *
 * @param {HTMLElement} btn - The button element
 */
function nextbridge_add_to_calendar(btn) {
    if (!nextbridge_has_bridge()) {
        rcmail.display_message(rcmail.gettext('nextbridge.bridgeunavailable'), 'error');
        return;
    }

    var attachmentId = nextbridge_current_attachment_id;
    if (!attachmentId) {
        rcmail.display_message(rcmail.gettext('nextbridge.attachmenterror'), 'error');
        return;
    }

    // Check if it's a calendar file
    // Format can be either { id: "mimetype" } or { id: { mimetype: "...", name: "..." } }
    var attData = rcmail.env.attachments ? rcmail.env.attachments[attachmentId] : null;
    var mimeType = nextbridge_current_attachment_mime;
    var filename = '';

    if (typeof attData === 'string') {
        mimeType = attData;
    } else if (attData && typeof attData === 'object') {
        mimeType = attData.mimetype || mimeType;
        filename = attData.name || attData.filename || '';
    }

    if (!nextbridge_is_calendar_file(mimeType, filename)) {
        rcmail.display_message(rcmail.gettext('nextbridge.notcalendarfile'), 'error');
        return;
    }

    var lock = rcmail.set_busy(true, 'loading');

    // First download the ICS content
    nextbridge_download_attachment_text(attachmentId)
        .then(function(icsContent) {
            // Then get the list of calendars
            return nextbridge_get_bridge().getCalendars()
                .then(function(calendars) {
                    rcmail.set_busy(false, null, lock);

                    if (!calendars || !calendars.length) {
                        rcmail.display_message(rcmail.gettext('nextbridge.nocalendars'), 'error');
                        return;
                    }

                    // Show calendar picker dialog
                    nextbridge_show_calendar_picker(calendars, icsContent);
                });
        })
        .catch(function(error) {
            rcmail.set_busy(false, null, lock);
            var errorMessage = error && error.message ? error.message : String(error);
            rcmail.display_message(rcmail.gettext('nextbridge.calendarerror').replace('$error', errorMessage), 'error');
        });
}

/**
 * Download an attachment from Roundcube and return text content.
 *
 * @param {string} attachmentId - The attachment ID
 * @returns {Promise<string>}
 */
function nextbridge_download_attachment_text(attachmentId) {
    var downloadUrl = rcmail.url('get', {
        _uid: rcmail.env.uid,
        _mbox: rcmail.env.mailbox,
        _part: attachmentId,
        _download: 1,
        _token: rcmail.env.request_token
    });

    return fetch(downloadUrl, {
        credentials: 'include',
        headers: {
            'X-Roundcube-Request': rcmail.env.request_token
        }
    })
        .then(function(response) {
            if (!response.ok) {
                throw new Error('Failed to fetch attachment');
            }
            return response.text();
        });
}

/**
 * Show a dialog to pick a calendar and add the event.
 *
 * @param {Array} calendars - List of available calendars
 * @param {string} icsContent - The ICS content to add
 */
function nextbridge_show_calendar_picker(calendars, icsContent) {
    // Build dialog HTML
    var dialogHtml = '<div id="nextbridge-calendar-dialog">' +
        '<p>' + rcmail.gettext('nextbridge.selectcalendar') + '</p>' +
        '<select id="nextbridge-calendar-select" class="form-control">';

    calendars.forEach(function(cal, index) {
        var colorStyle = cal.color ? ' style="border-left: 4px solid ' + cal.color + '; padding-left: 8px;"' : '';
        dialogHtml += '<option value="' + index + '"' + colorStyle + '>' + nextbridge_escape_html(cal.displayname) + '</option>';
    });

    dialogHtml += '</select></div>';

    // Create jQuery UI dialog
    var dialog = $(dialogHtml).dialog({
        title: rcmail.gettext('nextbridge.addtocalendar'),
        modal: true,
        width: 400,
        buttons: [
            {
                text: rcmail.gettext('nextbridge.cancel'),
                'class': 'btn btn-secondary',
                click: function() {
                    $(this).dialog('close');
                }
            },
            {
                text: rcmail.gettext('nextbridge.save'),
                'class': 'btn btn-primary',
                click: function() {
                    var selectedIndex = $('#nextbridge-calendar-select').val();
                    var selectedCalendar = calendars[selectedIndex];
                    $(this).dialog('close');
                    nextbridge_save_to_calendar(selectedCalendar.url, icsContent);
                }
            }
        ],
        close: function() {
            $(this).dialog('destroy').remove();
        }
    });
}

/**
 * Save the ICS content to the selected calendar.
 *
 * @param {string} calendarUrl - The calendar URL
 * @param {string} icsContent - The ICS content
 */
function nextbridge_save_to_calendar(calendarUrl, icsContent) {
    var lock = rcmail.set_busy(true, 'saving');

    nextbridge_get_bridge().addToCalendar(calendarUrl, icsContent)
        .then(function(result) {
            rcmail.set_busy(false, null, lock);
            var messageKey = result && result.updated ? 'nextbridge.eventupdated' : 'nextbridge.eventadded';
            rcmail.display_message(rcmail.gettext(messageKey), 'confirmation');
        })
        .catch(function(error) {
            rcmail.set_busy(false, null, lock);
            var errorMessage = error && error.message ? error.message : String(error);
            if (errorMessage !== 'Cancelled') {
                rcmail.display_message(rcmail.gettext('nextbridge.eventadderror').replace('$error', errorMessage), 'error');
            }
        });
}

/**
 * Get the filename of an attachment from its DOM element.
 *
 * @param {string} attId - The attachment ID
 * @returns {string} The filename, or empty string if not found
 */
function nextbridge_get_filename_from_dom(attId) {
    var escapedId = attId.toString().replace(/([.:#\[\]])/g, '\\$1');
    var attach = $('#attach' + escapedId).find('a').first();
    var filename = attach.attr('title');
    if (!filename) {
        attach = attach.clone();
        $('.attachment-size', attach).remove();
        filename = $.trim(attach.text());
    }
    return filename || '';
}

/**
 * Escape HTML special characters.
 *
 * @param {string} text - Text to escape
 * @returns {string}
 */
function nextbridge_escape_html(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
