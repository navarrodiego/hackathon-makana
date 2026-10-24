"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SECURITY } from "@/lib/contracts/auth";
import { LIMITS } from "@/lib/contracts/core";
import { announceChange, useLobbyRemaining, useServerViewSync } from "@/lib/client/state";
import { channelFingerprint } from "@/lib/client/state/sync";
import type { ChannelViewDTO } from "@/lib/contracts/public";
import { Button } from "@/components/ui/button";
import { DegradedNotice, ErrorMessage } from "@/components/ui/feedback";
import { hhmmss } from "@/components/registro/time";
import { fetchWithTimeout } from "@/lib/client/fetch-timeout";
import { TextAreaField, TextField } from "@/components/ui/field";
import { Status } from "@/components/ui/status";
import { receiptLine, reportLength } from "./receipt-text";

const MAX_TEXT = LIMITS.reportCharacters, MAX_NAME = 40, PER_SESSION = LIMITS.reportsPerSession;
/** Con el canal cerrado se consulta más seguido: abrirlo es el momento en que el público escanea el QR. */
const CLOSED_POLL_MS = 2000, OPEN_POLL_MS = 4000;
/** Tus reportes cambian de estado sin tocar el estado público: mientras alguno se procesa, se relee más seguido. */
const PROCESSING_REFRESH_MS = 2000, IDLE_REFRESH_MS = 15_000;
/**
 * Con 15–40 teléfonos: tras fallos seguidos se espera hasta 15 s y el ritmo se reparte ±20 %, para que al volver la
 * red no consulten todos a la vez. El envío espera más que la IA del servidor (hasta 10 s) antes de darse por perdido.
 */
const POLL = { maxBackoffMs: 15_000, jitter: true, fingerprint: channelFingerprint } as const;
const SEND_TIMEOUT_MS = 15_000;
/** Borrador y clave pendiente por pestaña: una recarga no pierde el texto y el reenvío no duplica el reporte. */
const DRAFT_KEY = "relevo-canal-borrador";
const NAME_KEY = "relevo-canal-nombre";

interface Draft { readonly executionId: string; readonly nickname: string; readonly text: string; readonly attempt: { content: string; key: string } | null }

function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) as Draft : null;
  } catch { return null; }
}
function writeDraft(draft: Draft | null) {
  try {
    if (draft && draft.text) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch { /* sin almacenamiento: el borrador vive solo en memoria */ }
}

/*
 * Nombre recordado en este navegador. Si el almacenamiento falla, dura lo que la pestaña (memoria del módulo).
 * El render del servidor no lo conoce: `undefined` hasta hidratar.
 */
let memoryName: string | null | undefined;
const nameListeners = new Set<() => void>();
function readName(): string | null {
  if (memoryName !== undefined) return memoryName;
  try { return window.localStorage.getItem(NAME_KEY); } catch { return null; }
}
function writeName(name: string | null) {
  memoryName = name;
  try {
    if (name === null) window.localStorage.removeItem(NAME_KEY);
    else window.localStorage.setItem(NAME_KEY, name);
  } catch { /* queda en memoria */ }
  for (const listener of nameListeners) listener();
}
const subscribeName = (listener: () => void) => { nameListeners.add(listener); return () => { nameListeners.delete(listener); }; };

type Problem = { readonly title: string; readonly detail: string };

/** Clave de intento: se reutiliza al reintentar el mismo contenido para no duplicar el reporte (C14). */
const newKey = () => `web-${crypto.randomUUID()}`;
const nameLength = (name: string) => [...name.trim()].length;

/**
 * Canal del público en tres pasos derivados del estado: nombre, espera común tras abrir el canal y envío.
 * El nombre no identifica ni da permisos; la cuota es por sesión. El servidor decide si admite cada reporte.
 */
export function Channel({ view }: { view: ChannelViewDTO }) {
  const router = useRouter();
  // El estado lo manda el servidor: la página se rehace cuando cambia y se limpia al desmontar.
  const processing = view.ownReports.some(r => r.status === "processing");
  const live = useServerViewSync(view.channelOpen ? OPEN_POLL_MS : CLOSED_POLL_MS, processing ? PROCESSING_REFRESH_MS : IDLE_REFRESH_MS, POLL);
  const lost = live.status === "lost";
  // El sondeo en vivo trae la hora de apertura sin rehacer la página; la vista del servidor cubre el primer render.
  const openedAt = live.state && live.state.executionId === view.executionId ? live.state.channelOpenedAt : view.channelOpenedAt;
  const remaining = useLobbyRemaining(live, view.channelOpen ? openedAt : null);
  const name = useSyncExternalStore(subscribeName, readName, () => undefined);
  const ready = view.channelOpen && remaining === 0;

  // Al volver la red, relee Tus reportes: un envío sin respuesta pudo quedar registrado mientras tanto.
  const wasLost = useRef(false);
  useEffect(() => {
    if (lost) { wasLost.current = true; return; }
    if (live.status === "live" && wasLost.current) { wasLost.current = false; router.refresh(); }
  }, [lost, live.status, router]);

  return (
    <>
      {lost ? (
        <DegradedNotice title={`Sin conexión${live.lostSince ? ` desde las ${hhmmss(live.lostSince)}` : ""}`}>
          <p>Tus reportes pueden no estar al día. Lo que escribiste se conserva en este teléfono y la página vuelve a consultar sola.</p>
        </DegradedNotice>
      ) : null}
      {name === undefined ? null : name === null ? <NameStep onEnter={writeName} /> : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6">
            <p className="text-people font-semibold break-words">Hola, {name}.</p>
            {/* Secundario y discreto: corrige un error de tipeo sin competir con el paso actual. */}
            <button type="button" onClick={() => writeName(null)}
              className="-mx-2 min-h-12 px-2 text-aux text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Cambiar nombre
            </button>
          </div>
          {!view.channelOpen ? (
            <div className="space-y-2">
              <Status kind="pending">El canal abre pronto</Status>
              <p className="text-body">Esta página se actualiza sola.</p>
            </div>
          ) : !ready ? <Waiting remaining={remaining} /> : <SendStep view={view} name={name} />}
        </>
      )}
      {/* Una sola vez, sin mover el foco: el envío quedó disponible para todos a la vez. */}
      <p aria-live="polite" className="sr-only">{name && ready ? "Ya puedes enviar reportes." : ""}</p>
      {view.ownReports.length > 0 ? <OwnReports reports={view.ownReports} /> : null}
    </>
  );
}

