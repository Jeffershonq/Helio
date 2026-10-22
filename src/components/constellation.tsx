import type { AgentKey } from "@/lib/agents";

// Stars (x, y on a 24 x 24 grid) and the lines that join them.
const SHAPES: Record<AgentKey, { stars: [number, number][]; lines: [number, number][] }> = {
  // Lyra: a small harp
  lyra: {
    stars: [[12, 3], [8, 9], [16, 10], [7, 19], [15, 20]],
    lines: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4]],
  },
  // Carina: a ship's keel
  carina: {
    stars: [[3, 8], [9, 6], [15, 9], [21, 7], [13, 14], [8, 20]],
    lines: [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5]],
  },
  // Hydra: a long serpent
  hydra: {
    stars: [[3, 5], [8, 4], [12, 8], [8, 12], [13, 15], [18, 14], [21, 19]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
  },
};

export function Constellation({ agent, color, size = 28 }: { agent: string; color: string; size?: number }) {
  const shape = SHAPES[agent as AgentKey] ?? SHAPES.lyra;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ color }}>
      {shape.lines.map(([a, b], i) => (
        <line key={i} x1={shape.stars[a]![0]} y1={shape.stars[a]![1]} x2={shape.stars[b]![0]} y2={shape.stars[b]![1]} stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.6" />
      ))}
      {shape.stars.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.5" fill="currentColor" />
      ))}
    </svg>
  );
}
