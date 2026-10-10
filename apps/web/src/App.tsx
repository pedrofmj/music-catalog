import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpDown,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  FileMusic,
  FolderOpen,
  Guitar,
  HardDrive,
  Music2,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  acceptedFiles,
  decodeBase64,
  importDocument,
  MAX_CATALOG_BYTES,
  MAX_FILE_BYTES,
  readCatalog,
  songFromDocument,
  writeCatalog,
  type DocumentKind,
  type MusicDocument,
  type Song,
} from '@music-catalog/core';
import { createRepository } from './storage';
import { IconButton } from './components/IconButton';
import { Modal } from './components/Modal';
import { DocumentEditor, SongEditor } from './components/SongEditor';
import { Reader, kindLabels } from './components/Reader';

const repository = createRepository();
const kinds: { value: DocumentKind | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'sheet-music', label: 'Scores' },
  { value: 'chord-chart', label: 'Charts' },
  { value: 'tablature', label: 'Tabs' },
];

function download(content: string | Uint8Array, filename: string, type: string) {
  const data = typeof content === 'string' ? content : new Uint8Array(content).buffer;
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replace(/[\\/<>:"|?*\x00-\x1f]/g, '-');
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DocumentKind | 'all'>('all');
  const [favorites, setFavorites] = useState(false);
  const [sort, setSort] = useState<'title' | 'updated'>('title');
  const [selected, setSelected] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [mobileReader, setMobileReader] = useState(false);
  const [focused, setFocused] = useState(false);
  const [editing, setEditing] = useState<Song | 'new' | null>(null);
  const [editingDocument, setEditingDocument] = useState<MusicDocument | null>(null);
  const [deleting, setDeleting] = useState<'song' | 'document' | null>(null);
  const [attachTo, setAttachTo] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function reload() {
    const result = await repository.list();
    setSongs(result);
    return result;
  }
  async function initialize() {
    setError('');
    try {
      await repository.initialize();
      const result = await reload();
      setSelected((result.find((song) => song.favorite) || result[0])?.id || '');
      setReady(true);
    } catch {
      setError('Local storage could not be opened. Allow site storage in this browser and retry.');
    }
  }
  useEffect(() => {
    void initialize();
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    const exit = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFocused(false);
    };
    window.addEventListener('keydown', exit);
    return () => window.removeEventListener('keydown', exit);
  }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return songs
      .filter(
        (song) =>
          (!favorites || song.favorite) &&
          (filter === 'all' || song.documents.some((document) => document.kind === filter)) &&
          `${song.title} ${song.artist} ${song.tags.join(' ')}`.toLocaleLowerCase().includes(query),
      )
      .sort((a, b) =>
        sort === 'title' ? a.title.localeCompare(b.title) : b.updatedAt.localeCompare(a.updatedAt),
      );
  }, [songs, search, filter, favorites, sort]);
  const current = visible.find((song) => song.id === selected) || visible[0];
  const activeDocument =
    current?.documents.find((document) => document.id === documentId) ||
    current?.documents.find((document) => filter !== 'all' && document.kind === filter) ||
    current?.documents[0];
  const documentCount = songs.reduce((total, song) => total + song.documents.length, 0);

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The operation could not be completed.');
    } finally {
      setBusy(false);
    }
  }
  async function saveSong(song: Song) {
    await repository.save(song);
    await reload();
    setSelected(song.id);
    setNotice('Song saved');
  }
  function openImport(songId: string | null = null) {
    setAttachTo(songId);
    input.current?.click();
  }
  async function importFiles(files: FileList | null) {
    if (!files?.length) return;
    const selectedFiles = Array.from(files);
    await perform(async () => {
      if (selectedFiles.reduce((sum, file) => sum + file.size, 0) > MAX_CATALOG_BYTES)
        throw new Error('Select at most 50 MiB per import.');
      const incoming: Song[] = [];
      const documents: MusicDocument[] = [];
      for (const file of selectedFiles) {
        try {
          if (file.name.toLowerCase().endsWith('.json')) {
            if (attachTo)
              throw new Error('Catalog backups must be imported from the main Import button.');
            incoming.push(...readCatalog(await file.text()));
          } else {
            if (file.size > MAX_FILE_BYTES) throw new Error('Source files must be at most 10 MiB.');
            const document = importDocument(file.name, new Uint8Array(await file.arrayBuffer()));
            documents.push(document);
            if (!attachTo) incoming.push(songFromDocument(document));
          }
        } catch (error) {
          throw new Error(
            `${file.name}: ${error instanceof Error ? error.message : 'Import failed.'}`,
          );
        }
      }
      if (attachTo) {
        const song = (await repository.list()).find((song) => song.id === attachTo);
        if (!song) throw new Error('The destination song no longer exists.');
        await saveSong({
          ...song,
          documents: [...song.documents, ...documents],
          updatedAt: new Date().toISOString(),
        });
        setDocumentId(documents[0]?.id || '');
        setNotice(`${documents.length} document(s) attached`);
      } else {
        const result = await repository.import(incoming);
        await reload();
        setSearch('');
        setFilter('all');
        setFavorites(false);
        setSelected(incoming[0]?.id || '');
        setDocumentId('');
        setNotice(
          `${result.added} song(s) imported${result.skipped ? `, ${result.skipped} identical song(s) skipped` : ''}`,
        );
      }
    });
    if (input.current) input.current.value = '';
  }
  function exportSongs(items: Song[], name: string) {
    void perform(async () => {
      download(writeCatalog(items), `${name}.musiccatalog.json`, 'application/json');
      setNotice('Catalog exported');
    });
  }

  return (
    <div className={`app ${mobileReader ? 'mobile-reading' : ''} ${focused ? 'focused' : ''}`}>
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setMobileReader(false);
            setFocused(false);
          }}
        >
          <span className="brand-mark">
            <Music2 size={22} />
          </span>
          <span>Music Catalog</span>
        </a>
        <div className="header-section">
          <BookOpen size={17} />
          <span>Repertoire</span>
        </div>
        <div className="header-actions">
          <span className="local-status">
            <HardDrive size={14} />
            On this device
          </span>
          <button
            className="button import-button"
            disabled={!ready || busy}
            onClick={() => openImport()}
          >
            <Upload size={16} />
            <span>Import</span>
          </button>
          <IconButton
            label="Export catalog"
            disabled={!ready || busy || !songs.length}
            onClick={() => exportSongs(songs, 'repertoire')}
          >
            <Download size={18} />
          </IconButton>
        </div>
      </header>
      <input
        ref={input}
        type="file"
        multiple
        accept={acceptedFiles}
        className="file-input"
        aria-label="Import music files"
        onChange={(event) => {
          void importFiles(event.target.files);
        }}
      />
      {error && (
        <div className="notification error" role="alert">
          <span>{error}</span>
          {!ready && (
            <button className="button" onClick={() => void initialize()}>
              Retry
            </button>
          )}
          <IconButton label="Dismiss error" onClick={() => setError('')}>
            <X size={16} />
          </IconButton>
        </div>
      )}
      {notice && (
        <div className="notification success" role="status" aria-label="Library notification">
          <Check size={16} />
          <span>{notice}</span>
          <IconButton label="Dismiss notification" onClick={() => setNotice('')}>
            <X size={16} />
          </IconButton>
        </div>
      )}
      <div className="workspace">
        <aside className="library" aria-label="Repertoire">
          <div className="library-heading">
            <div>
              <span className="eyebrow">YOUR LIBRARY</span>
              <h1>
                Repertoire <span>{songs.length}</span>
              </h1>
            </div>
            <IconButton
              label="New song"
              className="add-song"
              disabled={!ready || busy}
              onClick={() => setEditing('new')}
            >
              <Plus size={20} />
            </IconButton>
          </div>
          <div className="library-controls">
            <div className="library-switch">
              <button
                className={!favorites ? 'active' : ''}
                aria-pressed={!favorites}
                onClick={() => setFavorites(false)}
              >
                <FolderOpen size={16} />
                All songs
              </button>
              <button
                className={favorites ? 'active' : ''}
                aria-pressed={favorites}
                onClick={() => setFavorites(true)}
              >
                <Star size={15} />
                Favorites
              </button>
            </div>
            <label className="search">
              <Search size={17} />
              <input
                aria-label="Search repertoire"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search repertoire"
              />
              {search && (
                <IconButton label="Clear search" onClick={() => setSearch('')}>
                  <X size={14} />
                </IconButton>
              )}
            </label>
            <div className="filter-row">
              <div className="format-filter" aria-label="Notation filter">
                {kinds.map((kind) => (
                  <button
                    key={kind.value}
                    aria-pressed={filter === kind.value}
                    className={filter === kind.value ? 'active' : ''}
                    onClick={() => {
                      setFilter(kind.value);
                      setDocumentId('');
                    }}
                  >
                    {kind.label}
                  </button>
                ))}
              </div>
              <IconButton
                label={sort === 'title' ? 'Sort by recently updated' : 'Sort by title'}
                onClick={() => setSort(sort === 'title' ? 'updated' : 'title')}
              >
                <ArrowUpDown size={16} />
              </IconButton>
            </div>
          </div>
          <div className="song-list" aria-label="Songs">
            {!ready ? (
              <p className="library-empty" role="status">
                Opening repertoire...
              </p>
            ) : (
              visible.map((song, index) => (
                <button
                  key={song.id}
                  className={`song-row ${current?.id === song.id ? 'selected' : ''}`}
                  aria-current={current?.id === song.id ? 'true' : undefined}
                  onClick={() => {
                    setSelected(song.id);
                    setDocumentId('');
                    setMobileReader(true);
                  }}
                >
                  <span className="song-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="song-info">
                    <span className="song-title">{song.title}</span>
                    <span className="song-artist">{song.artist || 'Unknown artist'}</span>
                    <span className="song-formats">
                      {[...new Set(song.documents.map((document) => document.kind))].map((kind) => (
                        <span key={kind} className={`notation-label ${kind}`}>
                          {kind === 'tablature' ? <Guitar size={11} /> : <FileMusic size={11} />}
                          {kindLabels[kind]}
                        </span>
                      ))}
                    </span>
                  </span>
                  {song.favorite && (
                    <Star size={13} className="favorite-star" fill="currentColor" />
                  )}
                  <ChevronRight size={15} className="row-chevron" />
                </button>
              ))
            )}
            {ready && !visible.length && (
              <div className="empty-state library-empty">
                <Music2 size={30} />
                <h3>
                  {search || favorites || filter !== 'all'
                    ? 'No matching songs'
                    : 'Your repertoire is empty'}
                </h3>
                {search || favorites || filter !== 'all' ? (
                  <button
                    className="button"
                    onClick={() => {
                      setSearch('');
                      setFilter('all');
                      setFavorites(false);
                    }}
                  >
                    Clear filters
                  </button>
                ) : (
                  <button className="button primary" onClick={() => setEditing('new')}>
                    <Plus size={16} />
                    New song
                  </button>
                )}
              </div>
            )}
          </div>
          <footer className="library-footer">
            <span>{songs.length} songs</span>
            <span>{documentCount} documents</span>
          </footer>
        </aside>
        <main className="song-workspace">
          {current ? (
            <>
              <div className="song-heading">
                <button
                  className="mobile-back button"
                  onClick={() => {
                    setMobileReader(false);
                    setFocused(false);
                  }}
                >
                  <ArrowLeft size={16} />
                  Repertoire
                </button>
                <div className="song-heading-top">
                  <div>
                    <div className="song-tags">
                      {current.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                    <h2>{current.title}</h2>
                    <p>{current.artist || 'Unknown artist'}</p>
                  </div>
                  <div className="song-actions">
                    <IconButton
                      label={current.favorite ? 'Remove from favorites' : 'Add to favorites'}
                      className={current.favorite ? 'is-favorite' : ''}
                      disabled={busy}
                      onClick={() =>
                        void perform(() =>
                          saveSong({
                            ...current,
                            favorite: !current.favorite,
                            updatedAt: new Date().toISOString(),
                          }),
                        )
                      }
                    >
                      <Star size={18} fill={current.favorite ? 'currentColor' : 'none'} />
                    </IconButton>
                    <IconButton
                      label="Edit song"
                      disabled={busy}
                      onClick={() => setEditing(current)}
                    >
                      <Pencil size={18} />
                    </IconButton>
                    <IconButton
                      label="Export song"
                      disabled={busy}
                      onClick={() => exportSongs([current], current.title)}
                    >
                      <Download size={18} />
                    </IconButton>
                    <IconButton
                      label="Delete song"
                      disabled={busy}
                      onClick={() => setDeleting('song')}
                    >
                      <Trash2 size={18} />
                    </IconButton>
                  </div>
                </div>
                <div className="song-metadata">
                  <span>
                    <small>KEY</small>
                    <strong>{current.key || '-'}</strong>
                  </span>
                  <span>
                    <small>TEMPO</small>
                    <strong>
                      {current.tempo || '-'} <em>BPM</em>
                    </strong>
                  </span>
                  <span>
                    <small>TIME</small>
                    <strong>{current.timeSignature || '-'}</strong>
                  </span>
                  <span className="document-total">{current.documents.length} documents</span>
                </div>
              </div>
              <Reader
                key={current.id}
                song={current}
                document={activeDocument}
                focused={focused}
                onFocus={() => setFocused(!focused)}
                onSelect={setDocumentId}
                onAttach={() => openImport(current.id)}
                onEdit={() => setEditingDocument(activeDocument || null)}
                onDelete={() => setDeleting('document')}
                onDownload={() => {
                  if (activeDocument)
                    download(
                      activeDocument.format === 'pdf'
                        ? decodeBase64(activeDocument.content)
                        : activeDocument.content,
                      activeDocument.name,
                      activeDocument.format === 'pdf'
                        ? 'application/pdf'
                        : 'text/plain;charset=utf-8',
                    );
                }}
              />
            </>
          ) : (
            <div className="empty-state main-empty">
              <BookOpen size={48} />
              <h2>{ready ? 'No song selected' : 'Opening your library'}</h2>
            </div>
          )}
        </main>
      </div>
      {busy && (
        <div role="status" className="busy-status">
          Working...
        </div>
      )}
      {editing && (
        <SongEditor
          song={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={async (song) => {
            await saveSong(song);
            setSearch('');
            setFilter('all');
            setFavorites(false);
            setMobileReader(true);
          }}
        />
      )}
      {editingDocument && current && (
        <DocumentEditor
          document={editingDocument}
          onClose={() => setEditingDocument(null)}
          onSave={async (document) => {
            await saveSong({
              ...current,
              documents: current.documents.map((item) =>
                item.id === document.id ? document : item,
              ),
              updatedAt: new Date().toISOString(),
            });
          }}
        />
      )}
      {deleting && current && (
        <Modal
          title={deleting === 'song' ? 'Delete song?' : 'Remove document?'}
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <div className="confirm-body">
            <p>
              {deleting === 'song'
                ? `Delete "${current.title}" and its documents from this device?`
                : `Remove "${activeDocument?.name}" from this song?`}
            </p>
            <footer className="modal-footer">
              <button className="button" disabled={busy} onClick={() => setDeleting(null)}>
                Cancel
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    if (deleting === 'song') {
                      await repository.remove(current.id);
                      await reload();
                      setMobileReader(false);
                      setFocused(false);
                      setNotice('Song deleted');
                    } else {
                      await saveSong({
                        ...current,
                        documents: current.documents.filter(
                          (document) => document.id !== activeDocument?.id,
                        ),
                        updatedAt: new Date().toISOString(),
                      });
                      setDocumentId('');
                      setNotice('Document removed');
                    }
                    setDeleting(null);
                  })
                }
              >
                <Trash2 size={16} />
                {deleting === 'song' ? 'Delete song' : 'Remove document'}
              </button>
            </footer>
          </div>
        </Modal>
      )}
    </div>
  );
}
