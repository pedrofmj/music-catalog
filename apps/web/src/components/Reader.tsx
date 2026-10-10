import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { parse, renderHtml, transpose } from 'chordpro-core';
import DOMPurify from 'dompurify';
import {
  Download,
  FileMusic,
  Guitar,
  Maximize,
  Minimize,
  Minus,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type { MusicDocument, Song } from '@music-catalog/core';
import { IconButton } from './IconButton';

const MusicXmlView = lazy(() => import('./MusicXmlView'));
const PdfView = lazy(() => import('./PdfView'));
const formatLabels = { chordpro: 'ChordPro', musicxml: 'MusicXML', text: 'Plain text', pdf: 'PDF' };
export const kindLabels = {
  'chord-chart': 'Chord chart',
  'sheet-music': 'Sheet music',
  tablature: 'Tablature',
};

function Chart({
  document,
  semitones,
  zoom,
}: {
  document: MusicDocument;
  semitones: number;
  zoom: number;
}) {
  const result = useMemo(() => {
    const song = parse(document.content);
    return {
      html: DOMPurify.sanitize(renderHtml(transpose(song, semitones), { includeHeader: false })),
      warnings: song.warnings,
    };
  }, [document.content, semitones]);
  return (
    <>
      {result.warnings.length > 0 && (
        <details className="parse-warnings">
          <summary>{result.warnings.length} notation warning(s)</summary>
          <ul>
            {result.warnings.map((warning, index) => (
              <li key={index}>
                Line {warning.line}: {warning.message}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div
        className="chart-content"
        style={{ fontSize: (18 * zoom) / 100 }}
        dangerouslySetInnerHTML={{ __html: result.html }}
      />
    </>
  );
}

export function Reader({
  song,
  document,
  focused,
  onFocus,
  onSelect,
  onAttach,
  onEdit,
  onDelete,
  onDownload,
}: {
  song: Song;
  document?: MusicDocument;
  focused: boolean;
  onFocus: () => void;
  onSelect: (id: string) => void;
  onAttach: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDownload: () => void;
}) {
  const [zoom, setZoom] = useState(100);
  const [semitones, setSemitones] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(24);
  const [progress, setProgress] = useState(0);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setPlaying(false);
    setSemitones(0);
    setProgress(0);
    scroll.current?.scrollTo(0, 0);
  }, [document?.id]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous = 0;
    let position = scroll.current?.scrollTop || 0;
    function tick(time: number) {
      const element = scroll.current;
      if (!element) return;
      if (previous) {
        position += (Math.min(time - previous, 100) / 1000) * speed;
        element.scrollTop = position;
      }
      previous = time;
      if (element.scrollTop >= element.scrollHeight - element.clientHeight - 1) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed]);
  useEffect(() => {
    const pause = () => {
      if (window.document.hidden) setPlaying(false);
    };
    window.document.addEventListener('visibilitychange', pause);
    return () => window.document.removeEventListener('visibilitychange', pause);
  }, []);
  return (
    <section className="reader" aria-label="Music reader">
      <div className="document-tabs" aria-label="Song documents">
        <div className="document-tab-list">
          {song.documents.map((item) => (
            <button
              key={item.id}
              className={`document-tab ${document?.id === item.id ? 'active' : ''}`}
              onClick={() => onSelect(item.id)}
              aria-pressed={document?.id === item.id}
              title={item.name}
            >
              {item.kind === 'tablature' ? <Guitar size={16} /> : <FileMusic size={16} />}
              <span>
                {kindLabels[item.kind]}
                {item.instrument ? ` · ${item.instrument}` : ''}
              </span>
            </button>
          ))}
        </div>
        <IconButton label="Attach document" onClick={onAttach}>
          <Plus size={18} />
        </IconButton>
      </div>
      {document ? (
        <>
          <div className="reader-toolbar">
            <div className="tool-group">
              <span className="format-label">{formatLabels[document.format]}</span>
              <IconButton
                label="Zoom out"
                onClick={() => setZoom(Math.max(60, zoom - 10))}
                disabled={zoom <= 60}
              >
                <Minus size={16} />
              </IconButton>
              <output className="zoom-value">{zoom}%</output>
              <IconButton
                label="Zoom in"
                onClick={() => setZoom(Math.min(180, zoom + 10))}
                disabled={zoom >= 180}
              >
                <Plus size={16} />
              </IconButton>
            </div>
            {document.format === 'chordpro' && (
              <div className="tool-group transpose">
                <span>Transpose</span>
                <IconButton
                  label="Transpose down"
                  onClick={() => setSemitones(Math.max(-12, semitones - 1))}
                  disabled={semitones <= -12}
                >
                  <Minus size={16} />
                </IconButton>
                <output aria-label="Transposition" className="transpose-value">
                  {semitones > 0 ? '+' : ''}
                  {semitones}
                </output>
                <IconButton
                  label="Transpose up"
                  onClick={() => setSemitones(Math.min(12, semitones + 1))}
                  disabled={semitones >= 12}
                >
                  <Plus size={16} />
                </IconButton>
              </div>
            )}
            <div className="tool-group document-actions">
              <IconButton label="Edit document" onClick={onEdit}>
                <Pencil size={16} />
              </IconButton>
              <IconButton label="Download original" onClick={onDownload}>
                <Download size={16} />
              </IconButton>
              <IconButton label="Remove document" onClick={onDelete}>
                <Trash2 size={16} />
              </IconButton>
              <IconButton label={focused ? 'Exit focus mode' : 'Focus mode'} onClick={onFocus}>
                {focused ? <Minimize size={16} /> : <Maximize size={16} />}
              </IconButton>
            </div>
          </div>
          <div
            ref={scroll}
            className="reader-scroll"
            tabIndex={0}
            aria-label="Score content"
            onWheel={() => setPlaying(false)}
            onTouchStart={() => setPlaying(false)}
            onPointerDown={() => setPlaying(false)}
            onKeyDown={() => setPlaying(false)}
            onScroll={(event) => {
              const element = event.currentTarget;
              setProgress(
                element.scrollHeight <= element.clientHeight
                  ? 100
                  : (element.scrollTop / (element.scrollHeight - element.clientHeight)) * 100,
              );
            }}
          >
            <article
              className={`score-page ${document.format === 'musicxml' || document.format === 'pdf' ? 'engraved' : ''}`}
            >
              <div className="print-title">
                <h2>{song.title}</h2>
                <p>{song.artist}</p>
              </div>
              <Suspense
                fallback={
                  <p className="reader-message" role="status">
                    Opening document...
                  </p>
                }
              >
                {document.format === 'chordpro' && (
                  <Chart document={document} semitones={semitones} zoom={zoom} />
                )}
                {document.format === 'text' && (
                  <pre className="tab-content" style={{ fontSize: (15 * zoom) / 100 }}>
                    {document.content}
                  </pre>
                )}
                {document.format === 'musicxml' && (
                  <MusicXmlView content={document.content} zoom={zoom} />
                )}
                {document.format === 'pdf' && <PdfView content={document.content} zoom={zoom} />}
              </Suspense>
            </article>
          </div>
          <footer className="reader-footer">
            <div className="tool-group">
              <IconButton
                label={playing ? 'Pause scrolling' : 'Start scrolling'}
                className={playing ? 'playing' : ''}
                aria-pressed={playing}
                onClick={() => setPlaying(!playing)}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </IconButton>
              <span>Auto-scroll</span>
              <input
                type="range"
                aria-label="Scroll speed"
                min={8}
                max={80}
                step={4}
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
              />
              <output className="speed-value">{speed} px/s</output>
            </div>
            <div className="tool-group">
              <output className="progress-value" aria-live="off">
                {Math.round(progress)}%
              </output>
              <IconButton
                label="Back to top"
                onClick={() => {
                  setPlaying(false);
                  scroll.current?.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <RotateCcw size={16} />
              </IconButton>
            </div>
          </footer>
        </>
      ) : (
        <div className="empty-state">
          <FileMusic size={36} />
          <h3>No documents yet</h3>
          <button className="button" onClick={onAttach}>
            <Plus size={16} />
            Attach document
          </button>
        </div>
      )}
    </section>
  );
}
