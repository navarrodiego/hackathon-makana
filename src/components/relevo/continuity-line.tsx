import type { ActorDTO, CoverageDTO, HandoffSummaryDTO } from "@/lib/contracts/client";
import { Status, type StatusKind } from "@/components/ui/status";
import { cn } from "@/lib/utils";

export type ContinuityState = "awaiting" | "scheduled" | "active" | "uncovered";

/**
 * Deriva el estado visual solo de lo registrado. Enviar el relevo nunca cierra la línea:
 * «active» exige cobertura efectiva; «scheduled» exige aceptación.
 */
export function continuityState(handoff: HandoffSummaryDTO | null, coverage: CoverageDTO | null): ContinuityState {
  if (coverage?.status === "active") return "active";
  if (coverage?.status === "scheduled" || handoff?.status === "accepted") return "scheduled";
  if (handoff?.status === "awaiting_candidate") return "awaiting";
  if (handoff?.status === "uncovered" || coverage?.status === "unconfirmed") return "uncovered";
  return "awaiting";
}

const kinds: Record<ContinuityState, StatusKind> = {
  awaiting: "pending", scheduled: "scheduled", active: "active", uncovered: "uncovered",
};

export interface ContinuityLineProps {
  outgoing: ActorDTO;
  /** Candidato o responsable entrante; `null` si nadie aceptó. */
  incoming: ActorDTO | null;
  state: ContinuityState;
  /** Hora ya formateada (24 h) en que comienza la cobertura, p. ej. «22:10». */
  startsAtLabel?: string;
  className?: string;
}

function message(p: ContinuityLineProps) {
  const next = p.incoming?.displayName;
  switch (p.state) {
    case "awaiting": return next ? `Esperando aceptación de ${next}` : "Esperando aceptación";
    case "scheduled": return `${next ?? "El relevo"} aceptó. Su cobertura comienza a las ${p.startsAtLabel ?? "la hora prevista"}`;
    case "active": return `Cobertura activa de ${next ?? "la persona entrante"}`;
    case "uncovered": return "Sin cobertura confirmada";
  }
}

/** Saliente → entrante. La línea queda cortada hasta que haya aceptación; el texto explica el estado. */
export function ContinuityLine(props: ContinuityLineProps) {
  const { outgoing, incoming, state, className } = props;
  const joined = state === "scheduled" || state === "active";
  return (
    <section aria-label="Continuidad del turno" className={cn("py-2", className)}>
      <div className="flex items-center gap-3">
        <span className="text-people font-semibold">{outgoing.displayName}</span>
        <svg aria-hidden="true" viewBox="0 0 64 12" className="h-3 min-w-10 flex-1 text-foreground" preserveAspectRatio="none">
          {joined ? (
            <line x1="0" y1="6" x2="64" y2="6" stroke="currentColor" strokeWidth="2" strokeDasharray={state === "scheduled" ? "6 4" : undefined} />
          ) : (
            <>
              <line x1="0" y1="6" x2="26" y2="6" stroke="currentColor" strokeWidth="2" />
              <line x1="38" y1="6" x2="64" y2="6" stroke="currentColor" strokeWidth="2" strokeDasharray="2 4" />
            </>
          )}
        </svg>
        <span className={cn("text-people font-semibold", !incoming && "text-muted-foreground")}>
          {incoming ? incoming.displayName : "Sin definir"}
        </span>
      </div>
      <p className="mt-3"><Status kind={kinds[state]}>{message(props)}</Status></p>
    </section>
  );
}
