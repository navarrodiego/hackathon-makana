import { DegradedNotice } from "@/components/ui/feedback";
import { hhmmss } from "@/components/registro/time";
import type { PublicStateView } from "@/lib/client/state";

export function Conexion({ view }: { view: PublicStateView }) {
  if (view.status === "lost") {
    return (
      <DegradedNotice title={`Sin conexión${view.lostSince ? ` desde las ${hhmmss(view.lostSince)}` : ""}`}>
        <p>
          Lo que ves es lo último comprobado{view.lastUpdatedAt ? ` a las ${hhmmss(view.lastUpdatedAt)}` : ""}, no el estado actual.
          Los plazos solo se evalúan mientras alguien consulta el estado.
        </p>
      </DegradedNotice>
    );
  }
  if (view.status === "loading") return <p role="status" className="text-body">Cargando estado…</p>;
  return <p className="text-aux text-muted-foreground">Conectado · actualizado a las {hhmmss(view.lastUpdatedAt!)}</p>;
}
