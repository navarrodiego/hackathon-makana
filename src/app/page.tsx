import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SurfaceShell } from "@/components/relevo/surface-shell";

export const metadata: Metadata = { title: "Cómo probar Relevo" };

/** Abre la pantalla en otra pestaña para que estas instrucciones sigan a mano. */
function Screen({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} target="_blank" rel="noopener"
      className="inline-flex min-h-12 items-center rounded-lg border border-input px-5 py-3 text-action font-semibold transition-colors duration-150 hover:bg-muted">
      {children}
      <span className="sr-only"> (se abre en otra pestaña)</span>
    </Link>
  );
}

function Step({ title, screen, children }: { title: string; screen?: ReactNode; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-3 border-t border-line pt-6 first:border-t-0 first:pt-0">
      <h3 className="text-section font-semibold text-balance">{title}</h3>
      <div className="max-w-prose space-y-2 text-body">{children}</div>
      {screen ? <div>{screen}</div> : null}
    </li>
  );
}

export default function Home() {
  return (
    <SurfaceShell title="Relevo" lead="Entrega el turno. Recupera la noche.">
      <p className="max-w-prose text-body">
        Rodrigo termina su turno de soporte TI. Relevo deja explícito quién recibe la cobertura y quién atiende un incidente, sin que él
        tenga que perseguir un reemplazo. Puedes probarlo en unos cinco minutos.
      </p>

      <section aria-labelledby="antes" className="flex flex-col gap-3 border-t border-line pt-8">
        <h2 id="antes" className="text-people font-semibold text-balance">Antes de empezar</h2>
        <ul className="max-w-prose list-disc space-y-2 pl-5 text-body marker:text-muted-foreground">
          <li>Control y Cierre de turno piden la contraseña de operador que te enviamos junto con este enlace.</li>
          <li>Hay una sola demostración para todos. Si otra persona la está usando, verás lo que hizo; reiníciala desde Control.</li>
          <li>Todo es ficticio: personas, tickets y reportes.</li>
        </ul>
      </section>

      <section aria-labelledby="pasos" className="flex flex-col gap-6 border-t border-line pt-8">
        <h2 id="pasos" className="text-people font-semibold text-balance">Cómo probarla</h2>
        <ol className="flex flex-col gap-6">
          <Step title="1. Abre el proyector y déjalo abierto" screen={<Screen href="/proyector">Abrir proyector</Screen>}>
            <p>Es la pantalla de la sala: muestra quién está a cargo. Mientras está abierta, revisa los plazos cada segundo.</p>
          </Step>
          <Step title="2. Reinicia la demostración" screen={<Screen href="/control">Abrir control</Screen>}>
            <p>En Control, pulsa «Reiniciar demostración» y luego «Reiniciar ahora». Así empiezas desde cero.</p>
          </Step>
          <Step title="3. Envía el relevo como Rodrigo" screen={<Screen href="/rodrigo">Abrir cierre de turno</Screen>}>
            <p>Mejor en tu teléfono. Revisa sus tres pendientes y pulsa «Enviar relevo». El proyector pasa a «Esperando aceptación de Paula».</p>
          </Step>
          <Step title="4. Espera un minuto">
            <p>
              Paula tiene 30 segundos para aceptar. Si no responde, el relevo pasa a Tomás, con 30 segundos propios. Si él tampoco
              responde, queda «Sin cobertura confirmada» y se avisa a Carla, la jefatura.
            </p>
            <p>El turno de Rodrigo no se alarga: no queda a cargo por defecto.</p>
          </Step>
          <Step title="5. Reporta un problema" screen={<Screen href="/canal">Abrir canal</Screen>}>
            <p>
              En Control, pulsa «Empezar la noche y abrir el canal». Luego abre el canal o escanea el QR del proyector; el envío se
              habilita a los 30 segundos. Prueba
              con algo que pueda esperar («La VPN está lenta para dos personas») y con algo grave («Facturación no responde en ningún local»).
            </p>
            <p>Lo que puede esperar queda en cola. Lo grave, como no hay cobertura confirmada, se avisa a la jefatura y no a Rodrigo.</p>
          </Step>
        </ol>
      </section>

      <section aria-labelledby="pitch" className="flex flex-col gap-3 border-t border-line pt-8">
        <h2 id="pitch" className="text-people font-semibold text-balance">Qué cambia en la presentación</h2>
        <p className="max-w-prose text-body">
          En el pitch, Paula acepta el relevo desde su teléfono y queda a cargo. Un reporte grave genera un aviso para ella; no lo toma y, a los
          30 segundos, pasa a Tomás, que lo toma. Aquí no tienes el teléfono de Paula, por eso ves el camino en que nadie acepta.
        </p>
      </section>

      <section aria-labelledby="mirar" className="flex flex-col gap-3 border-t border-line pt-8">
        <h2 id="mirar" className="text-people font-semibold text-balance">Fíjate en esto</h2>
        <ul className="max-w-prose list-disc space-y-2 pl-5 text-body marker:text-muted-foreground">
          <li>Enviar el relevo no es aceptarlo.</li>
          <li>Tomar un incidente no es resolverlo.</li>
          <li>Rodrigo no es respaldo en la ventana que entrega.</li>
        </ul>
      </section>
    </SurfaceShell>
  );
}
