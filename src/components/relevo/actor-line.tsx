import type { ReactNode } from "react";
import type { ActorDTO } from "@/lib/contracts/client";
import { Status, type StatusKind } from "@/components/ui/status";

export interface ActorLineProps {
  actor: ActorDTO;
  /** Ventana o rol ya formateados, p. ej. «22:10–08:00». */
  windowLabel?: string;
  status?: { kind: StatusKind; text?: ReactNode };
}

/** Misma gramática de actor, estado y plazo en lectura tranquila y en incidentes. */
export function ActorLine({ actor, windowLabel, status }: ActorLineProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2">
      <span className="text-people font-semibold">{actor.displayName}</span>
      {windowLabel ? <span className="text-aux text-muted-foreground">{windowLabel}</span> : null}
      {status ? <Status kind={status.kind}>{status.text}</Status> : null}
    </div>
  );
}
