'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';

interface PdfThumbnailProps {
  url: string;
  className?: string;
}

export function PdfThumbnail({ url, className = '' }: PdfThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  // Intersection observer for lazy loading
  useEffect(() => {
    if (isMobile) return; // Skip on mobile

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [isMobile]);

  // Render PDF only when visible and not mobile
  useEffect(() => {
    if (!isVisible || isMobile) return;

    let cancelled = false;

    async function renderThumbnail() {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        const page = await pdf.getPage(1);

        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const viewport = page.getViewport({ scale: 0.25 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        if (!cancelled) {
          setLoading(false);
        }
      } catch (err) {
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
  }, [url, isVisible, isMobile]);

  // Mobile fallback - just show icon
  if (isMobile) {
    return (
      <div className={`flex items-center justify-center bg-gray-800 ${className}`}>
        <FileText className="w-10 h-10 text-red-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div ref={containerRef} className={`flex items-center justify-center bg-gray-800 ${className}`}>
        <FileText className="w-8 h-8 text-red-400" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative bg-gray-800 ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <FileText className="w-8 h-8 text-gray-600" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`w-full h-full object-cover ${loading ? 'opacity-0' : 'opacity-100'}`}
      />
    </div>
  );
}
