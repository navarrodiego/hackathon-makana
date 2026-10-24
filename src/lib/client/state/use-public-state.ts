"use client";

import { useEffect, useRef, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PublicStateDTO } from "@/lib/contracts/client";
import { acceptSnapshot } from "./accept";
import { getPublicState } from "./fetch-state";
import { combineCadence, nextDelay, refreshDecision, stateFingerprint, type Cadence } from "./sync";

export type PublicStateStatus = "loading" | "live" | "lost";

export interface PublicStateView {
  readonly state: PublicStateDTO | null;
  readonly status: PublicStateStatus;
  /** Instante local del último snapshot aceptado. */
  readonly lastUpdatedAt: number | null;
  /** Instante local en que se perdió la conexión, mientras `status` sea «lost». */
  readonly lostSince: number | null;
  /** Verdadero si, desde que se abrió la pestaña, la ejecución cambió al menos una vez (reset). */
  readonly executionChanged: boolean;
}

const initial: PublicStateView = { state: null, status: "loading", lastUpdatedAt: null, lostSince: null, executionChanged: false };
/** Pestañas del mismo navegador: tras una acción propia, las demás consultan sin esperar su turno. */
const CHANNEL = "relevo-state";

/*
 * Un único sondeo de GET /api/state por pestaña, compartido por todas las pantallas montadas. Una petición a la vez,
 * encadenada tras la anterior; se adelanta al volver a la pestaña, al recuperar la red o cuando otra pestaña avisa de
 * un cambio. Se detiene y limpia cuando no queda ninguna pantalla suscrita. No calcula plazos: solo guarda lo que el
 * servidor devolvió.
 */
const cadences = new Set<Cadence>();
const listeners = new Set<() => void>();
let view = initial;
let failures = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let stopTimer: ReturnType<typeof setTimeout> | undefined;
let controller: AbortController | null = null;
let inFlight = false;
let again = false;
let running = false;
/** Quien espera una lectura que empiece después de su llamada; se resuelve al terminarla, bien o mal. */
let waiting: (() => void)[] = [];
let served: (() => void)[] = [];
let channel: BroadcastChannel | null = null;

function publish(next: PublicStateView) {
  view = next;
  for (const listener of listeners) listener();
}

function schedule() {
  clearTimeout(timer);
  const cadence = combineCadence([...cadences]);
  // Si hay una petición en curso, al terminar programa la siguiente.
  if (!cadence || inFlight) return;
  timer = setTimeout(tick, nextDelay({ ...cadence, hidden: document.visibilityState === "hidden", failures, random: Math.random() }));
}

async function tick() {
  if (inFlight) { again = true; return; }
  clearTimeout(timer);
  inFlight = true;
  served = waiting;
  waiting = [];
  const own = new AbortController();
  controller = own;
  const next = await getPublicState(own.signal);
  // Una respuesta de un sondeo ya detenido no toca el estado del siguiente.
  if (own.signal.aborted) return;
  inFlight = false;
  const now = Date.now();
  if (!next) {
    failures += 1;
    publish({ ...view, status: "lost", lostSince: view.lostSince ?? now });
  } else {
    failures = 0;
    const accepted = acceptSnapshot(view.state, next);
    publish(accepted
      ? { state: accepted.state, status: "live", lastUpdatedAt: now, lostSince: null, executionChanged: accepted.executionChanged || view.executionChanged }
      : { ...view, status: "live", lostSince: null });
  }
  for (const done of served) done();
  served = [];
  // Un aviso llegó mientras se consultaba: se vuelve a leer en seguida para no mostrar el estado de antes del cambio.
  if (again) { again = false; void tick(); return; }
  schedule();
}

const wake = () => { void tick(); };
const onVisibility = () => { if (document.visibilityState === "visible") wake(); else schedule(); };

function start() {
  running = true;
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", wake);
  window.addEventListener("online", wake);
  window.addEventListener("pageshow", wake);
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = wake;
  }
  wake();
}

