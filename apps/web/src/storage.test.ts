import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { newSong } from '@music-catalog/core';
import { createRepository } from './storage';

describe('IndexedDB repository', () => {
  let name: string;
  let repository: ReturnType<typeof createRepository>;
  beforeEach(() => {
    name = crypto.randomUUID();
    repository = createRepository(name);
  });
  afterEach(async () => {
    await repository.close();
    indexedDB.deleteDatabase(name);
  });
  it('seeds once, including concurrent initialization', async () => {
    await Promise.all([repository.initialize(), repository.initialize()]);
    expect(await repository.list()).toHaveLength(3);
  });
  it('persists edits and never reseeds an intentionally empty library', async () => {
    await repository.initialize();
    const songs = await repository.list();
    songs[0].title = 'Updated';
    await repository.save(songs[0]);
    await repository.close();
    repository = createRepository(name);
    expect((await repository.list()).find((song) => song.id === songs[0].id)?.title).toBe(
      'Updated',
    );
    for (const song of songs) await repository.remove(song.id);
    await repository.initialize();
    expect(await repository.list()).toEqual([]);
  });
  it('does not partially save an invalid batch', async () => {
    await repository.initialize();
    const valid = newSong('Valid import');
    const invalid = { ...newSong('Invalid import'), tempo: -5 };
    await expect(repository.import([valid, invalid])).rejects.toThrow();
    expect(await repository.list()).toHaveLength(3);
  });
  it('merges imports without overwriting existing songs', async () => {
    await repository.initialize();
    const songs = await repository.list();
    expect(await repository.import(songs)).toEqual({ added: 0, skipped: 3 });
    expect(await repository.import([{ ...songs[0], title: 'Changed' }])).toEqual({
      added: 1,
      skipped: 0,
    });
    expect(await repository.list()).toHaveLength(4);
    expect((await repository.list()).find((song) => song.id === songs[0].id)).toEqual(songs[0]);
  });
});
