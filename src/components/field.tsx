import * as React from "react";
import { Input } from "@/components/ui/input";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  error?: string;
  hint?: string;
}

/** Label + input + hint + error, wired together for screen readers. */
export function Field({ label, id, error, hint, ...input }: FieldProps) {
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <Input id={id} name={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-hydra">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) {
  const styles = {
    error: "border-hydra/40 bg-hydra/10 text-ink",
    success: "border-lyra/40 bg-lyra/10 text-ink",
    info: "border-line bg-surface text-ink",
  }[tone];
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-3.5 py-2.5 text-sm ${styles}`}>
      {children}
    </p>
  );
}
