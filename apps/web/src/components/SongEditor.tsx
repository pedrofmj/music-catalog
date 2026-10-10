import { useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { newSong, songSchema, type MusicDocument, type Song } from '@music-catalog/core';
import { Modal } from './Modal';

export function SongEditor({
  song,
  onSave,
  onClose,
}: {
  song?: Song;
  onSave: (song: Song) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => song || newSong(''));
  const [tags, setTags] = useState(song?.tags.join(', ') || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState('');
  const [format, setFormat] = useState<'chordpro' | 'text'>('chordpro');
  const update = <K extends keyof Song>(key: K, value: Song[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const documents = [...draft.documents];
      if (source.trim()) {
        const base = {
          id: crypto.randomUUID(),
          name: `${draft.title || 'song'}.${format === 'text' ? 'tab' : 'chordpro'}`,
          instrument: '',
          content: source,
        };
        documents.push(
          format === 'text'
            ? { ...base, format, kind: 'tablature' }
            : { ...base, format, kind: 'chord-chart' },
        );
      }
      await onSave(
        songSchema.parse({
          ...draft,
          tags: tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          documents,
          updatedAt: new Date().toISOString(),
        }),
      );
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save this song.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title={song ? 'Edit song' : 'New song'}
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <form onSubmit={submit} className="editor-form">
        <div className="form-grid">
          <label className="wide">
            Title
            <input
              required
              maxLength={200}
              value={draft.title}
              onChange={(event) => update('title', event.target.value)}
              autoFocus
            />
          </label>
          <label className="wide">
            Artist / composer
            <input
              maxLength={200}
              value={draft.artist}
              onChange={(event) => update('artist', event.target.value)}
            />
          </label>
          <label>
            Key
            <input
              maxLength={20}
              value={draft.key}
              onChange={(event) => update('key', event.target.value)}
              placeholder="C"
            />
          </label>
          <label>
            Tempo (BPM)
            <input
              type="number"
              min={20}
              max={400}
              value={draft.tempo ?? ''}
              onChange={(event) =>
                update('tempo', event.target.value ? Number(event.target.value) : null)
              }
            />
          </label>
          <label>
            Time signature
            <input
              maxLength={20}
              value={draft.timeSignature}
              onChange={(event) => update('timeSignature', event.target.value)}
              placeholder="4/4"
            />
          </label>
          <label>
            Tags
            <input maxLength={400} value={tags} onChange={(event) => setTags(event.target.value)} />
          </label>
        </div>
        <label>
          New document
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value as 'chordpro' | 'text')}
          >
            <option value="chordpro">Chord chart (ChordPro)</option>
            <option value="text">Tablature (plain text)</option>
          </select>
        </label>
        <label>
          Source
          <textarea
            className="source-input"
            rows={8}
            spellCheck={false}
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder={
              format === 'chordpro'
                ? '{start_of_verse: Verse}\n[C]Lyrics with [G]chords\n{end_of_verse}'
                : 'e|----------------|\nB|----------------|\nG|----------------|\nD|----------------|\nA|----------------|\nE|----------------|'
            }
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <footer className="modal-footer">
          <button type="button" className="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="button primary" disabled={saving}>
            <Save size={16} />
            {saving ? 'Saving...' : 'Save song'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

export function DocumentEditor({
  document,
  onSave,
  onClose,
}: {
  document: MusicDocument;
  onSave: (document: MusicDocument) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(document);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <Modal
      title="Edit document"
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <form
        className="editor-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setError('');
          try {
            await onSave(draft);
            onClose();
          } catch (error) {
            setError(error instanceof Error ? error.message : 'Could not save this document.');
          } finally {
            setSaving(false);
          }
        }}
      >
        <label>
          Name
          <input
            required
            maxLength={240}
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>
        <label>
          Instrument / part
          <input
            maxLength={120}
            value={draft.instrument}
            onChange={(event) => setDraft({ ...draft, instrument: event.target.value })}
          />
        </label>
        {draft.format === 'pdf' && (
          <label>
            Notation
            <select
              value={draft.kind}
              onChange={(event) =>
                setDraft({ ...draft, kind: event.target.value as MusicDocument['kind'] })
              }
            >
              <option value="sheet-music">Sheet music</option>
              <option value="chord-chart">Chord chart</option>
              <option value="tablature">Tablature</option>
            </select>
          </label>
        )}
        {(draft.format === 'chordpro' || draft.format === 'text') && (
          <label>
            Source
            <textarea
              className="source-input"
              required
              rows={15}
              spellCheck={false}
              value={draft.content}
              onChange={(event) => setDraft({ ...draft, content: event.target.value })}
            />
          </label>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <footer className="modal-footer">
          <button type="button" className="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="button primary" disabled={saving}>
            <Save size={16} />
            {saving ? 'Saving...' : 'Save document'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
