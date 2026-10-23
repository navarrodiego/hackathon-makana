import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SurfaceShellProps {
  /** `mobile`: columna de lectura con acción cercana al pulgar. `projector`: escala de distancia, sin controles privilegiados. */
  surface?: "mobile" | "projector";
  title: string;
  children: ReactNode;
  /** Acción primaria (móvil). Se reserva su espacio y la safe area; no tapa campos. Solo queda fija si la altura útil lo permite (zoom de texto alto: fluye con el contenido). */
  action?: ReactNode;
}

/** Contenedor de una superficie. Define la variante vía data-surface; las pantallas no editan estilos globales. */
export function SurfaceShell({ surface = "mobile", title, children, action }: SurfaceShellProps) {
  const projector = surface === "projector";
  return (
    <div data-surface={surface} className="min-h-svh">
      <main id="contenido" tabIndex={-1} className={cn("mx-auto flex flex-col gap-8 px-6 py-10 sm:px-10", projector ? "max-w-[96rem]" : "max-w-2xl")}>
        <h1 className="text-title font-semibold tracking-[-0.02em] text-balance break-words">{title}</h1>
        {children}
      </main>
      {action ? (
        <div className="bottom-0 mx-auto [@media(min-height:40rem)]:sticky max-w-2xl bg-background px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-10">
          {action}
        </div>
      ) : null}
    </div>
  );
}
