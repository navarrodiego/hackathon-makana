import type { Metadata } from "next";
import { ControlPanel } from "@/components/control/control-panel";
import { SurfaceShell } from "@/components/relevo/surface-shell";
import { OperatorLogin } from "@/components/acceso/operator-login";
import { isSessionProblem, loginErrorCode, loginErrorMessage } from "@/components/acceso/messages";
import { loadAuthConfig } from "@/lib/server/auth/config";
import { DegradedNotice } from "@/components/ui/feedback";
import { loadControl } from "./load";

export const dynamic = "force-dynamic";
// same-origin y no no-referrer: con no-referrer el navegador envía `Origin: null` en el formulario de ingreso sin JavaScript
// y el servidor lo rechaza. Hacia otros sitios sigue sin enviarse referrer.
export const metadata: Metadata = { title: "Control · Relevo", referrer: "same-origin" };

type Props = PageProps<"/control">;

/** Error de un ingreso sin JavaScript: solo códigos conocidos; el origen esperado sale de la configuración. */
async function loginError(searchParams: Props["searchParams"]) {
  const code = loginErrorCode((await searchParams).acceso);
  return code ? loginErrorMessage(code, "control", { expected: loadAuthConfig().appOrigin ?? null, received: null }) : undefined;
}

export default async function Page({ searchParams }: Props) {
  const loaded = await loadControl();
  if (loaded.kind === "ready") return <ControlPanel view={loaded.view} />;
  return (
    <SurfaceShell title="Control">
      {loaded.kind === "denied" ? (
        <>
          {isSessionProblem(loaded.code) ? (
            <p className="max-w-prose text-body">Esta página es para quien opera la demostración. Ingresa con la contraseña de operador.</p>
          ) : (
            <p role="status" className="max-w-prose text-body">Tu sesión actual es del cierre de turno y no abre control. Ingresa con la contraseña de operador para abrir control.</p>
          )}
          <OperatorLogin role="control" initialError={await loginError(searchParams)} />
        </>
      ) : (
        <DegradedNotice title="No se pudo leer el estado de la demostración">
          No hay confirmación de lo que está guardado. Recarga la página en unos segundos; no se cambió nada.
        </DegradedNotice>
      )}
    </SurfaceShell>
  );
}
