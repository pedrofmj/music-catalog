# Music Catalog Base

- Version: `0.0.0.0`
- Type: `feature`
- Slug: `base`
- Branch: `feature/base`
- Status: Implemented; validation recorded in [verification.md](verification.md)

## Context

Build a repertoire containing sheet music/music scores, chord charts/chord symbols,
and tablatures/tabs. The eventual product must serve web, Android, and iOS, with
band members reading individual parts and authorized leaders controlling shared
scrolling. This first increment establishes the web experience and portable data.

## Scope

1. An npm workspace with a React/TypeScript web app and reusable domain package.
2. A responsive library/reader layout. Desktop shows both panes; mobile opens the
   reader from the library and provides a back action. Focus mode expands the reader.
3. Create, edit, delete, search, filter, sort, and favorite songs. Song metadata
   includes title, artist/composer, key, tempo, time signature, and tags.
4. Associate multiple notation documents and instrument/part labels with a song.
5. Render ChordPro charts, uncompressed partwise MusicXML, PDFs, and UTF-8 text tabs.
6. Edit chart/tab source and document metadata. PDF category may be changed to
   sheet music, chord chart, or tablature without altering its bytes.
7. Persist locally in IndexedDB. Seed three original examples only on first use.
8. Import source files or versioned JSON backups; export a song, the full catalog,
   or an original document. Imports validate the whole selected batch before writes.
9. Zoom, temporary ChordPro transposition, and local adjustable auto-scroll. Pause
   on user interaction or when hidden; stop at the end. Transformations are previews.
10. Establish `docs/feature`, `docs/fix`, `docs/plan`, and `docs/doc` conventions.

## Not Yet Implemented

Native packaging, app-store distribution, PWA offline shell, authentication, cloud
storage, band membership, multi-device synchronization, live sessions, setlists,
annotations, playback, OCR, a graphical score editor, Guitar Pro/GPX, compressed
MusicXML (`.mxl`), or score-timewise MusicXML. PDF viewing is visual, not semantic
notation; PDFs and tabs cannot currently be transposed.

## Acceptance Criteria

- Desktop and mobile layouts show readable music without page-level horizontal overflow.
- A song can contain more than one notation type and switch between its documents.
- Create/edit/favorite/delete changes survive reloading; an emptied catalog stays empty.
- ChordPro is parsed with a library, scores are engraved with OSMD, and PDFs use PDF.js.
- Imported text is escaped/sanitized for rendering; unknown backup versions are rejected.
- Corrupt or unsupported imports do not partially update the library.
- Export/reimport preserves IDs, source strings, metadata, and embedded PDF bytes.
- Identical catalog records are skipped. ID conflicts produce independent imported copies.
- Empty, loading, parse-warning, rendering-error, storage-error, and confirmation states exist.
- Preview transposition, zoom, and scrolling do not mutate the source document.
- Documentation and branch names follow the requested four-part version/slug convention.

## Design and Validation

See [architecture.md](architecture.md), [file-formats.md](file-formats.md), and
[verification.md](verification.md). The application's package version is `0.0.0`;
the base feature version is `0.0.0.0`; interchange schema version is integer `1`.
