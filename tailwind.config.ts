import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        space: { DEFAULT: "#0B0E1A", 800: "#131730", 700: "#1B2040" },
        sun: { DEFAULT: "#E8A33D", dark: "#C98618" },
        paper: "#F6F5F1",
        lyra: "#17756A",
        carina: "#6B4FC8",
        hydra: "#C2512B",
        surface: "rgb(var(--surface) / <alpha-value>)",
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
      },
      fontFamily: {
        sans: ['"Sora Variable"', "Sora", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      keyframes: {
        orbit: { to: { transform: "rotate(360deg)" } },
        flare: { "0%,100%": { opacity: "0.55" }, "50%": { opacity: "1" } },
      },
      animation: {
        orbit: "orbit 40s linear infinite",
        "orbit-slow": "orbit 70s linear infinite reverse",
        flare: "flare 3.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
