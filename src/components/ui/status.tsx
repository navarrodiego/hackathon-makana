import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Estados visuales de DESIGN. El texto siempre acompaña a la marca; «activo» solo con un evento que lo respalde. */
export type StatusKind = "pending" | "scheduled" | "active" | "rerouted" | "uncovered";

const marks: Record<StatusKind, { label: string; tone: string; shape: string }> = {
  pending: { label: "Pendiente", tone: "text-foreground", shape: "border-2 border-dashed border-foreground rounded-full" },
  scheduled: { label: "Programado", tone: "text-warning", shape: "border-2 border-warning rounded-full" },
  active: { label: "Activo", tone: "text-success", shape: "bg-success rounded-full" },
  rerouted: { label: "Derivado", tone: "text-foreground", shape: "border-2 border-foreground rotate-45" },
  uncovered: { label: "Sin cobertura confirmada", tone: "text-danger", shape: "bg-danger rotate-45" },
};

export interface StatusProps {
  kind: StatusKind;
  /** Sustituye la etiqueta por un mensaje completo («Esperando aceptación de Paula»). */
  children?: ReactNode;
  className?: string;
}

export function Status({ kind, children, className }: StatusProps) {
  const m = marks[kind];
  return (
    <span className={cn("inline-flex items-center gap-2 text-body font-semibold", m.tone, className)}>
      <span aria-hidden="true" className={cn("inline-block size-3 shrink-0", m.shape)} />
      <span>{children ?? m.label}</span>
    </span>
  );
}
