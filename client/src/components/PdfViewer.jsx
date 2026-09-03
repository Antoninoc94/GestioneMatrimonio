import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Renders every page of a PDF as a stacked canvas inside a normal scrollable
// div, instead of an iframe: mobile WebKit only shows page 1 of an
// iframe-embedded PDF and can't scroll past it, so we render pages ourselves.
export default function PdfViewer({ url }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let pdfDoc = null;
    const container = containerRef.current;
    container.innerHTML = '';
    setError(null);

    (async () => {
      try {
        pdfDoc = await pdfjsLib.getDocument({ url }).promise;
        const dpr = window.devicePixelRatio || 1;
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          if (cancelled) return;
          const page = await pdfDoc.getPage(i);
          const containerWidth = container.clientWidth - 16;
          const unscaled = page.getViewport({ scale: 1 });
          const scale = containerWidth > 0 ? containerWidth / unscaled.width : 1;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width * dpr;
          canvas.height = viewport.height * dpr;
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          canvas.className = 'shadow rounded mb-3 max-w-full';
          const ctx = canvas.getContext('2d');
          ctx.scale(dpr, dpr);
          container.appendChild(canvas);

          if (cancelled) return;
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      } catch (e) {
        console.error('PdfViewer error:', e);
        if (!cancelled) setError(e);
      }
    })();

    return () => {
      cancelled = true;
      pdfDoc?.destroy();
    };
  }, [url]);

  if (error) {
    return <p className="text-red-500 text-sm">Impossibile caricare l'anteprima del PDF.</p>;
  }

  return <div ref={containerRef} className="w-full h-full overflow-auto flex flex-col items-center py-2" />;
}
