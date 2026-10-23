"use client";

import { SurfaceShell } from "@/components/relevo/surface-shell";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/feedback";

export default function RodrigoError({ reset }: { error: Error; reset: () => void }) {
  return (
    <SurfaceShell title="Cierre de turno">
      <ErrorMessage title="No se pudo mostrar el cierre">
        No hay confirmación de que algo se enviara o guardara. Vuelve a cargar; si el problema sigue, avisa a quien opera la demostración.
      </ErrorMessage>
      <div><Button onClick={reset}>Cargar de nuevo</Button></div>
    </SurfaceShell>
  );
}
