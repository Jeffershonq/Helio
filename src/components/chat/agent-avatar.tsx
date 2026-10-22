import { Constellation } from "@/components/constellation";
import type { AgentState } from "@/lib/chat-types";

/** Constellation avatar with a thin orbit ring: it turns while the agent works and stays still when idle. */
export function AgentAvatar({ agentKey, color, state = "idle", size = 40 }: { agentKey: string; color: string; state?: AgentState; size?: number }) {
  const active = state === "thinking" || state === "working";
  const ring = state === "error" ? "#C2512B" : color;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 44 44" className="absolute inset-0" aria-hidden="true">
        <circle cx="22" cy="22" r="20" fill="none" stroke={ring} strokeOpacity={active ? 0.5 : 0.25} strokeWidth="1" />
        <g className={active ? "animate-orbit" : ""} style={{ transformOrigin: "22px 22px", animationDuration: "6s" }}>
          <circle cx="22" cy="2" r="2.2" fill={ring} fillOpacity={active ? 1 : 0.5} />
        </g>
      </svg>
      <Constellation agent={agentKey} color={color} size={Math.round(size * 0.55)} />
    </span>
  );
}
