"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SECURITY } from "@/lib/contracts/auth";
import { announceChange, useServerViewSync } from "@/lib/client/state";
import { channelFingerprint } from "@/lib/client/state/sync";
import type { ChannelViewDTO } from "@/lib/contracts/public";
import { Button } from "@/components/ui/button";
import { DegradedNotice, EmptyState, ErrorMessage } from "@/components/ui/feedback";
import { hhmmss } from "@/components/registro/time";
import { fetchWithTimeout } from "@/lib/client/fetch-timeout";
import { TextAreaField, TextField } from "@/components/ui/field";
import { receiptLines, reportLength } from "./receipt-text";

const MAX_TEXT = 280, MAX_NICKNAME = 40;
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

interface Draft { readonly executionId: string; readonly nickname: string; readonly text: string; readonly attempt: { content: string; key: string } | null }

function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) as Draft : null;
  } catch { return null; }
}
function writeDraft(draft: Draft | null) {
  try {
    if (draft && (draft.nickname || draft.text)) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch { /* sin almacenamiento: el borrador vive solo en memoria */ }
}

type Problem = { readonly title: string; readonly detail: string };

/** Clave de intento: se reutiliza al reintentar el mismo contenido para no duplicar el reporte (C14). */
const newKey = () => `web-${crypto.randomUUID()}`;

export function Channel({ view }: { view: ChannelViewDTO }) {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const attempt = useRef<{ content: string; key: string } | null>(null);
  const restored = useRef(false);

  // El estado lo manda el servidor: la página se rehace cuando cambia y se limpia al desmontar.
  const processing = view.ownReports.some(r => r.status === "processing");
  const live = useServerViewSync(view.channelOpen ? OPEN_POLL_MS : CLOSED_POLL_MS, processing ? PROCESSING_REFRESH_MS : IDLE_REFRESH_MS, POLL);
  const lost = live.status === "lost";

  // Al montar, recupera el borrador de esta pestaña. Solo en el cliente: el HTML del servidor no lo conoce.
  useEffect(() => {
    const draft = readDraft();
    restored.current = true;
    if (!draft) return;
    // La clave solo vale en su ejecución; tras un reset se conserva el texto y se envía como reporte nuevo.
    attempt.current = draft.executionId === view.executionId ? draft.attempt : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage no existe al renderizar en el servidor
    setNickname(draft.nickname);
    setText(draft.text);
  }, [view.executionId]);
  useEffect(() => {
    if (restored.current) writeDraft({ executionId: view.executionId, nickname, text, attempt: attempt.current });
  }, [nickname, text, view.executionId]);

  // Al volver la red, relee Tus reportes: un envío sin respuesta pudo quedar registrado mientras tanto.
  const wasLost = useRef(false);
  useEffect(() => {
    if (lost) { wasLost.current = true; return; }
    if (live.status === "live" && wasLost.current) { wasLost.current = false; router.refresh(); }
  }, [lost, live.status, router]);

  const length = reportLength(text);
  const nicknameLength = [...nickname.trim()].length;
  const textError = length > MAX_TEXT ? `El reporte tiene ${length} caracteres. El máximo es ${MAX_TEXT}.` : undefined;
  const nicknameError = nicknameLength > MAX_NICKNAME ? `El apodo tiene ${nicknameLength} caracteres. El máximo es ${MAX_NICKNAME}.` : undefined;
  const exhausted = view.remainingSessionReports === 0 || view.remainingExecutionReports === 0;
  const closed = !view.channelOpen;
  const blocked = closed || exhausted;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending || blocked || textError || nicknameError || length === 0 || nicknameLength === 0) return;
    const content = JSON.stringify([nickname.trim(), text.trim()]);
    if (attempt.current?.content !== content) attempt.current = { content, key: newKey() };
    writeDraft({ executionId: view.executionId, nickname, text, attempt: attempt.current });
    setSending(true);
    setProblem(null);
    setConfirmation(null);
    let reached = false;
    try {
      const response = await fetchWithTimeout("/api/messages", {
        timeoutMs: SEND_TIMEOUT_MS, method: "POST", headers: { "content-type": "application/json", [SECURITY.publicSubmitHeader]: "1" }, cache: "no-store",
        body: JSON.stringify({ executionId: view.executionId, idempotencyKey: attempt.current.key, nickname: nickname.trim(), text: text.trim() }),
      });
      const body = await response.json().catch(() => null) as { ok?: boolean; error?: { message?: string } } | null;
      reached = true;
      if (response.ok && body?.ok) {
        setText("");
        attempt.current = null;
        writeDraft({ executionId: view.executionId, nickname, text: "", attempt: null });
        void announceChange();
        setConfirmation("Reporte registrado. Su estado aparece en Tus reportes.");
      } else {
        setProblem({ title: "No se recibió el reporte", detail: body?.error?.message ?? "El servidor respondió con un error. Revisa tu lista antes de reenviar." });
      }
    } catch {
      setProblem({
        title: "No se pudo comprobar si el reporte quedó registrado",
        detail: "Tu texto se conserva. Revisa tu lista; si no aparece, vuelve a enviar: el reintento no duplica el reporte.",
      });
    } finally {
      setSending(false);
      // Sin respuesta no se rehace la página: sin red fallaría igual. Se relee al volver la conexión.
      if (reached) router.refresh();
    }
  }

  return (
    <>
      <p className="max-w-prose text-body">
        Cuenta qué falla y dónde. Usa un apodo inventado y no escribas datos personales reales.
      </p>
      {lost ? (
        <DegradedNotice title={`Sin conexión${live.lostSince ? ` desde las ${hhmmss(live.lostSince)}` : ""}`}>
          <p>Tus reportes pueden no estar al día. Lo que escribiste se conserva en este teléfono y la página vuelve a consultar sola.</p>
        </DegradedNotice>
      ) : null}
      {closed ? (
        <DegradedNotice title="El canal está cerrado por ahora">
          <p>No se reciben reportes. Esta página se actualiza sola cuando se abra.</p>
        </DegradedNotice>
      ) : null}
      {!closed && exhausted ? (
        <DegradedNotice title="Se alcanzó el límite de reportes">
          <p>{view.remainingSessionReports === 0 ? "Ya enviaste los 5 reportes de esta sesión." : "La demostración llegó al límite de reportes."}</p>
        </DegradedNotice>
      ) : null}
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <TextField
          label="Apodo" value={nickname} onChange={e => setNickname(e.target.value)} autoComplete="off" disabled={blocked}
          hint="Inventado. No identifica a nadie ni da permisos." error={nicknameError}
        />
        <TextAreaField
          label="Reporte" value={text} onChange={e => setText(e.target.value)} disabled={blocked} rows={4}
          hint={`${length} de ${MAX_TEXT} caracteres. Te quedan ${view.remainingSessionReports} de 5 envíos.`} error={textError}
        />
        {/* Región persistente: anuncia el resultado una vez, sin mover el foco del formulario. */}
        <div data-testid="canal-resultado" aria-live="polite" aria-atomic="true" className="empty:hidden">
          {confirmation ? <p className="text-body font-semibold">{confirmation}</p> : null}
        </div>
        {problem ? <ErrorMessage title={problem.title}><p>{problem.detail}</p></ErrorMessage> : null}
        <Button
          type="submit" variant="primary" loading={sending} loadingLabel="Enviando reporte…"
          disabled={blocked || length === 0 || nicknameLength === 0 || Boolean(textError) || Boolean(nicknameError)}
        >
          Enviar reporte
        </Button>
      </form>
      <section aria-labelledby="mis-reportes" className="border-t border-line pt-6">
        <h2 id="mis-reportes" className="text-section font-semibold">Tus reportes</h2>
        {view.ownReports.length === 0 ? (
          <EmptyState title="Aún no enviaste reportes">Aquí verás qué pasó con cada uno.</EmptyState>
        ) : (
          <ol className="mt-3 flex flex-col gap-4">
            {view.ownReports.map((report, index) => {
              const lines = receiptLines(report);
              return (
                <li key={report.reportId} className="border-l-4 border-line pl-4">
                  <p className="text-body font-semibold">Reporte {index + 1}: {lines.status}</p>
                  {lines.emergency ? <p className="mt-1 text-body font-semibold">{lines.emergency}</p> : null}
                  {lines.classified ? <p className="mt-1 text-aux text-muted-foreground">{lines.classified}</p> : null}
                  {lines.notice ? <p className="mt-1 text-aux text-muted-foreground">{lines.notice}</p> : null}
                  {lines.degraded ? <p className="mt-1 text-aux text-muted-foreground">{lines.degraded}</p> : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}
