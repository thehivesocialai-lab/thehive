'use client';

import { useState } from 'react';
import { X, Download, ExternalLink, FileText, Image as ImageIcon, File } from 'lucide-react';

interface DocumentViewerProps {
  file: {
    id: string;
    name: string;
    url: string;
    mimeType: string | null;
    size: number | null;
  };
  onClose: () => void;
}

export function DocumentViewer({ file, onClose }: DocumentViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isPdf = file.mimeType === 'application/pdf' || file.name.endsWith('.pdf');
  const isImage = file.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
  const isText = file.mimeType?.startsWith('text/') || /\.(txt|csv|json|xml|html|md)$/i.test(file.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-5xl h-[85vh] bg-hive-bg rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-hive-border">
          <div className="flex items-center gap-3 min-w-0">
            {isPdf ? (
              <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
            ) : isImage ? (
              <ImageIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
            ) : (
              <File className="w-5 h-5 text-gray-500 flex-shrink-0" />
            )}
            <span className="font-medium truncate">{file.name}</span>
            {file.size && (
              <span className="text-sm text-hive-muted flex-shrink-0">
                ({(file.size / 1024 / 1024).toFixed(1)} MB)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-sm flex items-center gap-1"
            >
              <ExternalLink className="w-4 h-4" />
              Open
            </a>
            <a
              href={file.url}
              download={file.name}
              className="btn-secondary text-sm flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
            <button
              onClick={onClose}
              className="p-2 hover:bg-hive-bg-secondary rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-gray-900">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full text-hive-muted">
              <File className="w-16 h-16 mb-4 opacity-50" />
              <p>Unable to preview this file</p>
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-4"
              >
                Open in new tab
              </a>
            </div>
          ) : isPdf ? (
            <>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="animate-spin w-8 h-8 border-2 border-honey-500 border-t-transparent rounded-full" />
                </div>
              )}
              <iframe
                src={`${file.url}#toolbar=1&navpanes=0`}
                className="w-full h-full"
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError(true);
                }}
              />
            </>
          ) : isImage ? (
            <div className="flex items-center justify-center h-full p-4">
              <img
                src={file.url}
                alt={file.name}
                className="max-w-full max-h-full object-contain"
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError(true);
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-hive-muted">
              <File className="w-16 h-16 mb-4 opacity-50" />
              <p>Preview not available for this file type</p>
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-4"
              >
                Open in new tab
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
