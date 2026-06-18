// "Mira" — the AI receptionist persona. Self-contained SVG portrait (no external
// asset) of a friendly, professional female receptionist with a headset.
// `speaking` adds a soft pulsing ring while her voice plays.
// Swap this for a photo/animated portrait later (drop an <img> in place).

export function MiraAvatar({
  speaking = false,
  size = 160,
}: {
  speaking?: boolean;
  size?: number;
}) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {speaking && (
        <>
          <span className="absolute inset-0 rounded-full bg-indigo-400/30 animate-ping" />
          <span className="absolute -inset-2 rounded-full ring-2 ring-indigo-400/40 animate-pulse" />
        </>
      )}
      <svg
        viewBox="0 0 160 160"
        width={size}
        height={size}
        className="relative rounded-full shadow-lg"
        role="img"
        aria-label="Mira, the AI receptionist"
      >
        <defs>
          <linearGradient id="ava-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <linearGradient id="ava-hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4b3526" />
            <stop offset="100%" stopColor="#2f2016" />
          </linearGradient>
          <clipPath id="ava-clip">
            <circle cx="80" cy="80" r="80" />
          </clipPath>
        </defs>

        <g clipPath="url(#ava-clip)">
          <rect width="160" height="160" fill="url(#ava-bg)" />
          {/* shoulders / blazer */}
          <path d="M30 160 q50 -42 100 0 Z" fill="#1f2937" />
          <path d="M62 132 q18 18 36 0 l0 28 l-36 0 Z" fill="#f1f5f9" />
          {/* hair back */}
          <path d="M44 78 q-6 50 14 70 l84 0 q14 -26 6 -64 q-8 -52 -52 -52 q-44 0 -52 46Z" fill="url(#ava-hair)" />
          {/* neck */}
          <rect x="70" y="104" width="20" height="22" rx="9" fill="#e8b894" />
          {/* face */}
          <ellipse cx="80" cy="84" rx="30" ry="33" fill="#f2c39b" />
          {/* hair front / fringe */}
          <path d="M50 80 q-2 -42 30 -44 q32 2 30 44 q-10 -20 -30 -20 q-20 0 -30 20Z" fill="url(#ava-hair)" />
          <path d="M50 80 q2 -16 8 -24 q-2 22 -8 24Z" fill="url(#ava-hair)" />
          <path d="M110 80 q-2 -16 -8 -24 q2 22 8 24Z" fill="url(#ava-hair)" />
          {/* eyes */}
          <ellipse cx="69" cy="82" rx="3.4" ry="4.2" fill="#3b2a20" />
          <ellipse cx="91" cy="82" rx="3.4" ry="4.2" fill="#3b2a20" />
          <circle cx="70.2" cy="80.6" r="1.1" fill="#fff" />
          <circle cx="92.2" cy="80.6" r="1.1" fill="#fff" />
          {/* brows */}
          <path d="M63 75 q6 -4 12 -1" stroke="#5c4433" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M85 74 q6 -3 12 1" stroke="#5c4433" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* nose */}
          <path d="M80 86 q2 6 -2 9" stroke="#d79b74" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          {/* smile */}
          <path d="M71 99 q9 8 18 0" stroke="#b65b4f" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          {/* cheeks */}
          <circle cx="64" cy="93" r="4" fill="#f0a98c" opacity="0.5" />
          <circle cx="96" cy="93" r="4" fill="#f0a98c" opacity="0.5" />
          {/* headset */}
          <path d="M50 84 q0 -34 30 -34 q30 0 30 34" stroke="#111827" strokeWidth="4" fill="none" strokeLinecap="round" />
          <rect x="44" y="80" width="9" height="16" rx="4" fill="#111827" />
          <rect x="107" y="80" width="9" height="16" rx="4" fill="#111827" />
          <path d="M48 96 q-6 14 14 18" stroke="#111827" strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="63" cy="115" r="3.2" fill="#22d3ee" />
        </g>
      </svg>
    </div>
  );
}
