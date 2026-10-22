"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="onDark"
      block
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await api("/api/auth/logout");
        router.replace("/login");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
