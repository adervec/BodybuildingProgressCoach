interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

const PATHS: Record<string, string> = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  capture: 'M12 16a4 4 0 100-8 4 4 0 000 8zM3 7h3l2-3h8l2 3h3v13H3V7z',
  pose: 'M12 6a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM5 22l2.5-9M19 22l-2.5-9M7.5 13h9M9 9l-3 3M15 9l3 3',
  physique: 'M3 12h3l2 6 4-16 3 12 2-6h4',
  compare: 'M12 3v18M5 7l-2 5 2 5M19 7l2 5-2 5',
  timelapse: 'M3 5h18v14H3zM3 9l4-3M9 6l4-3M15 6l4-3M9 12l4 3 4-4',
  guide: 'M4 4h7a2 2 0 012 2v14a2 2 0 00-2-2H4V4zm16 0h-7a2 2 0 00-2 2v14a2 2 0 012-2h7V4z',
  athletes: 'M8 11a3 3 0 100-6 3 3 0 000 6zM16 11a3 3 0 100-6 3 3 0 000 6zM2 21c0-3 2.5-5 6-5M22 21c0-3-2.5-5-6-5M8 21c0-2.2 1.8-4 4-4s4 1.8 4 4',
  ai: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5zM19 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
  plus: 'M12 5v14M5 12h14',
  camera: 'M12 16a4 4 0 100-8 4 4 0 000 8zM3 7h3l2-3h8l2 3h3v13H3V7z',
  play: 'M7 4l13 8-13 8V4z',
  download: 'M12 3v12M7 11l5 4 5-4M4 21h16',
  check: 'M4 12l5 5L20 6',
  upload: 'M12 21V9M7 13l5-4 5 4M4 5h16',
  spark: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z',
  scale: 'M12 3v3M5 8h14l-2.5 8h-9L5 8zM12 6a2 2 0 100-.01',
  chevron: 'M9 6l6 6-6 6',
};

export function Icon({ name, size = 18, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}
