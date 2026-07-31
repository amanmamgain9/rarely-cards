type IconProps = { className?: string };

export function Star({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m12 1.5 2.65 7.22 7.65.28-6.02 4.73 2.1 7.35L12 16.8l-6.38 4.28 2.1-7.35L1.7 9l7.65-.28L12 1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Camera() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 7.5h3.1l1.5-2h5.8l1.5 2h3.1A1.5 1.5 0 0 1 21 9v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V9a1.5 1.5 0 0 1 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="13.3" r="3.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function Upload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14.5v4A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Printer() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 8V3.5h10V8M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6.5H7V14Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17.5" cy="11.5" r=".8" fill="currentColor" />
    </svg>
  );
}

export function Film() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4" stroke="currentColor" strokeWidth="1.6" />
      <path d="m11 9 4 3-4 3V9Z" fill="currentColor" />
    </svg>
  );
}
