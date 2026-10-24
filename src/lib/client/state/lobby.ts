"use client";

import { useEffect, useState } from "react";
import type { PublicStateView } from "./use-public-state";

/**
 * Cuenta hasta un instante del servidor (C13): fin de la espera común (`lobbyEndsAt`) o del QR grande (`qrEndsAt`).
 * El servidor decide; aquí solo se muestra, con su reloj para que todas las pantallas terminen en el mismo instante.
 * Si control lo alarga, el instante cambia y la cuenta sigue desde el nuevo. Devuelve los ms que faltan, `0` sin
 * plazo y `null` antes del primer tic (el render del servidor no conoce la hora del teléfono). El intervalo se
 * detiene al cumplirse y al desmontar.
 */
export function useLobbyRemaining(live: PublicStateView, until: string | null): number | null {
  const endsAt = until ? Date.parse(until) : null;
  // Desfase con el servidor medido en el último snapshot; cada snapshot nuevo reinicia el tic con el valor vigente.
  const offset = live.state && live.lastUpdatedAt !== null ? Date.parse(live.state.clocks.operationalNow) - live.lastUpdatedAt : 0;
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const current = Date.now() + offset;
      setNow(current);
      if (current >= endsAt) clearInterval(id);
    };
    const id = setInterval(tick, 1000);
    tick();
    return () => clearInterval(id);
  }, [endsAt, offset]);
  if (endsAt === null) return 0;
  return now === null ? null : Math.max(0, endsAt - now);
}

/**
 * Si el QR grande está en el proyector: con canal abierto y plazo vigente. Durante la espera común cede ante el
 * primer incidente; si control lo vuelve a mostrar pasada la espera, dura su plazo. `null` (sin primer tic) cuenta
 * como vigente, igual que en el proyector.
 */
export function qrOnScreen(open: boolean, qrLeft: number | null, lobbyLeft: number | null, incidents: number): boolean {
  return open && qrLeft !== 0 && (lobbyLeft === 0 || incidents === 0);
}
