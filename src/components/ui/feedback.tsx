import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BlockProps { title: string; children?: ReactNode; className?: string }

/** Qué falló, qué se conserva y cómo recuperarse, solo cuando se sabe. No afirma guardado. */
export function ErrorMessage({ title, children, className }: BlockProps) {
  return (
    <div role="alert" className={cn("border-l-4 border-danger py-1 pl-4", className)}>
      <p className="text-body font-semibold text-danger"><span>Error: </span>{title}</p>
      {children ? <div className="mt-1 text-body">{children}</div> : null}
    </div>
  );
}

/** Carga con texto visible; no exige animación. */
export function LoadingState({ title = "Cargando", children, className }: Partial<BlockProps>) {
  return (
    <div role="status" aria-busy="true" className={cn("py-2", className)}>
      <p className="text-body font-semibold">{title}…</p>
      {children ? <div className="mt-1 text-aux text-muted-foreground">{children}</div> : null}
    </div>
  );
}

export function EmptyState({ title, children, className }: BlockProps) {
  return (
    <div className={cn("py-2", className)}>
      <p className="text-body font-semibold">{title}</p>
      {children ? <div className="mt-1 text-aux text-muted-foreground">{children}</div> : null}
    </div>
  );
}

/** Desconexión, modo degradado o dato vencido. Indica el límite de lo comprobado; no tranquiliza. */
export function DegradedNotice({ title, children, className }: BlockProps) {
  return (
    <div role="status" className={cn("border-l-4 border-warning py-1 pl-4", className)}>
      <p className="text-body font-semibold text-warning"><span>Aviso: </span>{title}</p>
      {children ? <div className="mt-1 text-body">{children}</div> : null}
    </div>
  );
}
