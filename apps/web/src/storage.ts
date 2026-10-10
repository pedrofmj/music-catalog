import { openDB, type DBSchema } from 'idb';
import {
  mergeSongs,
  songSchema,
  validateDocument,
  type CatalogRepository,
  type Song,
} from '@music-catalog/core';
import { demoSongs } from './demo';

interface CatalogDB extends DBSchema {
  songs: { key: string; value: Song };
  meta: { key: string; value: boolean };
}

export function createRepository(name = 'music-catalog') {
  const database = openDB<CatalogDB>(name, 1, {
    upgrade(db) {
      db.createObjectStore('songs', { keyPath: 'id' });
      db.createObjectStore('meta');
    },
    blocking(_currentVersion, _blockedVersion, event) {
      (event.target as IDBDatabase).close();
    },
  });
  const repository: CatalogRepository & { initialize(): Promise<void>; close(): Promise<void> } = {
    async initialize() {
      const db = await database;
      const tx = db.transaction(['songs', 'meta'], 'readwrite');
      if (!(await tx.objectStore('meta').get('initialized'))) {
        for (const song of demoSongs()) await tx.objectStore('songs').put(song);
        await tx.objectStore('meta').put(true, 'initialized');
      }
      await tx.done;
    },
    async list() {
      return (await (await database).getAll('songs')).map((song) => songSchema.parse(song));
    },
    async save(song) {
      const parsed = songSchema.parse(song);
      parsed.documents.forEach(validateDocument);
      await (await database).put('songs', parsed);
    },
    async remove(id) {
      await (await database).delete('songs', id);
    },
    async import(incoming) {
      const validated = incoming.map((song) => songSchema.parse(song));
      validated.forEach((song) => song.documents.forEach(validateDocument));
      const db = await database;
      const tx = db.transaction('songs', 'readwrite');
      const result = mergeSongs(await tx.store.getAll(), validated);
      for (const song of result.songs) await tx.store.put(song);
      await tx.done;
      return { added: result.added, skipped: result.skipped };
    },
    async close() {
      (await database).close();
    },
  };
  return repository;
}
