export default function Logo({ className = "size-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
      </defs>
      <path
        d="M12 2L2 7l10 5 10-5-10-5z"
        fill="url(#logo-gradient)"
        opacity="0.8"
      />
      <path
        d="M2 17l10 5 10-5M2 12l10 5 10-5"
        stroke="url(#logo-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
