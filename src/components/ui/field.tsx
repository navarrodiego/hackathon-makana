import { useId } from "react";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ShellProps {
  label: string;
  hint?: ReactNode;
  /** Mensaje completo: qué falló y cómo corregirlo. */
  error?: ReactNode;
}

const control =
  "mt-2 block min-h-12 w-full rounded-lg border bg-muted px-4 py-3 text-body text-foreground " +
  "placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:border-dashed";

function Shell({ id, label, hint, error, children }: ShellProps & {
  id: string;
  children: (a: { describedBy?: string; invalid: boolean }) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-body font-semibold">{label}</label>
      {hint ? <p id={hintId} className="mt-1 text-aux text-muted-foreground">{hint}</p> : null}
      {children({ describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} className="mt-2 text-aux text-danger"><span className="font-semibold">Error: </span>{error}</p>
      ) : null}
    </div>
  );
}

export function TextField({ label, hint, error, className, ...rest }: ShellProps & Omit<InputHTMLAttributes<HTMLInputElement>, "id">) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      {({ describedBy, invalid }) => (
        <input {...rest} id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined}
          className={cn(control, invalid ? "border-danger" : "border-input", className)} />
      )}
    </Shell>
  );
}

export function TextAreaField({ label, hint, error, className, ...rest }: ShellProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      {({ describedBy, invalid }) => (
        <textarea {...rest} id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined}
          className={cn(control, "min-h-28 resize-y", invalid ? "border-danger" : "border-input", className)} />
      )}
    </Shell>
  );
}
