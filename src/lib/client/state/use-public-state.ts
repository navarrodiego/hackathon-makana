"use client";

import { useEffect, useState } from "react";
import type { PublicStateDTO } from "@/lib/contracts/client";
import { acceptSnapshot } from "./accept";
import { getPublicState } from "./fetch-state";

export type PublicStateStatus = "loading" | "live" | "lost";

export interface PublicStateView {
  readonly state: PublicStateDTO | null;
  readonly status: PublicStateStatus;
  /** Instante local del último snapshot aceptado. */
  readonly lastUpdatedAt: number | null;
  /** Instante local en que se perdió la conexión, mientras `status` sea «lost». */
  readonly lostSince: number | null;
  /** Verdadero si, desde que se montó, la ejecución cambió al menos una vez (reset). */
  readonly executionChanged: boolean;
}

const initial: PublicStateView = { state: null, status: "loading", lastUpdatedAt: null, lostSince: null, executionChanged: false };

/**
 * Consumidor compartido del estado público (T15, para T16/T17). Una petición a la vez, encadenada
 * tras la anterior; aborta y limpia al desmontar. No calcula plazos: solo muestra lo que el servidor devolvió.
 */
export function usePublicState(intervalMs = 1000): PublicStateView {
  const [view, setView] = useState<PublicStateView>(initial);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const next = await getPublicState(controller.signal);
      if (controller.signal.aborted) return;
      const now = Date.now();
      setView(prev => {
        if (!next) return { ...prev, status: "lost", lostSince: prev.lostSince ?? now };
        const accepted = acceptSnapshot(prev.state, next);
        if (!accepted) return { ...prev, status: "live", lostSince: null };
        return { state: accepted.state, status: "live", lastUpdatedAt: now, lostSince: null, executionChanged: accepted.executionChanged || prev.executionChanged };
      });
      timer = setTimeout(tick, intervalMs);
    };
    void tick();
    return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [intervalMs]);
  return view;
}
