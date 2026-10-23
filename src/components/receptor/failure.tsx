import { ErrorMessage } from "@/components/ui/feedback";
import { SurfaceShell } from "@/components/relevo/surface-shell";
import type { FailureView } from "./logic";

/** Denegación o fallo de lectura. No muestra datos del paquete ni sugiere que algo quedó guardado. */
export function ReceptorFailure({ view }: { view: FailureView }) {
  return (
    <SurfaceShell title="Revisión del relevo">
      <ErrorMessage title={view.title}><p>{view.detail}</p></ErrorMessage>
    </SurfaceShell>
  );
}
