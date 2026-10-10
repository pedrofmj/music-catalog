import { z } from 'zod';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TEXT_BYTES = 2 * 1024 * 1024;
export const MAX_CATALOG_BYTES = 50 * 1024 * 1024;
export const documentKinds = ['chord-chart', 'sheet-music', 'tablature'] as const;
export type DocumentKind = (typeof documentKinds)[number];

const documentBase = {
  id: z.uuid(),
  name: z.string().trim().min(1).max(240),
  instrument: z.string().max(120),
};
const textContent = z
  .string()
  .min(1)
  .max(MAX_TEXT_BYTES)
  .refine(
    (value) => new TextEncoder().encode(value).length <= MAX_TEXT_BYTES,
    'Text documents must be at most 2 MiB.',
  );

export const documentSchema = z.discriminatedUnion('format', [
  z.strictObject({
    ...documentBase,
    kind: z.literal('chord-chart'),
    format: z.literal('chordpro'),
    content: textContent,
  }),
  z.strictObject({
    ...documentBase,
    kind: z.literal('sheet-music'),
    format: z.literal('musicxml'),
    content: textContent,
  }),
  z.strictObject({
    ...documentBase,
    kind: z.literal('tablature'),
    format: z.literal('text'),
    content: textContent,
  }),
  z.strictObject({
    ...documentBase,
    kind: z.enum(documentKinds),
    format: z.literal('pdf'),
    content: z
      .string()
      .min(1)
      .max(Math.ceil(MAX_FILE_BYTES / 3) * 4)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Invalid base64 PDF.')
      .refine((value) => value.length % 4 === 0, 'Invalid base64 length.')
      .refine((value) => {
        const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
        return (value.length / 4) * 3 - padding <= MAX_FILE_BYTES;
      }, 'PDFs must be at most 10 MiB.'),
  }),
]);

export const songSchema = z.strictObject({
  id: z.uuid(),
  title: z.string().trim().min(1).max(200),
  artist: z.string().max(200),
  key: z.string().max(20),
  tempo: z.number().int().min(20).max(400).nullable(),
  timeSignature: z.string().max(20),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  favorite: z.boolean(),
  documents: z.array(documentSchema).max(50),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const catalogSchema = z
  .strictObject({
    format: z.literal('music-catalog'),
    schemaVersion: z.literal(1),
    exportedAt: z.iso.datetime(),
    songs: z.array(songSchema).max(1000),
  })
  .superRefine((catalog, context) => {
    const ids = new Set<string>();
    for (const song of catalog.songs) {
      for (const item of [song, ...song.documents]) {
        if (ids.has(item.id))
          context.addIssue({ code: 'custom', message: `Duplicate ID: ${item.id}` });
        ids.add(item.id);
      }
    }
  });

export type MusicDocument = z.infer<typeof documentSchema>;
export type Song = z.infer<typeof songSchema>;
export type Catalog = z.infer<typeof catalogSchema>;

export interface CatalogRepository {
  list(): Promise<Song[]>;
  save(song: Song): Promise<void>;
  remove(id: string): Promise<void>;
  import(songs: Song[]): Promise<{ added: number; skipped: number }>;
}

export function newSong(title = 'Untitled song'): Song {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    artist: '',
    key: '',
    tempo: null,
    timeSignature: '',
    tags: [],
    favorite: false,
    documents: [],
    createdAt: now,
    updatedAt: now,
  };
}

// Conflicting imports become independent copies; existing rehearsals never change silently.
export function mergeSongs(existing: Song[], incoming: Song[]) {
  const songs = [...existing];
  const ids = new Set(
    existing.flatMap((song) => [song.id, ...song.documents.map((doc) => doc.id)]),
  );
  let added = 0;
  let skipped = 0;
  for (const candidate of incoming) {
    const previous = songs.find((song) => song.id === candidate.id);
    if (previous && JSON.stringify(previous) === JSON.stringify(candidate)) {
      skipped++;
      continue;
    }
    const collision = [candidate.id, ...candidate.documents.map((doc) => doc.id)].some((id) =>
      ids.has(id),
    );
    const song: Song = collision
      ? {
          ...candidate,
          id: crypto.randomUUID(),
          title: `${candidate.title.slice(0, 189)} (imported)`,
          documents: candidate.documents.map((doc) => ({ ...doc, id: crypto.randomUUID() })),
        }
      : candidate;
    songs.push(song);
    [song.id, ...song.documents.map((doc) => doc.id)].forEach((id) => ids.add(id));
    added++;
  }
  return { songs, added, skipped };
}
