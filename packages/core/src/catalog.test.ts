import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  decodeBase64,
  encodeBase64,
  importDocument,
  readCatalog,
  songFromDocument,
  writeCatalog,
} from './files';
import { MAX_FILE_BYTES, mergeSongs, newSong } from './catalog';

const chart = '{title: Sao Joao}\n{key: Bb}\n{tempo: 96}\n[Bb]One [F/A]two [Gm7]three\n';
const bytes = (text: string) => new TextEncoder().encode(text);
const song = () => songFromDocument(importDocument('test.chordpro', bytes(chart)));

describe('portable catalog', () => {
  it('round-trips metadata, IDs, source strings, and PDF bytes without loss', () => {
    const original = song();
    const pdf = new Uint8Array([...bytes('%PDF-1.7\n'), 0, 128, 255, 10]);
    original.documents.push(importDocument('part.pdf', pdf));
    const restored = readCatalog(writeCatalog([original]));
    expect(restored).toEqual([original]);
    expect(decodeBase64(restored[0].documents[1].content)).toEqual(pdf);
  });
  it('preserves unicode, spacing, CRLF, and a UTF-8 BOM in text sources', () => {
    const source = '\uFEFF{title: Can\u00e7\u00e3o}\r\n[C]  Texto  \r\n';
    const document = importDocument('song.cho', bytes(source));
    expect(document.content).toBe(source);
    expect(bytes(document.content)).toEqual(bytes(source));
  });
  it('rejects malformed JSON, invalid IDs, unknown fields and unsupported versions', () => {
    expect(() => readCatalog('{')).toThrow('valid JSON');
    const catalog = JSON.parse(writeCatalog([song()]));
    expect(() => readCatalog(JSON.stringify({ ...catalog, schemaVersion: 2 }))).toThrow(
      'Unsupported catalog version',
    );
    expect(() => readCatalog(JSON.stringify({ ...catalog, unexpected: true }))).toThrow(
      'Invalid catalog',
    );
    catalog.songs[0].id = 'not-an-id';
    expect(() => readCatalog(JSON.stringify(catalog))).toThrow('Invalid catalog');
  });
  it('rejects duplicate song and document IDs inside a catalog', () => {
    const item = song();
    expect(() => writeCatalog([item, item])).toThrow('Duplicate ID');
    item.documents[0].id = item.id;
    expect(() => writeCatalog([item])).toThrow('Duplicate ID');
  });
  it('skips identical records and preserves existing data when imports conflict', () => {
    const existing = song();
    const identical = mergeSongs([existing], [structuredClone(existing)]);
    expect(identical).toMatchObject({ added: 0, skipped: 1 });
    const changed = { ...existing, title: 'Changed chart' };
    const result = mergeSongs([existing], [changed]);
    expect(result.songs[0]).toEqual(existing);
    expect(result.songs[1].id).not.toBe(existing.id);
    expect(result.songs[1].documents[0].id).not.toBe(existing.documents[0].id);
    expect(result.songs[1].title).toBe('Changed chart (imported)');
    expect(result.songs[1].documents[0].content).toBe(chart);
  });
  it('resolves document collisions even when song IDs differ', () => {
    const existing = song();
    const incoming = { ...existing, id: crypto.randomUUID() };
    const result = mergeSongs([existing], [incoming]);
    expect(() => writeCatalog(result.songs)).not.toThrow();
    expect(result.added).toBe(1);
  });
  it('supports an empty catalog', () => expect(readCatalog(writeCatalog([]))).toEqual([]));
});

describe('source import', () => {
  it('accepts PDFs up to the advertised binary size without overflowing validation', () => {
    const source = new Uint8Array(MAX_FILE_BYTES);
    source.set(bytes('%PDF-1.7\n'));
    const document = importDocument('large.pdf', source);
    expect(decodeBase64(document.content).length).toBe(MAX_FILE_BYTES);
  });
  it('extracts ChordPro metadata and accepts uppercase extensions', () => {
    expect(songFromDocument(importDocument('test.CHO', bytes(chart)))).toMatchObject({
      title: 'Sao Joao',
      key: 'Bb',
      tempo: 96,
    });
  });
  it('imports the original MusicXML fixture', () => {
    const source = readFileSync(
      new URL('../../../examples/c-major-study.musicxml', import.meta.url),
    );
    const imported = songFromDocument(importDocument('score.xml', source));
    expect(imported.title).toBe('C major study');
    expect(imported.documents[0].format).toBe('musicxml');
  });
  it('rejects invalid XML, unsupported score type, and entity declarations', () => {
    expect(() => importDocument('score.xml', bytes('<score-partwise>'))).toThrow('valid XML');
    expect(() => importDocument('score.xml', bytes('<score-timewise/>'))).toThrow('score-partwise');
    expect(() =>
      importDocument(
        'score.xml',
        bytes('<!DOCTYPE score-partwise [<!ENTITY x "value">]><score-partwise/>'),
      ),
    ).toThrow('entity declarations');
  });
  it('rejects corrupt PDF, binary text, empty and oversized files', () => {
    expect(() => importDocument('part.pdf', bytes('not PDF'))).toThrow('PDF header');
    expect(() => importDocument('tab.txt', new Uint8Array([255, 255]))).toThrow();
    expect(() => importDocument('tab.txt', bytes('a\0b'))).toThrow('UTF-8');
    expect(() => importDocument('tab.txt', new Uint8Array())).toThrow('empty');
    expect(() => importDocument('part.pdf', new Uint8Array(MAX_FILE_BYTES + 1))).toThrow('10 MiB');
    expect(() => importDocument('song.gpx', bytes('x'))).toThrow('Unsupported file');
  });
  it('rejects corrupt documents inside otherwise valid backup envelopes', () => {
    const item = newSong('Broken');
    const backup = JSON.parse(writeCatalog([item]));
    backup.songs[0].documents = [
      {
        id: crypto.randomUUID(),
        name: 'part.pdf',
        instrument: '',
        kind: 'sheet-music',
        format: 'pdf',
        content: encodeBase64(bytes('not PDF')),
      },
    ];
    expect(() => readCatalog(JSON.stringify(backup))).toThrow('PDF header');
  });
});
