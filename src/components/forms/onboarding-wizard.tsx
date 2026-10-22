"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Constellation } from "@/components/constellation";
import { Field, FormMessage } from "@/components/field";
import { Button } from "@/components/ui/button";
import { DEFAULT_AGENTS } from "@/lib/agents";
import { api, type ApiFailure } from "@/lib/client-api";

export interface OnboardingState {
  workspace: { id: string; slug: string; name: string } | null;
  agents: { key: string; name: string; role: string; color: string }[];
}

const STEPS = ["Workspace", "Your team", "First project"];

function StepFrame({ step, title, intro, children }: { step: number; title: string; intro: string; children: ReactNode }) {
  return (
    <div className="space-y-6">
      <ol className="flex gap-2" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i + 1 === step ? "step" : undefined} className="flex-1">
            <span className={`block h-1 rounded-full ${i + 1 <= step ? "bg-sun" : "bg-line"}`} />
            <span className="sr-only">{label}</span>
          </li>
        ))}
      </ol>
      <div className="space-y-1.5">
        <p className="font-mono text-xs text-muted">
          Step {step} of {STEPS.length}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted">{intro}</p>
      </div>
      {children}
    </div>
  );
}

export function OnboardingWizard({ initial }: { initial: OnboardingState }) {
  const router = useRouter();
  const [step, setStep] = useState(initial.workspace ? 2 : 1);
  const [workspace, setWorkspace] = useState(initial.workspace);
  const [agents, setAgents] = useState(initial.agents);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<Record<string, string[]>>({});

  const fail = (res: ApiFailure) => {
    setError(res.message);
    setFields(res.fields);
    setPending(false);
  };
  const begin = () => {
    setPending(true);
    setError(undefined);
    setFields({});
  };

  async function createWorkspace(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    begin();
    const res = await api<{ id: string; slug: string; name: string }>("/api/workspaces", { name: form.get("name"), description: form.get("description") || undefined });
    if (!res.ok) return fail(res);
    setWorkspace(res.data);
    // A new workspace is seeded with the default team, so step 3 can show it without another request.
    setAgents(DEFAULT_AGENTS.map(({ key, name, role, color }) => ({ key, name, role, color })));
    setPending(false);
    setStep(2);
  }

  async function saveAgents(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    begin();
    const next = [...agents];
    const errors: Record<string, string[]> = {};
    for (const [i, agent] of agents.entries()) {
      const name = String(form.get(agent.key) ?? "").trim();
      if (!name || name === agent.name) continue;
      const res = await api<{ name: string }>(`/api/workspaces/${workspace!.id}/agents/${agent.key}`, { name }, "PATCH");
      if (res.ok) next[i] = { ...agent, name: res.data.name };
      else errors[agent.key] = [res.fields.name?.[0] ?? res.message];
    }
    setAgents(next);
    setPending(false);
    if (Object.keys(errors).length) return setFields(errors);
    setStep(3);
  }

  async function createProject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    begin();
    const res = await api<{ slug: string }>(`/api/workspaces/${workspace!.id}/projects`, { name: form.get("name"), description: form.get("description") || undefined });
    if (!res.ok) return fail(res);
    router.replace(`/w/${res.data.slug}`);
    router.refresh();
  }

  const errorBox = error ? <FormMessage tone="error">{error}</FormMessage> : null;

  if (step === 1) {
    return (
      <StepFrame step={1} title="Create your workspace" intro="This is where you and your agents work. You can invite teammates later.">
        <form onSubmit={createWorkspace} className="space-y-4" noValidate>
          <Field label="Workspace name" id="name" required autoFocus error={fields.name?.[0]} />
          <Field label="Short description (optional)" id="description" error={fields.description?.[0]} />
          {errorBox}
          <Button type="submit" block disabled={pending}>
            {pending ? "Creating" : "Create workspace"}
          </Button>
        </form>
      </StepFrame>
    );
  }

  if (step === 3) {
    return (
      <StepFrame step={2} title="Meet your team" intro="Three agents work with you. Rename any of them if you like.">
        <form onSubmit={saveAgents} className="space-y-4" noValidate>
          <ul className="space-y-4">
            {agents.map((a) => (
              <li key={a.key} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
                <Constellation agent={a.key} color={a.color} size={36} />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm text-muted">{a.role}</p>
                  <Field label={`Name for ${a.role.toLowerCase()}`} id={a.key} defaultValue={a.name} error={fields[a.key]?.[0]} />
                </div>
              </li>
            ))}
          </ul>
          {errorBox}
          <Button type="submit" block disabled={pending}>
            {pending ? "Saving" : "Continue"}
          </Button>
        </form>
      </StepFrame>
    );
  }

  return (
    <StepFrame step={3} title="Start your first project" intro={`${agents.find((a) => a.key === "carina")?.name ?? "Carina"} will open the conversation with a kickoff question.`}>
      <form onSubmit={createProject} className="space-y-4" noValidate>
        <Field label="Project name" id="name" required autoFocus error={fields.name?.[0]} />
        <Field label="What is it about? (optional)" id="description" error={fields.description?.[0]} />
        {errorBox}
        <Button type="submit" block disabled={pending}>
          {pending ? "Creating" : "Create project"}
        </Button>
      </form>
    </StepFrame>
  );
}
