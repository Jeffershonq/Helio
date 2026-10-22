// Runs live in this process for now, so "Stop" can abort the model request.
// Phase 3 moves runs to a worker; Stop then travels over a Redis control channel instead.
// globalThis keeps one shared map even when the framework bundles routes separately.
const g = globalThis as unknown as { __helioRuns?: Map<string, AbortController> };
const runs = () => (g.__helioRuns ??= new Map());

export const registerRun = (runId: string, controller: AbortController) => void runs().set(runId, controller);
export const unregisterRun = (runId: string) => void runs().delete(runId);

export function stopRun(runId: string): boolean {
  const controller = runs().get(runId);
  if (!controller) return false;
  controller.abort();
  return true;
}
