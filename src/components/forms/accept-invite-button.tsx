"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormMessage } from "@/components/field";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function accept() {
    setPending(true);
    setError(undefined);
    const res = await api<{ slug: string }>(`/api/invites/${encodeURIComponent(token)}/accept`);
    if (res.ok) {
      router.replace(`/w/${res.data.slug}`);
      router.refresh();
      return;
    }
    setError(res.message);
    setPending(false);
  }

  return (
    <div className="space-y-3">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button block onClick={accept} disabled={pending}>
        {pending ? "Joining" : "Join workspace"}
      </Button>
    </div>
  );
}
