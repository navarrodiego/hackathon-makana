import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Dos columnas de la variante `adaptive` con ancho de sala (≥ 80 rem). La barra de acción usa la misma rejilla para
 * que el botón quede bajo la columna derecha; quien compone la pantalla la reutiliza para su contenido.
 */
export const ROOM_COLUMNS = "min-[80rem]:grid min-[80rem]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] min-[80rem]:gap-x-20";

export interface SurfaceShellProps {
  /**
   * `mobile`: columna de lectura con acción cercana al pulgar. `projector`: escala de distancia, sin controles privilegiados.
   * `adaptive`: móvil en el teléfono; con ancho de sala (≥ 80 rem) toma la escala del proyector y se ensancha.
   */
  surface?: "mobile" | "projector" | "adaptive";
  title: string;
  /** Mantiene el h1 para lectores de pantalla sin mostrarlo (la superficie tiene su propia cabecera visual). */
  titleHidden?: boolean;
  /** Línea que acompaña al título, en escala de personas. */
  lead?: ReactNode;
  children: ReactNode;
  /** Acción primaria (móvil). Se reserva su espacio y la safe area; no tapa campos. Solo queda fija si la altura útil lo permite (zoom de texto alto: fluye con el contenido). */
  action?: ReactNode;
}

/** Contenedor de una superficie. Define la variante vía data-surface; las pantallas no editan estilos globales. */
export function SurfaceShell({ surface = "mobile", title, titleHidden, lead, children, action }: SurfaceShellProps) {
  const projector = surface === "projector";
  const adaptive = surface === "adaptive";
  const room = adaptive && "min-[80rem]:max-w-[100rem] min-[80rem]:px-16";
  return (
    <div data-surface={surface} className="min-h-svh">
      <main id="contenido" tabIndex={-1} className={cn("mx-auto flex flex-col gap-8 px-6 py-10 sm:px-10", projector ? "min-h-svh max-w-[112rem]" : "max-w-2xl", room, adaptive && "min-[80rem]:gap-12 min-[80rem]:py-14")}>
        <header className={cn("space-y-3", titleHidden && "sr-only")}>
          <h1 className="text-title font-semibold tracking-[-0.02em] text-balance break-words">{title}</h1>
          {lead ? <p className="text-people text-balance">{lead}</p> : null}
        </header>
        {children}
      </main>
      {action ? (
        <div className={cn("bottom-0 mx-auto [@media(min-height:40rem)]:sticky max-w-2xl bg-background px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-10", room,
          // En sala la barra solo es opaca bajo la columna derecha: no tapa la columna izquierda ni sus clics.
          adaptive && [ROOM_COLUMNS, "min-[80rem]:pointer-events-none min-[80rem]:bg-transparent min-[80rem]:pt-0 min-[80rem]:pb-0"])}>
          <div className={cn(adaptive && "min-[80rem]:pointer-events-auto min-[80rem]:col-start-2 min-[80rem]:bg-background min-[80rem]:pt-3 min-[80rem]:pb-[max(1.5rem,env(safe-area-inset-bottom))]")}>{action}</div>
        </div>
      ) : null}
    </div>
  );
}
