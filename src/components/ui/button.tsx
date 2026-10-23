import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Acción en curso: conserva el foco y no repite el envío. */
  loading?: boolean;
  /** Etiqueta mientras `loading` («Enviando relevo…»). */
  loadingLabel?: string;
}

const base =
  "inline-flex min-h-12 items-center justify-center rounded-lg border px-5 py-3 text-center text-action font-semibold " +
  "touch-manipulation transition-colors duration-150 select-none active:translate-y-px";

const variants: Record<Variant, string> = {
  primary: "min-h-14 border-primary bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary: "border-input bg-transparent text-foreground hover:bg-muted",
  danger: "border-danger bg-transparent text-danger hover:bg-muted",
};

const unavailable =
  "cursor-not-allowed border-dashed border-line bg-muted text-muted-foreground hover:bg-muted active:translate-y-0";

/** Acción con verbo y objeto («Enviar relevo a Paula»). `loading` usa aria-disabled y degrada submit a button: conserva el foco y no repite el envío. */
export function Button({
  variant = "secondary", loading = false, loadingLabel, disabled, className, children, onClick, type = "button", ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={loading ? "button" : type}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={loading ? undefined : onClick}
      className={cn(base, variants[variant], (disabled || loading) && unavailable, className)}
    >
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
