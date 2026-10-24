"use client";

import { useEffect, useState } from "react";
import { LIMITS } from "@/lib/contracts/core";
import type { PublicStateView } from "./use-public-state";

/**
 * Espera común tras abrir el canal (C13): el envío público empieza `LIMITS.channelLobbyMs` después de
 * `channelOpenedAt`. El servidor decide; aquí solo se muestra, con su reloj para que todas las pantallas
 * terminen en el mismo instante. Devuelve los ms que faltan, `0` sin espera y `null` antes del primer tic
 * (el render del servidor no conoce la hora del teléfono). El intervalo se detiene al cumplirse y al desmontar.
 */
export function useLobbyRemaining(live: PublicStateView, channelOpenedAt: string | null): number | null {
  const endsAt = channelOpenedAt ? Date.parse(channelOpenedAt) + LIMITS.channelLobbyMs : null;
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
