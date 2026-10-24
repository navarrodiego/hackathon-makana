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
  /** Escala de titular (proyector): nombres y mensaje un paso más grandes. */
  emphasis?: boolean;
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

/** Saliente → entrante. Sin aceptación, la línea llega sólida hasta un nodo de espera y sigue punteada; el texto explica el estado. */
export function ContinuityLine(props: ContinuityLineProps) {
  const { outgoing, incoming, state, emphasis, className } = props;
  const joined = state === "scheduled" || state === "active";
  return (
    <section aria-label="Continuidad del turno" className={cn("py-2", className)}>
      <div className="flex items-center gap-3">
        <span className={cn("text-people font-semibold", emphasis && "text-title")}>{outgoing.displayName}</span>
        {/* Bordes CSS y no un SVG estirado: el patrón conserva su tamaño a cualquier ancho. */}
        <span aria-hidden="true" className="flex min-w-10 flex-1 items-center">
          {joined ? (
            <span className={cn("flex-1 border-t-2 border-foreground", state === "scheduled" && "border-dashed")} />
          ) : (
            <>
              <span className="flex-1 border-t-2 border-foreground" />
              <span className="mx-2 size-2.5 shrink-0 rounded-full border-2 border-dashed border-foreground" />
              <span className="flex-1 border-t-2 border-dotted border-muted-foreground" />
            </>
          )}
        </span>
        <span className={cn("text-people font-semibold", emphasis && "text-title", !incoming && "text-muted-foreground")}>
          {incoming ? incoming.displayName : "Sin definir"}
        </span>
      </div>
      <p className="mt-3"><Status kind={kinds[state]} className={emphasis ? "text-section" : undefined}>{message(props)}</Status></p>
    </section>
  );
}
