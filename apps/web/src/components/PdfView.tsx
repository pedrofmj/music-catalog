import { useEffect, useRef, useState } from 'react';
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type RenderTask,
} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { decodeBase64 } from '@music-catalog/core';

GlobalWorkerOptions.workerSrc = workerUrl;

function Page({ pdf, number, zoom }: { pdf: PDFDocumentProxy; number: number; zoom: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(600);
  const [error, setError] = useState('');
  useEffect(() => {
    const element = ref.current!;
    const intersection = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { rootMargin: '300px' },
    );
    const resize = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    intersection.observe(element);
    resize.observe(element);
    return () => {
      intersection.disconnect();
      resize.disconnect();
    };
  }, []);
  useEffect(() => {
    if (!visible || width <= 0) return;
    let cancelled = false;
    let render: RenderTask | undefined;
    const element = canvas.current!;
    void (async () => {
      try {
        const page = await pdf.getPage(number);
        if (cancelled) return;
        const original = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({
          scale: (width / original.width) * Math.min(window.devicePixelRatio || 1, 2),
        });
        element.width = viewport.width;
        element.height = viewport.height;
        render = page.render({ canvas: element, viewport });
        await render.promise;
      } catch (error) {
        if (!cancelled)
          setError(error instanceof Error ? error.message : 'Could not render this page.');
      }
    })();
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [pdf, number, visible, width]);
  return (
    <div ref={ref} className="pdf-page" style={{ width: `${zoom}%` }}>
      <canvas ref={canvas} aria-label={`Score page ${number}`} />
      <span className="page-number">{number}</span>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}

export default function PdfView({ content, zoom }: { content: string; zoom: number }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setPdf(undefined);
    setError('');
    const task = getDocument({ data: decodeBase64(content), useSystemFonts: true });
    void task.promise
      .then((document) => {
        if (!cancelled) setPdf(document);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            'This PDF could not be opened. Password-protected or damaged PDFs are not supported.',
          );
      });
    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [content]);
  if (error)
    return (
      <p role="alert" className="reader-message error">
        {error}
      </p>
    );
  if (!pdf)
    return (
      <p role="status" className="reader-message">
        Opening PDF...
      </p>
    );
  return (
    <div className="pdf-document">
      {Array.from({ length: pdf.numPages }, (_, index) => (
        <Page key={index} pdf={pdf} number={index + 1} zoom={zoom} />
      ))}
    </div>
  );
}
