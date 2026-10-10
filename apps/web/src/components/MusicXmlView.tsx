import { useEffect, useRef, useState } from 'react';

export default function MusicXmlView({ content, zoom }: { content: string; zoom: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const container = ref.current!;
    const host = document.createElement('div');
    container.append(host);
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    let timer: ReturnType<typeof setTimeout>;
    setError('');
    setLoading(true);
    void (async () => {
      try {
        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');
        if (cancelled) return;
        const display = new OpenSheetMusicDisplay(host, {
          autoResize: false,
          backend: 'svg',
          drawTitle: false,
          drawComposer: false,
        });
        await display.load(content);
        if (cancelled) return;
        display.Zoom = zoom / 100;
        display.render();
        setLoading(false);
        observer = new ResizeObserver(() => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            if (!cancelled) display.render();
          }, 150);
        });
        observer.observe(container);
      } catch {
        if (!cancelled) {
          setError(
            'This score could not be rendered. Its original file is still available to download.',
          );
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      observer?.disconnect();
      host.remove();
    };
  }, [content, zoom]);
  return (
    <>
      <div ref={ref} className="musicxml" aria-label="Sheet music" />
      {loading && (
        <p className="reader-message" role="status">
          Engraving score...
        </p>
      )}
      {error && (
        <p className="reader-message error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
