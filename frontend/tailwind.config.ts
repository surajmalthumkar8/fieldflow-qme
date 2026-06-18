import type { Config } from "tailwindcss";

/**
 * FieldFlow design system — "field-operations control room."
 * Warm paper content surfaces + deep ink chrome, engineered type
 * (Bricolage / Hanken / IBM Plex Mono), money-emerald + hi-vis amber signals,
 * a subtle blueprint texture. Token NAMES are stable (ink/signal/money/warn/
 * danger) so existing code keeps working; values are tuned for a premium,
 * non-generic look. `paper` + `flare` are additive.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm paper — content background. Not pure white (reads as designed, not default).
        paper: {
          DEFAULT: "#f6f4ee",
          50: "#fbfaf6",
          100: "#f6f4ee",
          200: "#ece8dd",
          300: "#ddd6c5",
        },
        // Ink — deep, slightly cool near-black for chrome/dark surfaces + text.
        ink: {
          50: "#f4f5f7",
          100: "#e8eaef",
          200: "#d2d6df",
          300: "#aab1c0",
          400: "#7c8598",
          500: "#586073",
          600: "#434b5c",
          700: "#343a48",
          800: "#232833",
          900: "#12151d",
          950: "#0a0c12",
        },
        // Signal — confident cobalt (primary brand/action). Distinct from purple-gradient cliché.
        signal: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c5d2ff",
          300: "#9fb2ff",
          400: "#7289ff",
          500: "#4c63f5",
          600: "#3547e6",
          700: "#2a36c4",
          800: "#26309e",
          900: "#252f7d",
          950: "#171a44",
        },
        // Money — emerald, the hero of an attribution product.
        money: {
          50: "#e9fbf2",
          100: "#cdf6e0",
          200: "#9eecc4",
          400: "#34d39e",
          500: "#10b981",
          600: "#059669",
          700: "#04734f",
          900: "#053a2c",
        },
        // Flare — hi-vis amber, the trades signature accent: "live", recordings, emphasis.
        flare: {
          50: "#fff8eb",
          100: "#feefc7",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        // Warn (amber, shares the flare family — kept for existing usage).
        warn: {
          50: "#fff8eb",
          100: "#feefc7",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        danger: {
          50: "#fef2f2",
          100: "#fee2e2",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(18 21 29 / 0.04), 0 1px 3px 0 rgb(18 21 29 / 0.05)",
        "card-lg": "0 12px 32px -12px rgb(18 21 29 / 0.18), 0 2px 6px -2px rgb(18 21 29 / 0.06)",
        pop: "0 24px 60px -20px rgb(18 21 29 / 0.45)",
        "inner-line": "inset 0 -1px 0 0 rgb(18 21 29 / 0.06)",
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      backgroundImage: {
        // Blueprint dot-grid + faint mesh for dark surfaces (depth, "engineering" feel).
        "blueprint":
          "radial-gradient(rgb(255 255 255 / 0.06) 1px, transparent 1px)",
        "ink-mesh":
          "radial-gradient(60% 80% at 80% 0%, rgb(76 99 245 / 0.18), transparent 60%), radial-gradient(50% 60% at 0% 100%, rgb(16 185 129 / 0.12), transparent 55%)",
      },
      backgroundSize: {
        "grid-16": "16px 16px",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "rise": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.85)", opacity: "0.7" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        "bar-grow": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        "ticker": {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "16px 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        "rise": "rise 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "pulse-ring": "pulse-ring 1.6s cubic-bezier(0.215,0.61,0.355,1) infinite",
        "bar-grow": "bar-grow 0.8s cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
