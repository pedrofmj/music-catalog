import { parse } from 'chordpro-core';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  catalogSchema,
  documentSchema,
  MAX_CATALOG_BYTES,
  MAX_FILE_BYTES,
  MAX_TEXT_BYTES,
  newSong,
  type MusicDocument,
  type Song,
} from './catalog';

export const acceptedFiles = '.chordpro,.cho,.crd,.chopro,.musicxml,.xml,.pdf,.tab,.txt,.json';

export function validateDocument(document: MusicDocument): void {
  documentSchema.parse(document);
  if (document.format === 'musicxml') {
    if (/<!ENTITY\s/i.test(document.content))
      throw new Error('MusicXML entity declarations are not supported.');
    if (XMLValidator.validate(document.content) !== true)
      throw new Error('The MusicXML document is not valid XML.');
    const parsed = new XMLParser({ processEntities: false }).parse(document.content);
    if (!parsed['score-partwise'])
      throw new Error(
        'Expected score-partwise MusicXML. Export a partwise score from your notation app.',
      );
  }
  if (document.format === 'pdf' && !atob(document.content.slice(0, 8)).startsWith('%PDF-')) {
    throw new Error('This file does not have a PDF header.');
  }
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

export function decodeBase64(content: string): Uint8Array {
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function importDocument(filename: string, bytes: Uint8Array): MusicDocument {
  if (!bytes.length) throw new Error('The file is empty.');
  if (bytes.length > MAX_FILE_BYTES) throw new Error('Each source file must be at most 10 MiB.');
  const extension = filename.split('.').pop()?.toLowerCase();
  const base = { id: crypto.randomUUID(), name: filename, instrument: '' };
  let document: MusicDocument;
  if (extension === 'pdf') {
    document = { ...base, kind: 'sheet-music', format: 'pdf', content: encodeBase64(bytes) };
  } else {
    if (bytes.length > MAX_TEXT_BYTES) throw new Error('Text documents must be at most 2 MiB.');
    const content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    if (!content.trim() || content.includes('\0'))
      throw new Error('Expected a nonempty UTF-8 text file.');
    switch (extension) {
      case 'cho':
      case 'crd':
      case 'chordpro':
      case 'chopro':
        document = { ...base, kind: 'chord-chart', format: 'chordpro', content };
        break;
      case 'musicxml':
      case 'xml':
        document = { ...base, kind: 'sheet-music', format: 'musicxml', content };
        break;
      case 'txt':
      case 'tab':
        document = { ...base, kind: 'tablature', format: 'text', content };
        break;
      default:
        throw new Error(
          'Unsupported file. Use ChordPro, MusicXML, PDF, .tab, .txt, or a catalog JSON export.',
        );
    }
  }
  validateDocument(document);
  return document;
}

export function songFromDocument(document: MusicDocument): Song {
  const song = newSong(document.name.replace(/\.[^.]+$/, '').slice(0, 200));
  song.documents.push(document);
  if (document.format === 'chordpro') {
    const metadata = parse(document.content).metadata;
    song.title = (metadata.get('title') || song.title).slice(0, 200);
    song.artist = (metadata.get('artist') || metadata.get('composer') || '').slice(0, 200);
    song.key = (metadata.get('key') || '').slice(0, 20);
    song.timeSignature = (metadata.get('time') || '').slice(0, 20);
    const tempo = Number(metadata.get('tempo'));
    song.tempo = Number.isInteger(tempo) && tempo >= 20 && tempo <= 400 ? tempo : null;
  }
  if (document.format === 'musicxml') {
    const score = new XMLParser({ processEntities: false }).parse(document.content)[
      'score-partwise'
    ];
    const title = score['work']?.['work-title'] || score['movement-title'];
    if (typeof title === 'string' && title.trim()) song.title = title.slice(0, 200);
  }
  return song;
}

export function readCatalog(source: string): Song[] {
  if (new TextEncoder().encode(source).length > MAX_CATALOG_BYTES)
    throw new Error('Catalog files must be at most 50 MiB.');
  let input: unknown;
  try {
    input = JSON.parse(source);
  } catch {
    throw new Error('The catalog is not valid JSON.');
  }
  if (input && typeof input === 'object' && 'schemaVersion' in input && input.schemaVersion !== 1) {
    throw new Error(
      `Unsupported catalog version: ${String(input.schemaVersion)}. This app supports version 1.`,
    );
  }
  const result = catalogSchema.safeParse(input);
  if (!result.success)
    throw new Error(`Invalid catalog: ${result.error.issues[0]?.message || 'schema mismatch'}`);
  result.data.songs.forEach((song) => song.documents.forEach(validateDocument));
  return result.data.songs;
}

export function writeCatalog(songs: Song[]): string {
  const catalog = catalogSchema.parse({
    format: 'music-catalog',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    songs,
  });
  catalog.songs.forEach((song) => song.documents.forEach(validateDocument));
  const source = JSON.stringify(catalog, null, 2) + '\n';
  if (new TextEncoder().encode(source).length > MAX_CATALOG_BYTES)
    throw new Error('This catalog exceeds 50 MiB. Export individual songs instead.');
  return source;
}
