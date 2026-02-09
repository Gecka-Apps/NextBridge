# NextBridge

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Roundcube](https://img.shields.io/badge/Roundcube-1.6+-37BEFF)](https://roundcube.net)

Nextcloud integration for Roundcube.

## About

NextBridge is a Roundcube plugin that enables seamless Nextcloud integration when using Roundcube embedded inside Nextcloud.

## Features

- Attach files from Nextcloud storage to emails
- Insert public share links into email body
- Save email attachments directly to Nextcloud storage
- Save all attachments from an email to Nextcloud with one click
- Add calendar invitations (.ics) directly to Nextcloud Calendar

## How It Works

This plugin uses the Nextcloud file bridge provided by a compatible Nextcloud app. When Roundcube is embedded in Nextcloud via an iframe, the plugin communicates with Nextcloud using the postMessage API to:

1. Open the native Nextcloud file picker when attaching files
2. Open the native Nextcloud folder picker when saving attachments
3. Transfer files via WebDAV using the existing Nextcloud session
4. Add calendar events via CalDAV to Nextcloud Calendar

All file and calendar operations are executed by Nextcloud itself - Roundcube only sends requests via postMessage to the parent window.

## Requirements

- Roundcube 1.6+
- One of the following Nextcloud apps with bridge support enabled:
  - [mail_roundcube_bridge](https://github.com/Gecka-Apps/nextcloud-roundcube-bridge) - Companion app for nextcloud-roundcube
  - [mail_roundcube](https://github.com/rotdrop/nextcloud-roundcube) - *(pull request pending)*

## License

This plugin is released under the [GNU Affero General Public License Version 3](https://www.gnu.org/licenses/agpl-3.0.html).

## Installation

### Prerequisites

1. Install a compatible Nextcloud app:
   - **Option A:** Install [nextcloud-roundcube](https://github.com/rotdrop/nextcloud-roundcube) + [nextcloud-roundcube-bridge](https://github.com/Gecka-Apps/nextcloud-roundcube-bridge)
   - **Option B:** Install [nextcloud-roundcube](https://github.com/rotdrop/nextcloud-roundcube) with bridge support *([pull request #57](https://github.com/rotdrop/nextcloud-roundcube/pull/57))*

2. Enable the bridge in the Nextcloud admin settings

### Install with Composer (recommended)

Navigate to your Roundcube installation directory and run:

```bash
composer require gecka/nextbridge
```

The [roundcube/plugin-installer](https://github.com/roundcube/plugin-installer) will automatically place the plugin in the correct `plugins/` directory and offer to enable it.

> **Don't have Composer?** See [getcomposer.org](https://getcomposer.org/download/) for installation instructions.

> **Running as root on a VPS?** Roundcube files are typically owned by `www-data`. Run Composer as the web server user to avoid permission issues:
> ```bash
> sudo -u www-data composer require gecka/nextbridge
> ```

### Install manually

1. Place this plugin folder into the plugins directory of Roundcube:
   ```bash
   cd /path/to/roundcube/plugins/
   git clone https://github.com/Gecka-Apps/NextBridge.git nextbridge
   ```

2. Add `nextbridge` to `$config['plugins']` in your Roundcube config:
   ```php
   $config['plugins'] = array('nextbridge', /* other plugins */);
   ```

### Done

The plugin automatically detects when the Nextcloud file bridge is available. No additional configuration is required.

## Authors

- **Laurent Dinclaux** <laurent@gecka.nc> - Gecka

## Related Projects

- [mail_roundcube](https://github.com/rotdrop/nextcloud-roundcube) - Nextcloud app that embeds RoundCube
- [mail_roundcube_bridge](https://github.com/Gecka-Apps/nextcloud-roundcube-bridge) - Nextcloud app providing the bridge API

---

Built with 🥥 and ☕ by [Gecka](https://gecka.nc) — Kanaky-New Caledonia 🇳🇨