function stop() {
  running = false;
  document.removeEventListener("visibilitychange", onVisibility);
  window.removeEventListener("focus", wake);
  window.removeEventListener("online", wake);
  window.removeEventListener("pageshow", wake);
  channel?.close();
  channel = null;
  clearTimeout(timer);
  controller?.abort();
  controller = null;
  inFlight = false;
  again = false;
  failures = 0;
  for (const done of [...served, ...waiting]) done();
  served = [];
  waiting = [];
  view = initial;
}

function join(cadence: Cadence) {
  clearTimeout(stopTimer);
  cadences.add(cadence);
  if (running) schedule(); else start();
  return () => {
    cadences.delete(cadence);
    if (cadences.size > 0) { schedule(); return; }
    // Diferido: un cambio de ritmo desmonta y vuelve a montar en el mismo ciclo sin perder el último estado.
    stopTimer = setTimeout(() => { if (cadences.size === 0) stop(); }, 0);
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Consulta ahora, sin esperar el siguiente turno. Se resuelve cuando termina una lectura iniciada después. */
export function refreshNow(): Promise<void> {
  if (!running) return Promise.resolve();
  return new Promise(resolve => { waiting.push(resolve); wake(); });
}

/**
 * Tras una acción que cambió el estado: esta pestaña y las demás del mismo navegador consultan de inmediato.
 * Esperarla evita reactivar botones con una versión anterior a la propia acción.
 */
export function announceChange(): Promise<void> {
  if (typeof BroadcastChannel !== "undefined") {
    const out = new BroadcastChannel(CHANNEL);
    out.postMessage("changed");
    out.close();
  }
  return refreshNow();
}

export interface PollOptions {
  readonly keepPaceHidden?: boolean;
  /** Tope de espera propio tras fallos seguidos (canal público). */
  readonly maxBackoffMs?: number;
  /** Reparte el ritmo ±20 % entre teléfonos. */
  readonly jitter?: boolean;
}

/** Estado público vivo, compartido por las pantallas de la pestaña. */
export function usePublicState(intervalMs = 1000, options: PollOptions = {}): PublicStateView {
  const keepPaceHidden = options.keepPaceHidden ?? false;
  const { maxBackoffMs, jitter } = options;
  useEffect(() => join({
    intervalMs, keepPaceHidden, ...(maxBackoffMs === undefined ? {} : { maxBackoffMs }), ...(jitter ? { jitter } : {}),
  }), [intervalMs, keepPaceHidden, maxBackoffMs, jitter]);
  return useSyncExternalStore(subscribe, () => view, () => initial);
}

/**
 * Para vistas que llegan del servidor (control, canal): rehace la página solo cuando el estado público cambió,
 * más una relectura de seguridad cada `safetyMs` para lo privado. Nunca lanza un refresco sobre otro en curso.
 */
export function useServerViewSync(
  intervalMs: number, safetyMs: number,
  options: PollOptions & { readonly fingerprint?: (state: PublicStateDTO) => string } = {},
): PublicStateView {
  const router = useRouter();
  const live = usePublicState(intervalMs, options);
  const [refreshing, startTransition] = useTransition();
  const rendered = useRef<string | null>(null);
  const refreshedAt = useRef(0);
  const fingerprint = live.state ? (options.fingerprint ?? stateFingerprint)(live.state) : null;
  useEffect(() => {
    if (fingerprint === null || refreshing) return;
    const now = Date.now();
    const decision = refreshDecision({
      fingerprint, rendered: rendered.current, sinceRefreshMs: now - refreshedAt.current, safetyMs,
      hidden: document.visibilityState === "hidden",
    });
    if (decision === null) return;
    rendered.current = fingerprint;
    refreshedAt.current = now;
    if (decision !== "baseline") startTransition(() => router.refresh());
  }, [fingerprint, live.lastUpdatedAt, refreshing, safetyMs, router]);
  return live;
}
