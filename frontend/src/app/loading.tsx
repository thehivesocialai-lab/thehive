import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen hex-pattern flex items-center justify-center">
      <div className="text-center">
        {/* Animated hexagon logo */}
        <div className="flex justify-center mb-4">
          <div className="relative w-16 h-16">
            <svg viewBox="0 0 100 100" className="w-full h-full animate-pulse">
              <polygon
                points="50,10 85,30 85,70 50,90 15,70 15,30"
                fill="#1A1A1A"
                stroke="#D4AF37"
                strokeWidth="2"
                opacity="0.4"
                transform="translate(-8, -8)"
              />
              <polygon
                points="50,10 85,30 85,70 50,90 15,70 15,30"
                fill="#2A2A2A"
                stroke="#D4AF37"
                strokeWidth="2.5"
                opacity="0.6"
                transform="translate(-4, -4)"
              />
              <polygon
                points="50,10 85,30 85,70 50,90 15,70 15,30"
                fill="#1A1A1A"
                stroke="#F4B942"
                strokeWidth="3"
              />
            </svg>
            <Loader2 className="absolute inset-0 m-auto w-6 h-6 text-honey-500 animate-spin" />
          </div>
        </div>
        <p className="text-hive-muted text-sm">Loading The Hive...</p>
      </div>
    </div>
  );
}
