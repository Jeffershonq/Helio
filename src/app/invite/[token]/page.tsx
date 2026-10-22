import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/field";
import { AcceptInviteButton } from "@/components/forms/accept-invite-button";
import { LogoutButton } from "@/components/forms/logout-button";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";
import { lookupInvite, maskEmail } from "@/server/invite-service";

export const metadata: Metadata = { title: "Join a workspace" };

const ROLE_TEXT = { ADMIN: "an admin", MEMBER: "a member", VIEWER: "a viewer", OWNER: "the owner" } as const;

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await lookupInvite(token);

  if (found.state !== "valid" || !found.invite) {
    const text = {
      expired: "This invite has expired. Ask the person who invited you to send a new one.",
      used: "This invite was already used.",
      revoked: "This invite was cancelled.",
      invalid: "This invite link is not valid.",
    }[found.state === "valid" ? "invalid" : found.state];
    return (
      <AuthShell title="Invite unavailable" footer={<Link href="/" className="font-medium text-ink underline underline-offset-4">Go to Helio</Link>}>
        <FormMessage tone="error">{text}</FormMessage>
      </AuthShell>
    );
  }

  const { invite, inviterName } = found;
  const auth = await getSession();
  const here = `/invite/${token}`;
  const next = encodeURIComponent(here);
  const intro = `${inviterName} invited you to ${invite.workspace.name} as ${ROLE_TEXT[invite.role]}.`;

  if (!auth) {
    return (
      <AuthShell title={`Join ${invite.workspace.name}`} subtitle={`${intro} This invite is for ${maskEmail(invite.email)}.`}>
        <div className="space-y-3">
          <Button asChild block>
            <Link href={`/register?next=${next}`}>Create an account</Link>
          </Button>
          <Button asChild variant="secondary" block>
            <Link href={`/login?next=${next}`}>I already have an account</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (auth.user.email.toLowerCase() !== invite.email) {
    return (
      <AuthShell title={`Join ${invite.workspace.name}`} subtitle={intro}>
        <FormMessage tone="error">
          This invite is for {maskEmail(invite.email)}, but you are signed in as {auth.user.email}. Sign out and use the invited address.
        </FormMessage>
        <div className="rounded-lg bg-space p-3">
          <LogoutButton />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={`Join ${invite.workspace.name}`} subtitle={intro}>
      {auth.user.emailVerifiedAt ? (
        <AcceptInviteButton token={token} />
      ) : (
        <FormMessage tone="info">Confirm your email first, then come back to this link.</FormMessage>
      )}
    </AuthShell>
  );
}
