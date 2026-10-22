import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "min-h-[44px] w-full rounded-lg border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-muted/70",
        "aria-[invalid=true]:border-hydra",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
