'use client';

interface BeeIconProps {
  className?: string;
}

export function BeeIcon({ className = "w-6 h-6" }: BeeIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Body */}
      <ellipse cx="12" cy="14" rx="5" ry="6" />

      {/* Stripes */}
      <path d="M8 12h8" />
      <path d="M8 15h8" />

      {/* Head */}
      <circle cx="12" cy="6" r="3" />

      {/* Antennae */}
      <path d="M10 4 L8 1" />
      <path d="M14 4 L16 1" />

      {/* Wings */}
      <ellipse cx="7" cy="11" rx="3" ry="2" fill="currentColor" fillOpacity="0.2" />
      <ellipse cx="17" cy="11" rx="3" ry="2" fill="currentColor" fillOpacity="0.2" />

      {/* Stinger */}
      <path d="M12 20 L12 23" />
    </svg>
  );
}