function NameStep({ onEnter }: { onEnter: (name: string) => void }) {
  const [value, setValue] = useState("");
  const length = nameLength(value);
  const error = length > MAX_NAME ? `Tu nombre tiene ${length} caracteres. El máximo es ${MAX_NAME}.` : undefined;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (length === 0 || error) return;
    onEnter(value.trim());
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <TextField label="Tu nombre" hint="Se verá en la pantalla de la sala junto a tus reportes." value={value} onChange={e => setValue(e.target.value)} autoComplete="given-name" enterKeyHint="go" error={error} />
      <Button type="submit" variant="primary" disabled={length === 0 || Boolean(error)}>Entrar</Button>
    </form>
  );
}

function Waiting({ remaining }: { remaining: number | null }) {
  const seconds = remaining === null ? null : Math.ceil(remaining / 1000);
  return (
    <section aria-labelledby="espera" className="space-y-3">
      <h2 id="espera" className="text-title font-semibold tracking-[-0.02em] tabular-nums">
        <span className="sr-only">Podrás enviar en unos segundos</span>
        <span aria-hidden="true">{seconds === null ? "En unos segundos puedes enviar" : `En ${seconds} s puedes enviar`}</span>
      </h2>
      <p className="text-body">Esperamos a que entren los demás.</p>
    </section>
  );
}

