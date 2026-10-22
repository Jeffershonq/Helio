"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormMessage } from "@/components/field";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

const TIER_TEXT = { LIGHT: "Light", MEDIUM: "Medium", HEAVY: "Heavy" } as const;
type Tier = keyof typeof TIER_TEXT;
type TierValue = { model?: string; fallback?: string; inputPerMTok?: number; outputPerMTok?: number };

export interface ProviderSettingsProps {
  workspaceId: string;
  mode: "PLATFORM" | "OWN";
  fallbackToPlatform: boolean;
  platformEnabled: boolean;
  own: { baseUrl: string; last4: string } | null;
  ownTiers: Partial<Record<Tier, TierValue>>;
  usedBy: Record<Tier, string[]>; // agent names per tier
}

export function ProviderSettings(p: ProviderSettingsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string }>();
  const [conn, setConn] = useState<{ ok: boolean; message: string; modelCount?: number }>();
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [models, setModels] = useState<string[]>([]);
  const base = `/api/workspaces/${p.workspaceId}`;

  const status =
    p.mode === "OWN" && p.own
      ? p.fallbackToPlatform && p.platformEnabled
        ? "Your agents use your own API key first. If it fails, they use the shared provider."
        : "Your agents use your own API key."
      : p.platformEnabled
        ? "Your agents use the shared Helio provider. There is nothing to set up."
        : "This install has no shared provider. Add your own API key below so your agents can answer.";

  async function settings(body: Record<string, unknown>) {
    setMessage(undefined);
    const res = await api(`${base}/provider/settings`, body, "PATCH");
    if (!res.ok) return setMessage({ tone: "error", text: res.message });
    router.refresh();
  }

  async function connect(form: HTMLFormElement | null, mode: "test" | "save") {
    if (!form) return;
    const f = new FormData(form);
    const body = { baseUrl: f.get("baseUrl"), apiKey: f.get("apiKey") };
    setPending(true);
    setFields({});
    setConn(undefined);
    setMessage(undefined);
    const res =
      mode === "test"
        ? await api<{ ok: boolean; message: string; modelCount?: number }>(`${base}/provider/test`, body)
        : await api(`${base}/provider`, { ...body, label: "Default" }, "PUT");
    setPending(false);
    if (!res.ok) {
      setFields(res.fields);
      return setMessage({ tone: "error", text: res.message });
    }
    if (mode === "test") return setConn(res.data as { ok: boolean; message: string; modelCount?: number });
    setMessage({ tone: "success", text: "Key saved. It is encrypted and will not be shown again. Now choose a model for each tier below." });
    router.refresh();
  }

  async function removeKey() {
    if (!window.confirm("Remove your own API key? Your agents will go back to the shared provider.")) return;
    const res = await api(`${base}/provider`, undefined, "DELETE");
    if (!res.ok) return setMessage({ tone: "error", text: res.message });
    router.refresh();
  }

  async function loadModels() {
    setMessage(undefined);
    const res = await api<{ ok: boolean; message: string; models: string[] }>(`${base}/provider/models`, undefined, "GET");
    if (!res.ok) return setMessage({ tone: "error", text: res.message });
    if (!res.data.ok) return setMessage({ tone: "error", text: res.data.message });
    setModels(res.data.models);
    setMessage({ tone: "success", text: `${res.data.models.length} models found. Start typing in a model field to pick one.` });
  }

  async function saveTiers(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const num = (k: string) => (f.get(k) ? Number(f.get(k)) : null);
    const body = Object.fromEntries(
      (Object.keys(TIER_TEXT) as Tier[]).map((t) => [
        t,
        { model: String(f.get(`${t}-model`) ?? ""), fallback: String(f.get(`${t}-fallback`) ?? ""), inputPerMTok: num(`${t}-in`), outputPerMTok: num(`${t}-out`) },
      ]),
    );
    setPending(true);
    setMessage(undefined);
    const res = await api(`${base}/models`, body, "PUT");
    setPending(false);
    if (!res.ok) return setMessage({ tone: "error", text: res.message });
    setMessage({ tone: "success", text: "Saved. Your agents will use these models from their next answer." });
    router.refresh();
  }

  return (
    <div className="space-y-12">
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      <section className="max-w-xl space-y-2" aria-labelledby="where-h">
        <h2 id="where-h" className="text-base font-semibold">
          Where your agents get their models
        </h2>
        <p className="text-sm text-muted">{status}</p>
      </section>

      <section className="max-w-xl space-y-4" aria-labelledby="own-h">
        <div>
          <h2 id="own-h" className="text-base font-semibold">
            Use your own API key <span className="font-normal text-muted">(optional)</span>
          </h2>
          <p className="text-sm text-muted">
            Your own key takes load off the shared provider, and what you use on it does not count toward the shared daily limit. Works with any OpenAI-compatible endpoint.
          </p>
        </div>

        {p.own ? (
          <div className="space-y-1 rounded-xl border border-line bg-surface p-4">
            <p className="text-sm">
              Saved key for <span className="font-mono text-xs">{p.own.baseUrl}</span>, ending in <span className="font-mono text-xs">{p.own.last4}</span>.
            </p>
            <label className="flex min-h-[44px] items-center gap-3 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-[#E8A33D]" checked={p.mode === "OWN"} onChange={(e) => void settings({ mode: e.target.checked ? "OWN" : "PLATFORM" })} disabled={!p.platformEnabled && p.mode === "OWN"} />
              Use my key
            </label>
            {p.platformEnabled ? (
              <label className="flex min-h-[44px] items-center gap-3 text-sm">
                <input type="checkbox" className="h-5 w-5 accent-[#E8A33D]" checked={p.fallbackToPlatform} onChange={(e) => void settings({ fallbackToPlatform: e.target.checked })} />
                If my key fails, use the shared provider
              </label>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => void removeKey()}>
              Remove my key
            </Button>
          </div>
        ) : null}

        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void connect(e.currentTarget, "save");
          }}
        >
          <Field label="Base URL" id="baseUrl" type="url" placeholder="https://api.openai.com/v1" defaultValue={p.own?.baseUrl ?? ""} error={fields.baseUrl?.[0]} />
          <Field label={p.own ? "New API key" : "API key"} id="apiKey" type="password" autoComplete="off" hint="Stored encrypted. It cannot be shown again." error={fields.apiKey?.[0]} />
          {conn ? (
            <FormMessage tone={conn.ok ? "success" : "error"}>
              {conn.message}
              {conn.ok && conn.modelCount !== undefined ? ` ${conn.modelCount} models available.` : ""}
            </FormMessage>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" disabled={pending} onClick={(e) => void connect(e.currentTarget.form, "test")}>
              Test connection
            </Button>
            <Button type="submit" disabled={pending}>
              {p.own ? "Replace key" : "Save key"}
            </Button>
          </div>
        </form>
      </section>

      {p.own ? (
        <form className="max-w-3xl space-y-6" noValidate onSubmit={saveTiers} aria-labelledby="models-h">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="models-h" className="text-base font-semibold">
                Models on your own key
              </h2>
              <p className="text-sm text-muted">
                Choose the model each tier uses on your key.{p.platformEnabled ? " A tier you leave empty uses the shared provider." : ""}
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={() => void loadModels()}>
              Load model names
            </Button>
          </div>
          <datalist id="provider-models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          {(Object.keys(TIER_TEXT) as Tier[]).map((t) => (
            <fieldset key={t} className="space-y-3 rounded-xl border border-line bg-surface p-4">
              <legend className="px-1 text-sm font-semibold">
                {TIER_TEXT[t]} tier <span className="font-normal text-muted">({p.usedBy[t].join(", ") || "no agent"})</span>
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Model" id={`${t}-model`} list="provider-models" defaultValue={p.ownTiers[t]?.model ?? ""} autoComplete="off" />
                <Field label="Fallback model (optional)" id={`${t}-fallback`} list="provider-models" defaultValue={p.ownTiers[t]?.fallback ?? ""} autoComplete="off" />
              </div>
              <details>
                <summary className="min-h-[44px] cursor-pointer py-3 text-xs font-medium text-muted">Cost estimate (optional)</summary>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="USD per 1M input tokens" id={`${t}-in`} type="number" min={0} step="any" defaultValue={p.ownTiers[t]?.inputPerMTok ?? ""} />
                  <Field label="USD per 1M output tokens" id={`${t}-out`} type="number" min={0} step="any" defaultValue={p.ownTiers[t]?.outputPerMTok ?? ""} />
                </div>
              </details>
            </fieldset>
          ))}
          <Button type="submit" disabled={pending}>
            Save models
          </Button>
        </form>
      ) : null}
    </div>
  );
}
