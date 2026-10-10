import { importDocument, songFromDocument } from '@music-catalog/core';
import evening from '../../../examples/evening-rehearsal.chordpro?raw';
import tab from '../../../examples/evening-rehearsal.tab?raw';
import score from '../../../examples/c-major-study.musicxml?raw';
import waltz from '../../../examples/sunday-waltz.chordpro?raw';

export function demoSongs() {
  const encode = (text: string) => new TextEncoder().encode(text);
  const first = songFromDocument(importDocument('evening-rehearsal.chordpro', encode(evening)));
  first.documents.push({
    ...importDocument('evening-rehearsal.tab', encode(tab)),
    instrument: 'Guitar',
  });
  first.favorite = true;
  first.tags = ['Original', 'Rehearsal'];
  const second = songFromDocument(importDocument('c-major-study.musicxml', encode(score)));
  second.artist = 'Music Catalog studies';
  second.key = 'C';
  second.tempo = 80;
  second.timeSignature = '4/4';
  second.documents[0].instrument = 'Piano';
  second.tags = ['Original', 'Study'];
  const third = songFromDocument(importDocument('sunday-waltz.chordpro', encode(waltz)));
  third.tags = ['Original', 'Waltz'];
  return [first, second, third];
}
