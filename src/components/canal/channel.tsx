"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SECURITY } from "@/lib/contracts/auth";
import type { ChannelViewDTO } from "@/lib/contracts/public";
import { Button } from "@/components/ui/button";
import { DegradedNotice, EmptyState, ErrorMessage } from "@/components/ui/feedback";
import { TextAreaField, TextField } from "@/components/ui/field";
import { receiptLines, reportLength } from "./receipt-text";

const MAX_TEXT = 280, MAX_NICKNAME = 40, REFRESH_MS = 4000;

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

  // El estado lo manda el servidor: se relee mientras la pestaña está visible y se limpia al desmontar.
  useEffect(() => {
    const id = window.setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [router]);

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
    setSending(true);
    setProblem(null);
    setConfirmation(null);
    try {
      const response = await fetch("/api/messages", {
        method: "POST", headers: { "content-type": "application/json", [SECURITY.publicSubmitHeader]: "1" }, cache: "no-store",
        body: JSON.stringify({ executionId: view.executionId, idempotencyKey: attempt.current.key, nickname: nickname.trim(), text: text.trim() }),
      });
      const body = await response.json().catch(() => null) as { ok?: boolean; error?: { message?: string } } | null;
      if (response.ok && body?.ok) {
        setText("");
        attempt.current = null;
        setConfirmation("Reporte registrado. Su estado aparece en Tus reportes.");
      } else {
        setProblem({ title: "No se recibió el reporte", detail: body?.error?.message ?? "El servidor respondió con un error. Revisa tu lista antes de reenviar." });
      }
    } catch {
      setProblem({ title: "No se pudo comprobar si el reporte quedó registrado", detail: "Revisa tu lista. Si no aparece, vuelve a enviar: el reintento no duplica el reporte." });
    } finally {
      setSending(false);
      router.refresh();
    }
  }

  return (
    <>
      <p className="max-w-prose text-body">
        Cuenta qué falla y dónde. Usa un apodo inventado y no escribas datos personales reales.
      </p>
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