function SendStep({ view, name }: { view: ChannelViewDTO; name: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const attempt = useRef<{ content: string; key: string } | null>(null);
  const restored = useRef(false);

  // Al montar, recupera el borrador de esta pestaña. Solo en el cliente: el HTML del servidor no lo conoce.
  useEffect(() => {
    const draft = readDraft();
    restored.current = true;
    if (!draft) return;
    // La clave solo vale en su ejecución; tras un reset se conserva el texto y se envía como reporte nuevo.
    attempt.current = draft.executionId === view.executionId ? draft.attempt : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage no existe al renderizar en el servidor
    setText(draft.text);
  }, [view.executionId]);
  useEffect(() => {
    if (restored.current) writeDraft({ executionId: view.executionId, nickname: name, text, attempt: attempt.current });
  }, [name, text, view.executionId]);

  const length = reportLength(text);
  const textError = length > MAX_TEXT ? `El reporte tiene ${length} caracteres. El máximo es ${MAX_TEXT}.` : undefined;
  const sessionDone = view.remainingSessionReports === 0;
  const exhausted = sessionDone || view.remainingExecutionReports === 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending || exhausted || textError || length === 0) return;
    const content = JSON.stringify([name, text.trim()]);
    if (attempt.current?.content !== content) attempt.current = { content, key: newKey() };
    writeDraft({ executionId: view.executionId, nickname: name, text, attempt: attempt.current });
    setSending(true);
    setProblem(null);
    setConfirmation(null);
    let reached = false;
    try {
      const response = await fetchWithTimeout("/api/messages", {
        timeoutMs: SEND_TIMEOUT_MS, method: "POST", headers: { "content-type": "application/json", [SECURITY.publicSubmitHeader]: "1" }, cache: "no-store",
        body: JSON.stringify({ executionId: view.executionId, idempotencyKey: attempt.current.key, nickname: name, text: text.trim() }),
      });
      const body = await response.json().catch(() => null) as { ok?: boolean; error?: { message?: string } } | null;
      reached = true;
      if (response.ok && body?.ok) {
        setText("");
        attempt.current = null;
        writeDraft(null);
        void announceChange();
        setConfirmation("Reporte enviado. Su estado aparece en Tus reportes.");
      } else {
        setProblem({ title: "No se recibió el reporte", detail: body?.error?.message ?? "El servidor respondió con un error. Revisa Tus reportes antes de reenviar." });
      }
    } catch {
      setProblem({
        title: "No se pudo comprobar si el reporte llegó",
        detail: "Tu texto se conserva. Revisa Tus reportes; si no aparece, vuelve a enviar: el reintento no lo duplica.",
      });
    } finally {
      setSending(false);
      // Sin respuesta no se rehace la página: sin red fallaría igual. Se relee al volver la conexión.
      if (reached) router.refresh();
    }
  }

  if (exhausted) {
    return (
      <p className="text-body font-semibold">
        {sessionDone ? `Ya enviaste tus ${PER_SESSION} reportes.` : "La demostración llegó al límite de reportes."}
      </p>
    );
  }
  return (
    <section aria-labelledby="enviar" className="flex flex-col gap-6">
      <div className="space-y-3">
        <h2 id="enviar" className="text-section font-semibold">Trabajas en la empresa de Rodrigo</h2>
        <p className="max-w-prose text-body">
          Algo dejó de funcionar en tu local u oficina. Cuéntale a soporte qué pasó y dónde, como lo escribirías un día normal.
          Puedes enviar hasta {PER_SESSION} reportes. Tu nombre y lo que escribas se verán en la pantalla de la sala.
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <TextAreaField
          label="Qué pasó" value={text} onChange={e => setText(e.target.value)} rows={4} error={textError}
          hint={<>
            Por ejemplo: «No imprime la boleta en la caja 2 del local 12».
            <span className="mt-1 block tabular-nums">{length} de {MAX_TEXT} caracteres · Te quedan {view.remainingSessionReports} de {PER_SESSION} reportes</span>
          </>}
        />
        {/* Región persistente: anuncia el resultado una vez, sin mover el foco del formulario. */}
        <div data-testid="canal-resultado" aria-live="polite" aria-atomic="true" className="empty:hidden">
          {confirmation ? <p className="text-body font-semibold">{confirmation}</p> : null}
        </div>
        {problem ? <ErrorMessage title={problem.title}><p>{problem.detail}</p></ErrorMessage> : null}
        <Button type="submit" variant="primary" loading={sending} loadingLabel="Enviando reporte…" disabled={length === 0 || Boolean(textError)}>
          Enviar reporte
        </Button>
      </form>
    </section>
  );
}

function OwnReports({ reports }: { reports: ChannelViewDTO["ownReports"] }) {
  return (
    <section aria-labelledby="mis-reportes" className="border-t border-line pt-6">
      <h2 id="mis-reportes" className="text-section font-semibold">Tus reportes</h2>
      {/* El más reciente arriba: es el que cambia de estado mientras se mira. */}
      <ol className="mt-2 divide-y divide-line">
        {[...reports].reverse().map(report => {
          const line = receiptLine(report);
          return (
            <li key={report.reportId} className="space-y-1 py-4">
              <p className="line-clamp-2 text-body break-words">{report.text}</p>
              <Status kind={line.kind} className="text-aux">{line.text}</Status>
              {line.emergency ? <p className="text-body font-semibold">{line.emergency}</p> : null}
              {line.classified ? <p className="text-aux text-muted-foreground">{line.classified}</p> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
