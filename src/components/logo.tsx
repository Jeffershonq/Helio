import { cn } from "@/lib/utils";

interface MarkProps {
  size?: number;
  animated?: boolean;
  /** Brighter star colours for dark backgrounds. */
  onDark?: boolean;
  className?: string;
}

const STARS = {
  light: ["#17756A", "#6B4FC8", "#C2512B"],
  dark: ["#3CC4B0", "#A08CF0", "#F0865E"],
};

/** The Helio mark: a Sun, a thin orbit ring, and three dots (Lyra, Carina, Hydra). */
export function HelioMark({ size = 32, animated = false, onDark = false, className }: MarkProps) {
  const colors = onDark ? STARS.dark : STARS.light;
  const dots = [-90, 30, 150].map((deg, i) => {
    const rad = (deg * Math.PI) / 180;
    return { cx: 50 + 38 * Math.cos(rad), cy: 50 + 38 * Math.sin(rad), fill: colors[i]! };
  });
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Helio" className={className}>
      <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="19" fill="#E8A33D" fillOpacity="0.22" />
      <circle cx="50" cy="50" r="12" fill="#E8A33D" />
      <g className={cn(animated && "animate-orbit")} style={{ transformOrigin: "50px 50px" }}>
        {dots.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r="5.5" fill={d.fill} />
        ))}
      </g>
    </svg>
  );
}

export function Wordmark({ size = 28, onDark = false, className }: { size?: number; onDark?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", onDark ? "text-white" : "text-ink", className)}>
      <HelioMark size={size} onDark={onDark} />
      <span className="text-lg font-semibold tracking-tight">Helio</span>
    </span>
  );
}
