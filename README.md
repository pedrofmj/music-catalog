# Music Catalog

A repertoire workspace for sheet music, chord charts, and tablatures. The first
feature is **0.0.0.0-base**, implemented on `feature/base`, focused on the web.

## Run

Requires Node.js 22.13+ and npm. The repository uses npm workspaces.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173).

```sh
npm run check          # Type checking, unit tests, production build
npx playwright install chromium
npm run test:e2e       # Desktop and mobile browser workflows
```

## Base Release

- Responsive repertoire, search, notation filters, favorites, and sorting.
- Songs with multiple documents and instrument/part labels.
- ChordPro charts with preview transposition, MusicXML scores, PDF pages, and text tabs.
- Create/edit songs and chart/tab source; attach, rename, download, and remove documents.
- IndexedDB persistence and portable JSON import/export, including PDF bytes.
- Adjustable zoom, focus mode, and local automatic scrolling.

Three original demonstration pieces are added on the first visit. Removing them
does not cause them to return. Source examples are in [examples](examples/).

**Data is local to this browser and origin.** Export catalog backups before clearing
site data or moving devices. There is no account, server, cross-device sync, native
app, or guaranteed offline app-shell loading yet. Android/iOS packaging and band
sessions are subsequent features, not claims of this release.

## Layout

```text
apps/web/       React UI, browser persistence, document renderers
packages/core/  Shared types, validation, file interchange, repository contract
examples/       Original music fixtures
tests/          Browser acceptance tests
docs/           Versioned specifications and project documentation
```

Start with the [base specification](docs/feature/0.0.0.0-base/spec.md),
[architecture](docs/feature/0.0.0.0-base/architecture.md), and
[file formats](docs/feature/0.0.0.0-base/file-formats.md).
The [documentation convention](docs/README.md) defines all change folders and branches.
