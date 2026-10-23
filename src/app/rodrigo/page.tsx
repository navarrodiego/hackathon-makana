import type { Metadata } from "next";
import { SurfaceShell } from "@/components/relevo/surface-shell";
import { CierreForm } from "@/components/rodrigo/cierre-form";
import { ConsultaCard } from "@/components/rodrigo/resumen/consulta-card";
import { ResumenPanel } from "@/components/rodrigo/resumen/resumen-panel";
import { DegradedNotice, ErrorMessage } from "@/components/ui/feedback";
import { loadRodrigo } from "./load";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cierre de turno · Relevo", referrer: "no-referrer" };

export default async function Page() {
  const loaded = await loadRodrigo();
  if (loaded.kind === "ready") {
    const { view, handoffId } = loaded;
    // La clave reinicia el formulario cuando cambia la versión del borrador o termina la preparación de la nota.
    return <CierreForm key={`${view.executionId}:${view.draftVersion}:${view.note.status}`} view={view} handoffId={handoffId}
      extra={<><ResumenPanel executionId={view.executionId} /><ConsultaCard /></>} />;
  }
  return (
    <SurfaceShell title="Cierre de turno">
      {loaded.kind === "denied" ? (
        <ErrorMessage title="No se pudo confirmar tu acceso">
          Este cierre es solo para la persona que entrega el turno. Abre la página de nuevo e ingresa con la credencial de Rodrigo. No se muestra ningún pendiente.
        </ErrorMessage>
      ) : (
        <DegradedNotice title="No se pudo leer el estado del turno">
          No hay confirmación de lo que está guardado. Recarga la página en unos segundos; no se envió ni cambió nada.
        </DegradedNotice>
      )}
    </SurfaceShell>
  );
}
