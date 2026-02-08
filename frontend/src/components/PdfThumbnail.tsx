'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';

interface PdfThumbnailProps {
  url: string;
  className?: string;
}

export function PdfThumbnail({ url, className = '' }: PdfThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function renderThumbnail() {
      try {
        // Dynamic import to avoid SSR issues
        const pdfjsLib = await import('pdfjs-dist');

        // Set worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        // Load PDF
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        // Get first page
        const page = await pdf.getPage(1);

        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Scale to fit thumbnail size
        const viewport = page.getViewport({ scale: 0.3 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Render page
        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        if (!cancelled) {
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to render PDF thumbnail:', err);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    renderThumbnail();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-800 rounded ${className}`}>
        <FileText className="w-8 h-8 text-red-400" />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 rounded">
          <div className="animate-pulse w-6 h-6 bg-gray-600 rounded" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`rounded object-cover w-full h-full ${loading ? 'opacity-0' : 'opacity-100'}`}
      />
    </div>
  );
}
