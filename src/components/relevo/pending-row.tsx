import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PendingRowProps {
  ticketId: string;
  title: string;
  /** Destacado («Para seguimiento») con su razón; baja de línea antes de truncar. Marca la fila con el acento. */
  proposal?: ReactNode;
  /** Controles convencionales para corregir la propuesta; nunca solo gestos. */
  controls?: ReactNode;
}

/**
 * Fila abierta de pendiente: ID, título y, si corresponde, el destacado. Solo el destacado va en negrita y con filete
 * de acento; los demás quedan en peso normal para que la vista tenga un foco. Destacar no lo hace urgente.
 */
export function PendingRow({ ticketId, title, proposal, controls }: PendingRowProps) {
  return (
    <li className={cn("py-4", proposal && "border-l-4 border-primary pl-4")}>
      <p className="text-aux text-muted-foreground">{ticketId}</p>
      <p className={cn("mt-1 break-words text-body", proposal ? "font-semibold" : "text-foreground/90")}>{title}</p>
      {proposal ? <div className="mt-2 break-words text-body">{proposal}</div> : null}
      {controls ? <div className="mt-3 flex flex-wrap gap-3">{controls}</div> : null}
    </li>
  );
}

export function PendingList({ label, children }: { label: string; children: ReactNode }) {
  return <ul aria-label={label} className="divide-y divide-line border-y border-line">{children}</ul>;
}
