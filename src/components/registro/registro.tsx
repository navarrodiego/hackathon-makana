import type { PublicEventDTO } from "@/lib/contracts/client";
import { EventLog, type LogEntry } from "@/components/relevo/event-log";
import { eventText, originLabel } from "./event-text";
import { hhmm } from "./time";

export const VISIBLE_EVENTS = 12;

export function toEntries(events: readonly PublicEventDTO[], limit = VISIBLE_EVENTS): LogEntry[] {
  return [...events]
    .sort((a, b) => b.sequence - a.sequence)
    .slice(0, limit)
    .map(e => ({ id: e.id, timeLabel: hhmm(e.narrativeAt), text: eventText(e), originLabel: originLabel(e.origin) }));
}

/** Registro continuo compartido (proyector, resumen). Las horas son narrativas. */
export function RegistroContinuo({ events, limit = VISIBLE_EVENTS }: { events: readonly PublicEventDTO[]; limit?: number }) {
  const shown = Math.min(events.length, limit);
  return (
    <section aria-labelledby="registro-titulo" className="flex flex-col gap-3">
      <h2 id="registro-titulo" className="text-section font-semibold">Registro</h2>
      <p className="text-aux text-muted-foreground">
        Horas de la escena. Se muestran {shown} de {events.length} eventos, del más reciente al más antiguo.
      </p>
      <EventLog entries={toEntries(events, limit)} />
    </section>
  );
}
