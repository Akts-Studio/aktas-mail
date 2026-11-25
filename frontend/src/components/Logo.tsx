import { useId } from "react";

/**
 * Aktaş Mail markası — Spacemail + akts-design dili.
 *
 * Koyu uzay-karo (#0b0e18 → #151b33) üstünde %14 beyaz iç çerçeve,
 * elektrik indigo → camgöbeği degradeli geometrik zarf/A monogramı.
 * `gradientUnits="userSpaceOnUse"` ile yatay/dikey çizgiler kaybolmaz.
 */
export function Logo({
  size = 44,
  muted = false,
  className,
}: {
  size?: number;
  muted?: boolean;
  className?: string;
}) {
  const id = useId();
  const safe = id.replace(/:/g, "");
  const bgId = `am-bg-${safe}`;
  const glyphId = `am-gl-${safe}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="Aktaş Mail"
      style={muted ? { opacity: 0.28 } : undefined}
    >
      <defs>
        <linearGradient id={bgId} x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#161d38" />
          <stop offset="1" stopColor="#0a0d17" />
        </linearGradient>
        <linearGradient id={glyphId} x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#a5b4fc" />
          <stop offset="0.52" stopColor="#6366f1" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="11.5" fill={`url(#${bgId})`} />
      <rect
        x="2.75"
        y="2.75"
        width="42.5"
        height="42.5"
        rx="10.75"
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="1.5"
      />
      {/* Stilize zarf + yükselen A kanadı */}
      <path
        d="M12.5 33.5 L24 13.5 L35.5 33.5"
        fill="none"
        stroke="#f8fafc"
        strokeWidth="3.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.2 26.8 L24 31.6 L31.8 26.8"
        fill="none"
        stroke={`url(#${glyphId})`}
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
