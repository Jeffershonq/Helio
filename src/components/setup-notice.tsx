import Link from "next/link";
import type { Tier } from "@/lib/gateway/types";

/** Tells people why agents are not answering yet, in plain words, with the way to fix it. */
export function SetupNotice({
  status,
  canManage,
  slug,
}: {
  status: { platformEnabled: boolean; missingTiers: Tier[] };
  canManage: boolean;
  slug: string;
}) {
  if (status.missingTiers.length === 0) return null;
  const tiers = status.missingTiers.map((t) => t.toLowerCase()).join(", ");
  const noProvider = !status.platformEnabled;

  const what = noProvider
    ? "No model provider is set up on this Helio install, so your agents cannot answer."
    : `The shared provider has no model for the ${tiers} tier, so those agents cannot answer.`;
  const fix = noProvider
    ? canManage
      ? "Add your own API key to get started."
      : "Ask an owner or admin to finish the setup."
    : "Ask whoever runs this Helio install to set one.";

  return (
    <p role="status">
      {what} {fix}{" "}
      {noProvider && canManage ? (
        <Link href={`/w/${slug}/settings`} className="font-semibold underline underline-offset-4">
          Open settings
        </Link>
      ) : null}
    </p>
  );
}
