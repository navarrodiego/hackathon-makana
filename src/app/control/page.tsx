import type { Metadata } from "next";
import { ControlPanel } from "@/components/control/control-panel";
import { SurfaceShell } from "@/components/relevo/surface-shell";
import { DegradedNotice, ErrorMessage } from "@/components/ui/feedback";
import { loadControl } from "./load";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Control · Relevo", referrer: "no-referrer" };

export default async function Page() {
  const loaded = await loadControl();
  if (loaded.kind === "ready") return <ControlPanel view={loaded.view} />;
  return (
    <SurfaceShell title="Control">
      {loaded.kind === "denied" ? (
        <ErrorMessage title="No se pudo confirmar tu acceso">
          Esta página es solo para quien opera la demostración. Ábrela de nuevo e ingresa con la credencial de control. No se muestra ninguna acción.
        </ErrorMessage>
      ) : (
        <DegradedNotice title="No se pudo leer el estado de la demostración">
          No hay confirmación de lo que está guardado. Recarga la página en unos segundos; no se cambió nada.
        </DegradedNotice>
      )}
    </SurfaceShell>
  );
}
