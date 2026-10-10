# Architecture and Platform Direction

## Current Implementation

```text
React web UI -> CatalogRepository -> IndexedDB
      |                |
      +----- @music-catalog/core -----+
      |       schema / interchange   |
      +-- ChordPro / MusicXML / PDF renderers
```

`packages/core` owns versioned data validation, source-file import/export, stable
identifiers, and non-destructive merge behavior. It has no React, DOM, IndexedDB,
or native-platform dependency. Standard JavaScript text/binary APIs are used.

`apps/web` owns the UI, IndexedDB adapter, downloads/file selection, and rendering.
IndexedDB transactions protect batch imports; single-record edits do not rewrite
unrelated songs. Stored data is local to an origin. Cross-tab live updates and
conflict-aware editing are not implemented; simultaneous edits to the same record
are last-write-wins. The seed marker is stored separately so deleting all songs
does not recreate examples. The storage schema and interchange schema are separate.

The UI is a work surface: a library pane and a document reader. Mobile uses the
same components, displaying one pane at a time. Text tabs retain spacing and may
scroll horizontally inside the reader. MusicXML and PDF renderers load on demand.
PDF pages are rendered when near the viewport. Fonts and the PDF worker are bundled.
PDFs requiring passwords are unsupported; complex font/CMap coverage requires
further fixtures before claiming universal PDF compatibility.

Core dependencies:

| Purpose                        | Library               | Upstream                                                       |
| ------------------------------ | --------------------- | -------------------------------------------------------------- |
| ChordPro parsing/transposition | chordpro-core         | https://github.com/jcthalys/chordpro-core                      |
| MusicXML engraving             | OpenSheetMusicDisplay | https://github.com/opensheetmusicdisplay/opensheetmusicdisplay |
| PDF rendering                  | PDF.js                | https://mozilla.github.io/pdf.js/                              |
| Structured validation          | Zod                   | https://zod.dev/                                               |
| XML parsing/validation         | fast-xml-parser       | https://github.com/NaturalIntelligence/fast-xml-parser         |
| Browser persistence            | idb                   | https://github.com/jakearchibald/idb                           |
| HTML sanitization              | DOMPurify             | https://github.com/cure53/DOMPurify                            |

## Android and iOS

The proposed next packaging layer is [Capacitor](https://capacitorjs.com/docs),
which supports web, Android, and iOS while retaining the web UI and shared core.
Native projects are deliberately not generated for this web-only base feature.
Before shipping, add native filesystem/share adapters, safe-area handling, lifecycle
tests, accessibility testing, persistent-storage policy, and Android/iOS CI/builds.
iOS native compilation requires Apple's toolchain. Validate on physical devices;
responsive browser tests alone do not establish native compatibility.

A separate offline/PWA feature should define app-shell caching, renderer/font
caching, upgrades, storage persistence, and recovery. Browser-local data alone is
not a guaranteed offline application.

## Band Sessions: Proposed Contract

Future server entities: users, bands, memberships, shared repertoire, document
revisions, setlists, sessions, and active presentation state. Ownership belongs to
the band; a member's selected instrument/document remains personal.

Membership roles and active session leadership are separate. Band administrators
grant leadership capability to one or multiple members; ordinary members follow.
For multiple authorized leaders, the server arbitrates an explicit active-controller
lease or handoff. The UI must show who currently controls the session.

Use an authenticated WebSocket transport with server-validated permissions and
monotonically increasing sequence numbers. Proposed message fields:

```text
sessionId, sequence, leaderId, songId, arrangementRevision,
anchor { sectionId?, measureNumber?, pageNumber?, fraction }, sentAt
```

Synchronize a **musical position**, not a raw scroll pixel count. Different members
may have different instruments, notation formats, zoom levels, and screen sizes.
Adapters map section/measure anchors into each rendered document; normalized
document position is a fallback. Persistent anchor mapping between arrangements
is future work; it is not implied by current arbitrary source files.

Reconnect must request a current snapshot and ignore stale/duplicate sequence
numbers. Members can temporarily detach and explicitly rejoin following. Document
revision mismatches must be visible; file/content synchronization is separate from
high-frequency presentation events. Offline behavior and reconnect reconciliation
need a dedicated feature specification before implementation.

## Suggested Order

1. Harden real-world formats and offline support; add arrangement/section identifiers.
2. Package and verify Android/iOS file access and reading workflows.
3. Add identity, bands, roles, revisioned storage, and sync conflict handling.
4. Add ordered setlists and authenticated leader/follower sessions.

These are proposed increments, not reserved version numbers or implemented features.
