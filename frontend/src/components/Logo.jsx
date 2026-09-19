// VeriTrail brand mark: a soft lavender square with a bold upward chevron
// (verified / on-track). Single source of truth so the topbar, login and
// splash screen, and favicon all stay visually identical.
export default function Logo({ size = 30, radius = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx={radius} fill="var(--brand-100, #e1e6fa)" />
      <path
        d="M24 63 L50 32 L76 63"
        fill="none"
        stroke="#ffffff"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
