# Changelog

## [1.1.0] - 2026-02-09

### Changed

- Refactor duplicated patterns into shared helpers (`nextbridge_get_filename_from_dom`, `nextbridge_download_and_save`)
- Externalize all hardcoded UI messages to localization files (en_US, fr_FR, de_DE, pt_BR)

### Security

- Escape share link URL before HTML insertion to prevent XSS
- Validate calendar color format before style attribute injection
- Wrap raw bridge error messages in localized labels

### Added

- Composer installation support via `roundcube/plugin-installer`
- Roundcube metadata (`min-version`, `persistent-files`) in `composer.json`
- New localized label: `sharelinkerror`

### Fixed

- Incorrect repository URL for `mail_roundcube` in README

## [1.0.0] - 2026-02-05

### Added

- 🌊 First wave
