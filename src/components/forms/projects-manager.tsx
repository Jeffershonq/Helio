"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormMessage } from "@/components/field";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

export interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
  defaultAgentKey: string | null;
}

export function ProjectsManager({
  workspaceId,
  slug,
  projects,
  agents,
  canWrite,
}: {
  workspaceId: string;
  slug: string;
  projects: ProjectRow[];
  agents: { key: string; name: string }[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<Record<string, string[]>>({});

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(undefined);
    setFields({});
    const res = await api<{ id: string }>(`/api/workspaces/${workspaceId}/projects`, { name: form.get("name"), description: form.get("description") || undefined });
    if (!res.ok) {
      setError(res.message);
      setFields(res.fields);
      setPending(false);
      return;
    }
    router.push(`/w/${slug}/p/${res.data.id}`);
    router.refresh();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setError(undefined);
    const res = await api(`/api/workspaces/${workspaceId}/projects/${id}`, body, "PATCH");
    if (!res.ok) return setError(res.message);
    router.refresh();
  }

  const active = projects.filter((p) => !p.archived);
  const archived = projects.filter((p) => p.archived);

  return (
    <div className="space-y-10">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      {canWrite ? (
        <form onSubmit={create} className="max-w-md space-y-4" noValidate>
          <h2 className="text-base font-semibold">New project</h2>
          <Field label="Project name" id="name" required error={fields.name?.[0]} />
          <Field label="What is it about? (optional)" id="description" error={fields.description?.[0]} />
          <Button type="submit" disabled={pending}>
            {pending ? "Creating" : "Create project"}
          </Button>
        </form>
      ) : null}

      <section aria-labelledby="active-projects" className="space-y-3">
        <h2 id="active-projects" className="text-base font-semibold">
          Projects
        </h2>
        {active.length === 0 ? <p className="text-sm text-muted">All quiet in the system. No projects yet.</p> : null}
        <ul className="space-y-3">
          {active.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
              <div className="min-w-0">
                <Link href={`/w/${slug}/p/${p.id}`} className="text-sm font-semibold underline-offset-4 hover:underline">
                  {p.name}
                </Link>
                {p.description ? <p className="truncate text-xs text-muted">{p.description}</p> : null}
              </div>
              {canWrite ? (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-muted">
                    Answers by default
                    <select
                      value={p.defaultAgentKey ?? ""}
                      onChange={(e) => void patch(p.id, { defaultAgentKey: e.target.value })}
                      className="min-h-[44px] rounded-lg border border-line bg-surface px-2 text-sm text-ink"
                    >
                      {agents.map((a) => (
                        <option key={a.key} value={a.key}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button type="button" variant="secondary" onClick={() => void patch(p.id, { archived: true })}>
                    Archive
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {archived.length ? (
        <section aria-labelledby="archived-projects" className="space-y-3">
          <h2 id="archived-projects" className="text-base font-semibold">
            Archived
          </h2>
          <ul className="space-y-3">
            {archived.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-line p-4">
                <span className="text-sm text-muted">{p.name}</span>
                {canWrite ? (
                  <Button type="button" variant="secondary" onClick={() => void patch(p.id, { archived: false })}>
                    Restore
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
