import type { Metadata } from "next";
import { SurfaceShell } from "@/components/relevo/surface-shell";
import { CierreForm } from "@/components/rodrigo/cierre-form";
import { OperatorLogin } from "@/components/acceso/operator-login";
import { isSessionProblem, loginErrorCode, loginErrorMessage } from "@/components/acceso/messages";
import { loadAuthConfig } from "@/lib/server/auth/config";
import { DegradedNotice, ErrorMessage } from "@/components/ui/feedback";
import { loadRodrigo } from "./load";

export const dynamic = "force-dynamic";
// same-origin y no no-referrer: con no-referrer el navegador envía `Origin: null` en el formulario de ingreso sin JavaScript
// y el servidor lo rechaza. Hacia otros sitios sigue sin enviarse referrer.
export const metadata: Metadata = { title: "Cierre de turno · Relevo", referrer: "same-origin" };

type Props = PageProps<"/rodrigo">;

/** Error de un ingreso sin JavaScript: solo códigos conocidos; el origen esperado sale de la configuración. */
async function loginError(searchParams: Props["searchParams"]) {
  const code = loginErrorCode((await searchParams).acceso);
  return code ? loginErrorMessage(code, "outgoing", { expected: loadAuthConfig().appOrigin ?? null, received: null }) : undefined;
}

export default async function Page({ searchParams }: Props) {
  const loaded = await loadRodrigo();
  if (loaded.kind === "ready") {
    const { view, handoffId } = loaded;
    // La clave reinicia el formulario cuando cambia la ejecución o la versión del borrador.
    return <CierreForm key={`${view.executionId}:${view.draftVersion}`} view={view} handoffId={handoffId} />;
  }
  return (
    <SurfaceShell title="Cierre de turno">
      {loaded.kind === "denied" && isSessionProblem(loaded.code) ? (
        <>
          <p className="max-w-prose text-body">Este cierre es para quien entrega el turno. Ingresa con la contraseña de operador para ver tus pendientes.</p>
          <OperatorLogin role="outgoing" initialError={await loginError(searchParams)} />
        </>
      ) : loaded.kind === "denied" ? (
        <ErrorMessage title="No se pudo confirmar tu acceso">
          Tu sesión no permite abrir este cierre. No se muestra ningún pendiente. Recarga la página; si el problema sigue, cierra la sesión e ingresa de nuevo.
        </ErrorMessage>
      ) : (
        <DegradedNotice title="No se pudo leer el estado del turno">
          No hay confirmación de lo que está guardado. Recarga la página en unos segundos; no se envió ni cambió nada.
        </DegradedNotice>
      )}
    </SurfaceShell>
  );
}
