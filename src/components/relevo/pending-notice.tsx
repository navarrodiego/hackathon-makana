import { SurfaceShell } from "./surface-shell";

/** Estructura mínima de una ruta C08 sin datos. Su dueño (T12–T16) la reemplaza al integrar. */
export function PendingSurface({ title, surface = "mobile" }: { title: string; surface?: "mobile" | "projector" }) {
  return (
    <SurfaceShell title={title} surface={surface}>
      <section aria-labelledby="pendiente" className="border-t border-line pt-6">
        <h2 id="pendiente" className="text-section font-semibold">Pendiente</h2>
        <p className="mt-2 max-w-prose text-body">
          Esta pantalla aún no opera. No registra reportes ni confirma cobertura.
        </p>
      </section>
    </SurfaceShell>
  );
}
