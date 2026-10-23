import type { ReactNode } from "react";

export interface PendingRowProps {
  ticketId: string;
  title: string;
  /** Destacado de la IA («Para seguimiento») con su razón; baja de línea antes de truncar. */
  proposal?: ReactNode;
  /** Controles convencionales para corregir la propuesta; nunca solo gestos. */
  controls?: ReactNode;
}

/** Fila abierta de pendiente: ID, título y, si corresponde, el destacado. Destacar no lo hace urgente. */
export function PendingRow({ ticketId, title, proposal, controls }: PendingRowProps) {
  return (
    <li className="py-4">
      <p className="text-aux text-muted-foreground">{ticketId}</p>
      <p className="mt-1 break-words text-body font-semibold">{title}</p>
      {proposal ? <div className="mt-2 break-words text-body">{proposal}</div> : null}
      {controls ? <div className="mt-3 flex flex-wrap gap-3">{controls}</div> : null}
    </li>
  );
}

export function PendingList({ label, children }: { label: string; children: ReactNode }) {
  return <ul aria-label={label} className="divide-y divide-line border-y border-line">{children}</ul>;
}
