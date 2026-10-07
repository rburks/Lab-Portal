// The portal's mark: an AI sparkle on the accent color. Uses theme colors, so it follows light and dark mode.
export default function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg className="logo-svg" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <g fill="var(--accent-ink)">
        <path d="M13.5 9Q15.02 16.98 23 18.5Q15.02 20.02 13.5 28Q11.98 20.02 4 18.5Q11.98 16.98 13.5 9Z" />
        <path d="M23.5 4Q24.22 7.78 28 8.5Q24.22 9.22 23.5 13Q22.78 9.22 19 8.5Q22.78 7.78 23.5 4Z" />
        <path d="M24.5 20.9Q24.92 23.08 27.1 23.5Q24.92 23.92 24.5 26.1Q24.08 23.92 21.9 23.5Q24.08 23.08 24.5 20.9Z" />
      </g>
    </svg>
  );
}
