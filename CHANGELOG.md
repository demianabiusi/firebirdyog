# Changelog

All notable changes to FirebirdYog are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

---

## [1.0.0] — 2026-09-25

### Added
- Initial open source release 🎉
- **SQL Editor** powered by Monaco Editor (VS Code engine)
  - Contextual column autocomplete with alias resolution
  - Firebird keyword and function suggestions
  - SQL formatter with Firebird dialect (`Ctrl+Shift+F`)
  - F9/F5 swap mode (SQLyog-style shortcuts)
  - Multiple named query tabs with per-connection persistence
- **Object Explorer** — tables, views, stored procedures (executable/selectable detection), triggers, generators, domains, exceptions with DDL viewer
- **Results Grid** — virtualized high-performance rendering, in-grid cell editing for single-table queries with PK, BLOB viewer, export to CSV/JSON/SQL
- **Schema & Data Diff** — full metadata comparison between two databases, row-level data diff, migration script generator ordered by dependency
- **Session Monitor (MON$)** — real-time active connections, running statements and transactions, kill query / disconnect session
- **Dump & Import** — export database to SQL script and import with progress tracking
- **SSH Tunnel** — connect through SSH with password or private key
- **Themes** — Light, Dark, Dracula, Tokyo Night, Solarized, Nord
- **Multilingual** — Spanish (default) and English
- Firebird 2.5, 3.0, 4.0, 5.0 compatibility
- Auto-reconnect to last used database on startup
- Window state persistence (size, position, maximized)

### Fixed
- `MON$ATTACHMENTS` query used non-existent column `MON$ROLE_NAME`; corrected to `MON$ROLE`
- `monaco-editor` was missing from `package.json` dependencies causing "Loading..." hang on fresh installs
- Premature `loader.init()` call in `monacoThemes.ts` triggered CDN fetch before local Monaco was configured, blocking editor initialization in Electron's CSP-restricted environment

---

[Unreleased]: https://github.com/demianabiusi/firebirdyog/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/demianabiusi/firebirdyog/releases/tag/v1.0.0
