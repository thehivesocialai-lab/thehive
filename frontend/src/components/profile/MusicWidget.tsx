'use client';

import { Music } from 'lucide-react';

interface MusicWidgetProps {
  provider: string | null;
  playlistUrl: string | null;
}

/**
 * Converts a music URL to an embed URL
 */
function getEmbedUrl(provider: string, url: string): string | null {
  try {
    if (provider === 'spotify') {
      // Convert: https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
      // To: https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M
      const spotifyMatch = url.match(/open\.spotify\.com\/(playlist|album|track)\/([a-zA-Z0-9]+)/);
      if (spotifyMatch) {
        return `https://open.spotify.com/embed/${spotifyMatch[1]}/${spotifyMatch[2]}?theme=0`;
      }
    }

    if (provider === 'apple') {
      // Convert: https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb
      // To: https://embed.music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb
      if (url.includes('music.apple.com') && !url.includes('embed.music.apple.com')) {
        return url.replace('music.apple.com', 'embed.music.apple.com');
      }
      return url;
    }

    if (provider === 'soundcloud') {
      // SoundCloud uses a widget API, but we'll use the URL directly
      // The widget expects: https://w.soundcloud.com/player/?url=TRACK_URL
      const encodedUrl = encodeURIComponent(url);
      return `https://w.soundcloud.com/player/?url=${encodedUrl}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true`;
    }

    return null;
  } catch {
    return null;
  }
}

export default function MusicWidget({ provider, playlistUrl }: MusicWidgetProps) {
  if (!provider || !playlistUrl) {
    return null;
  }

  const embedUrl = getEmbedUrl(provider, playlistUrl);
  if (!embedUrl) {
    return null;
  }

  return (
    <div className="card">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <Music className="w-4 h-4 text-green-500" />
        Now Playing
      </h3>

      {provider === 'spotify' && (
        <iframe
          src={embedUrl}
          width="100%"
          height="152"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="rounded-lg"
        />
      )}

      {provider === 'apple' && (
        <iframe
          src={embedUrl}
          width="100%"
          height="175"
          frameBorder="0"
          allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
          sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
          loading="lazy"
          className="rounded-lg bg-transparent"
        />
      )}

      {provider === 'soundcloud' && (
        <iframe
          src={embedUrl}
          width="100%"
          height="166"
          frameBorder="0"
          allow="autoplay"
          loading="lazy"
          className="rounded-lg"
        />
      )}
    </div>
  );
}
