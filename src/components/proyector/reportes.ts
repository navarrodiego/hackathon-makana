import type { StatusKind } from "@/components/ui/status";
import type { PublicReportDTO } from "@/lib/contracts/client";

/**
 * Qué pasó con un reporte de la sala, con las mismas palabras y marcas que el recibo del teléfono. Quién tiene el
 * incidente lo dice «Ahora»; aquí basta con saber si abrió uno o se sumó al ya registrado.
 */
export function estadoReporte(r: Pick<PublicReportDTO, "status" | "duplicate">): { kind: StatusKind; text: string } {
  switch (r.status) {
    case "processing": return { kind: "pending", text: "Clasificando…" };
    case "queued": return { kind: "scheduled", text: "En cola para la próxima atención" };
    case "review": return { kind: "pending", text: "En revisión de la guardia" };
    case "out_of_scope": return { kind: "rerouted", text: "No parece un reporte de TI" };
    case "incident": return { kind: "scheduled", text: r.duplicate ? "Incidente ya registrado" : "Incidente registrado" };
  }
}
