# Verification

Verified on 2026-10-10 with Node.js 25.6.1 on Linux. The supported toolchain minimum
is Node.js 22.13; CI is configured for Node.js 22.

```sh
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

## Results

- TypeScript: passed.
- Generated JSON Schema consistency: passed.
- Unit tests: 17 passed across shared data and IndexedDB suites.
- Browser acceptance tests: 12 passed, six workflows on each of desktop Chromium
  and Chromium with an iPhone 13 viewport/touch configuration.
- Production build: passed. OSMD produces a large-chunk advisory; it is loaded
  on demand, separately from the initial app. PDF rendering and its worker are also split.
- Desktop/mobile screenshots inspected: chart, engraved MusicXML, and rendered PDF.
  PDF canvas checks verify visible ink, and MusicXML checks verify engraved paths.

Unit coverage includes source preservation (UTF-8, BOM, CRLF), embedded PDF byte
round-trips, the 10 MiB PDF boundary, strict schemas, unsupported versions, malformed
imports, conflicting IDs, persistence, transactional imports, and empty-library seeding.

Browser coverage includes creating/editing/favoriting/deleting songs, reload persistence,
chart/tab switching, MusicXML engraving, PDF rendering/download, catalog import/export,
duplicate skipping, invalid batch rejection, preview transposition, zoom, focus mode,
and auto-scroll. Tests run against the production build on port 4173; the development
preview uses port 5173. Screenshots and traces are ignored local test artifacts.

The initial checks exposed a notation badge style collision and a maximum-size
base64 validation stack overflow. Both were corrected; binary decoding was also
changed to avoid the memory cost of constructing a temporary array of characters.

## Limits

Native Android/iOS builds, multiple real devices, network sessions, password-protected
PDFs, complex PDF font coverage, and offline app-shell loading are outside this release.
Mobile viewport tests run in Chromium, not iOS Safari/WebKit. Additional browser
and physical-device coverage is required before a cross-platform release.
