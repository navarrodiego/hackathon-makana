import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/feedback";

export interface LogEntry {
  id: string;
  /** Hora ya formateada (24 h). */
  timeLabel: string;
  /** Mensaje completo respaldado por un evento, no una intención. */
  text: ReactNode;
  /** Canal u origen, p. ej. «escenario»; no sustituye al texto del evento. */
  originLabel?: string;
}

/** Registro continuo: filas abiertas, sin tarjetas. El texto largo baja de línea. */
export function EventLog({ entries, label = "Registro" }: { entries: readonly LogEntry[]; label?: string }) {
  if (entries.length === 0) return <EmptyState title="Sin eventos registrados" />;
  return (
    <ol aria-label={label} className="divide-y divide-line border-y border-line">
      {entries.map((e) => (
        <li key={e.id} className="flex gap-4 py-3">
          <time className="w-14 shrink-0 text-aux text-muted-foreground">{e.timeLabel}</time>
          <div className="min-w-0 break-words text-body">
            {e.text}
            {e.originLabel ? <span className="ml-2 text-aux text-muted-foreground">({e.originLabel})</span> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
