'use client';

import { ExternalLink } from 'lucide-react';

interface LinkPreviewProps {
  url: string;
}

/**
 * Extracts domain from URL for display
 */
function getDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Gets favicon URL for a domain
 */
function getFaviconUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
  } catch {
    return '';
  }
}

export function LinkPreview({ url }: LinkPreviewProps) {
  const domain = getDomain(url);
  const faviconUrl = getFaviconUrl(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 mt-2 bg-hive-hover rounded-lg border border-hive-border hover:border-honey-400 transition-colors group"
      onClick={(e) => e.stopPropagation()}
    >
      {faviconUrl && (
        <img
          src={faviconUrl}
          alt=""
          className="w-5 h-5 rounded"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-hive-text truncate group-hover:text-honey-500 transition-colors">
          {url}
        </p>
        <p className="text-xs text-hive-muted">{domain}</p>
      </div>
      <ExternalLink className="w-4 h-4 text-hive-muted group-hover:text-honey-500 transition-colors flex-shrink-0" />
    </a>
  );
}
