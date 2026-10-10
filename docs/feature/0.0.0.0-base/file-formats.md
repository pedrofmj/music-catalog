# File and Catalog Formats

## Source Documents

| Content               | Import extensions                      | Storage                  | Reader            |
| --------------------- | -------------------------------------- | ------------------------ | ----------------- |
| Chord chart           | `.chordpro`, `.cho`, `.crd`, `.chopro` | Original UTF-8 string    | chordpro-core     |
| Sheet music           | `.musicxml`, `.xml`                    | Original UTF-8 XML       | OSMD              |
| Fixed-layout notation | `.pdf`                                 | Base64 of original bytes | PDF.js            |
| Tablature             | `.tab`, `.txt`                         | Original UTF-8 string    | Preformatted text |
| Catalog backup        | `.musiccatalog.json` or `.json`        | Versioned envelope       | Import only       |

`.txt` always means tablature in this release. It is not automatically inferred as
a chord chart. ChordPro supports chord symbols and lyrics, with sections and common
directives; advanced directives may be preserved without full rendering semantics.
Parser warnings are shown in the reader. Preview transposition is not saved.

MusicXML must be uncompressed, well-formed `score-partwise` XML. Entity declarations
are rejected. The XML parser disables entity processing, and no external DTD is
fetched. Valid XML is not necessarily a renderable musical score; engraving failures
retain the original attachment and show an error. PDFs require a PDF signature;
full PDF decoding happens in the viewer. Unsupported/encrypted PDFs remain downloadable.
Original UTF-8 bytes are decoded with a strict decoder; invalid encodings are rejected.

Limits: 10 MiB per source file, 2 MiB for text, 50 MiB per catalog or import batch,
50 documents per song, 1,000 songs per exported catalog, and 20 tags per song.
Very large libraries can be exported song by song. Base64 is larger than binary;
ZIP/blob transport can be introduced as another explicitly versioned format later.

## Interchange Envelope

```json
{
  "format": "music-catalog",
  "schemaVersion": 1,
  "exportedAt": "2026-10-10T12:00:00.000Z",
  "songs": [
    {
      "id": "d7346fbc-cb9d-4395-8bc3-f491e5050043",
      "title": "Example",
      "artist": "Original study",
      "key": "C",
      "tempo": 84,
      "timeSignature": "4/4",
      "tags": ["Rehearsal"],
      "favorite": false,
      "documents": [
        {
          "id": "f7f2e4aa-344c-448a-8bd2-0a630e5311c5",
          "name": "example.chordpro",
          "instrument": "Guitar",
          "kind": "chord-chart",
          "format": "chordpro",
          "content": "{title: Example}\n[C]One [G]two [C]three\n"
        }
      ],
      "createdAt": "2026-10-10T12:00:00.000Z",
      "updatedAt": "2026-10-10T12:00:00.000Z"
    }
  ]
}
```

`kind` is `sheet-music`, `chord-chart`, or `tablature`. `format` is `musicxml`,
`chordpro`, `text`, or `pdf`. PDF can represent any kind; the other formats have a
fixed kind. PDF `content` contains base64 only, without a data-URL prefix.
Empty optional text fields use `""`; an unknown tempo uses `null`. IDs are UUIDs;
timestamps are UTC ISO strings. Song and document IDs must be unique in an envelope.

The executable contract is `packages/core/src/catalog.ts`. A generated JSON Schema
is checked in as [catalog.schema.json](catalog.schema.json). Runtime validation
additionally enforces byte lengths, unique IDs, XML structure, and PDF headers.
Unknown fields and unknown schema versions are rejected, preventing silent data
loss. A future schema change requires explicit migration, fixtures, and compatibility
rules, independent of the four-component feature version.

## Import/Export Semantics

- Catalog exports are self-contained, preserving metadata, IDs, and document content.
- Source imports create one song per file; attachment imports add files to one song.
- ChordPro supplies initial metadata. MusicXML supplies an initial work/movement title.
- A complete selected batch is read and validated before storage writes.
- Identical records with the same ID are skipped. Conflicting IDs create new copies
  with fresh song/document IDs and an `(imported)` title suffix. Existing data remains.
- Reimporting standalone source files creates new songs, even if content is identical.
- Removing a song/document is destructive locally and requires confirmation.
- Original-document download returns source content, not a transposed/reformatted derivative.
- Backup export contains the catalog metadata even if embedded source metadata differs
  after editing. Metadata edits do not rewrite imported source directives.

Browser storage is not a backup. Clearing site data removes the catalog. There is
no cloud connection in this release, and changing the app's origin creates a separate
local library. Use exported catalogs to transfer between origins/devices.
