"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { RodrigoViewDTO } from "@/lib/contracts/private";
import type {
  CoverageDTO, HandoffId, HandoffSummaryDTO, PublicStateDTO, TicketDisposition, TicketId,
} from "@/lib/contracts/client";
import { PendingList } from "@/components/relevo/pending-row";
import { ContinuityLine } from "@/components/relevo/continuity-line";
import { SurfaceShell } from "@/components/relevo/surface-shell";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/ui/countdown";
import { DegradedNotice, ErrorMessage } from "@/components/ui/feedback";
import { getState, postJson } from "./api";
import {
  buildSendBody, clockLabel, errorMessage, followUp, noteIssue, sendPayloadKey,
} from "./model";
import { NotaEditor } from "./nota-editor";
import { Pendiente, type TicketDraft } from "./pendiente-card";

type Busy = "idle" | "regenerating" | "sending";
interface Problem { readonly text: string; readonly retryable: boolean }
type SuggestionData = { version: number; note: RodrigoViewDTO["note"] };
type SendData = { handoff: HandoffSummaryDTO; coverage: CoverageDTO };

const INCIDENT_LABEL = { awaiting_ack: "Esperando acuse", unacknowledged: "Sin acuse", taken: "Tomado" } as const;
const SERVICE_LABEL: Record<string, string> = {
  facturacion: "Facturación", red_locales: "Red de locales", correo: "Correo", vpn: "VPN",
  impresora: "Impresora", cuentas: "Cuentas", otro: "Otro servicio",
};

function initialTickets(view: RodrigoViewDTO): TicketDraft[] {
  const saved = view.note.saved?.output.suggestions ?? [];
  return view.tickets.map(t => {
    const s = saved.find(x => x.ticketId === t.id);
    return s
      ? { id: t.id, reference: t.reference, text: t.text, disposition: s.disposition, reason: s.reason }
      : { id: t.id, reference: t.reference, text: t.text, disposition: t.disposition, reason: t.reason };
  });
}

function originText(view: RodrigoViewDTO): string {
  if (view.note.status === "ready" && view.note.saved) return `Guardada a las ${clockLabel(view.note.saved.generatedAt)}, al preparar el turno.`;
  if (view.note.status === "pending") return "Se está preparando.";
  return "No se generó. Escríbela o usa Regenerar.";
}

/** Polling del estado público: sin caché, con aborto y limpieza al desmontar. */
function useStatePoll(enabled: boolean, intervalMs: number, onState: (s: PublicStateDTO) => void, onLost: () => void) {
  const handlers = useRef({ onState, onLost });
  useEffect(() => { handlers.current = { onState, onLost }; });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const result = await getState(controller.signal);
      if (controller.signal.aborted) return;
      if (result.ok) handlers.current.onState(result.data); else handlers.current.onLost();
      timer = setTimeout(tick, intervalMs);
    };
    void tick();
    return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [enabled, intervalMs]);
}

export function CierreForm({ view, handoffId, extra }: { view: RodrigoViewDTO; handoffId: HandoffId; extra?: ReactNode }) {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketDraft[]>(() => initialTickets(view));
  const [note, setNote] = useState(view.note.saved?.output.note ?? "");
  const [origin, setOrigin] = useState(() => originText(view));
  const [version, setVersion] = useState<number>(view.draftVersion);
  const [handoff, setHandoff] = useState<HandoffSummaryDTO | null>(view.handoff);
  const [coverage, setCoverage] = useState<CoverageDTO | null>(view.coverage);
  const [snapshot, setSnapshot] = useState<PublicStateDTO | null>(null);
  const [busy, setBusy] = useState<Busy>("idle");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [lost, setLost] = useState(false);
  const [stale, setStale] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [firstCandidate, setFirstCandidate] = useState<string | null>(view.handoff?.candidate?.id ?? null);
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const sent = handoff !== null && handoff.status !== "draft";
  const preparing = view.note.status === "pending" && !dirty && !sent;

  const onState = useCallback((s: PublicStateDTO) => {
    setLost(false);
    if (s.executionId !== view.executionId) { setStale(true); return; }
    setSnapshot(s);
    if (s.handoff && s.handoff.status !== "draft") { setHandoff(s.handoff); if (s.coverage) setCoverage(s.coverage); }
    if (s.handoff?.status === "awaiting_candidate") setFirstCandidate(prev => prev ?? s.handoff?.candidate?.id ?? null);
    if (preparing && s.preparation !== "pending") router.refresh();
  }, [view.executionId, preparing, router]);
  useStatePoll(sent || preparing, sent && handoff?.status === "awaiting_candidate" ? 1500 : 4000, onState, useCallback(() => setLost(true), []));

  const locked = sent || stale || busy !== "idle";

  async function regenerate() {
    setBusy("regenerating"); setProblem(null);
    const result = await postJson<SuggestionData>("/api/handoff/suggest", {
      executionId: view.executionId, idempotencyKey: crypto.randomUUID(), expectedVersion: version, handoffId,
    });
    setBusy("idle");
    if (!result.ok) {
      setProblem({ text: result.network ? "No se pudo conectar. Se conserva tu borrador." : errorMessage(result.code, "suggest"), retryable: result.network });
      if (result.code === "VERSION_CONFLICT" || result.code === "EXECUTION_STALE") setStale(true);
      return;
    }
    const saved = result.data.note.saved;
    setVersion(result.data.version);
    if (!saved) { setProblem({ text: errorMessage("PROVIDER_FAILED", "suggest"), retryable: true }); return; }
    setNote(saved.output.note);
    setOrigin(`Regenerada en esta sesión a las ${clockLabel(saved.generatedAt)}.`);
    setTickets(list => list.map(t => {
      const s = saved.output.suggestions.find(x => x.ticketId === (t.id as TicketId));
      return s ? { ...t, disposition: s.disposition as TicketDisposition, reason: s.reason } : t;
    }));
    setDirty(true);
  }

  async function send() {
    if (noteIssue(note)) { setShowErrors(true); setProblem({ text: "Acorta la nota antes de enviar.", retryable: false }); return; }
    setBusy("sending"); setProblem(null);
    const payload = sendPayloadKey({ version, note, tickets });
    if (attempt.current?.payload !== payload) attempt.current = { payload, key: crypto.randomUUID() };
    const result = await postJson<SendData>("/api/handoff", buildSendBody({
      executionId: view.executionId, handoffId, version, idempotencyKey: attempt.current.key, note,
      tickets: tickets.map(t => ({ id: t.id as TicketId, disposition: t.disposition, reason: t.reason })),
    }));
    setBusy("idle");
    if (!result.ok) {
      setProblem({
        text: result.network ? "No se pudo comprobar si el relevo se envió. Reintenta: el servidor no lo duplicará." : errorMessage(result.code, "send"),
        retryable: result.network || result.code === "OPERATION_PENDING",
      });
      if (result.code === "VERSION_CONFLICT" || result.code === "EXECUTION_STALE" || result.code === "STATE_CONFLICT") setStale(true);
      return;
    }
    setFirstCandidate(result.data.handoff.candidate?.id ?? null);
    setHandoff(result.data.handoff); setCoverage(result.data.coverage);
  }

  const outgoing = { id: view.actorId, displayName: "Tú" };
  const follow = sent ? followUp({
    handoff, coverage, outgoing, firstCandidateId: firstCandidate, events: snapshot?.events ?? [],
  }) : null;
  const incidents = snapshot ? null : view.activeIncidents;

  const action = sent ? undefined : (
    <Button variant="primary" className="w-full" loading={busy === "sending"} loadingLabel="Enviando relevo…"
      disabled={busy === "regenerating" || stale} onClick={send}>
      Enviar relevo
    </Button>
  );

  return (
    <SurfaceShell title="Cierre de turno" action={action}>
      {stale ? (
        <DegradedNotice title="Esta vista quedó desactualizada">
          <p>El relevo cambió o se reinició la demostración. Tus cambios locales no se enviaron.</p>
          <p className="mt-3"><Button onClick={() => router.refresh()}>Recargar cierre</Button></p>
        </DegradedNotice>
      ) : null}
      {lost ? <DegradedNotice title="Sin conexión con el estado">No se pudo comprobar el estado más reciente. Lo último que ves puede estar desactualizado.</DegradedNotice> : null}
      {view.note.status === "pending" && !sent ? <DegradedNotice title="La nota aún se está preparando">Puedes esperar unos segundos o escribirla tú. No es una nota guardada.</DegradedNotice> : null}
      {view.note.status === "failed" && !dirty && !sent ? <DegradedNotice title="La nota no se generó">No hay borrador de IA. Puedes enviar el relevo sin nota, escribirla o usar Regenerar.</DegradedNotice> : null}
      {problem ? <ErrorMessage title={problem.text}>{problem.retryable ? "Puedes volver a pulsar el botón." : null}</ErrorMessage> : null}

      {sent && follow ? (
        <section aria-labelledby="estado" className="space-y-4 border-b border-line pb-6">
          <h2 id="estado" className="text-section font-semibold">Estado del relevo</h2>
          <ContinuityLine outgoing={outgoing} incoming={follow.incoming} state={follow.state} startsAtLabel={follow.startsAtLabel} />
          {follow.derivedNotice ? <p role="status" className="text-body">{follow.derivedNotice}</p> : null}
          {follow.coverageNotice ? <p role="status" className="text-body">{follow.coverageNotice}</p> : null}
          <dl className="grid gap-x-6 gap-y-2 text-body sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">Tu turno termina</dt>
            <dd>{coverage ? `${clockLabel(coverage.outgoingEndsAt)} (hora del escenario)` : "Sin dato"}</dd>
            {snapshot ? <><dt className="text-muted-foreground">Hora del escenario</dt><dd>{clockLabel(snapshot.clocks.narrativeNow)}</dd></> : null}
            {handoff?.status === "awaiting_candidate" && handoff.deadlineAt && handoff.candidate ? (
              <><dt className="text-muted-foreground">Plazo real de {handoff.candidate.displayName}</dt>
                <dd><Countdown deadlineAt={handoff.deadlineAt} label={`Plazo de aceptación de ${handoff.candidate.displayName} hasta las ${clockLabel(handoff.deadlineAt)}`} /></dd></>
            ) : null}

          </dl>
          <p className="text-aux text-muted-foreground">Enviar el relevo no confirma cobertura. Aceptar, empezar la cobertura y terminar tu turno son hechos distintos.</p>
        </section>
      ) : null}

      <section aria-labelledby="pendientes" className="space-y-3">
        <h2 id="pendientes" className="text-section font-semibold">Pendientes que dejas</h2>
        <p className="text-aux text-muted-foreground">Quien entra recibe todos. La IA destaca los que necesitan seguimiento; eso no los vuelve urgentes ni genera avisos.</p>
        <PendingList label="Pendientes del turno">
          {tickets.map(t => <Pendiente key={t.id} ticket={t} />)}
        </PendingList>
      </section>

      <NotaEditor note={note} origin={origin} disabled={locked} regenerating={busy === "regenerating"} showErrors={showErrors}
        onChange={value => { setNote(value); setDirty(true); }} onRegenerate={regenerate} />

      <section aria-labelledby="incidentes" className="space-y-2 border-t border-line pt-6">
        <h2 id="incidentes" className="text-section font-semibold">Incidentes activos</h2>
        {(snapshot?.incidents.filter(i => i.status !== "taken") ?? incidents ?? []).length === 0 ? (
          <p className="text-body">No hay incidentes activos registrados.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {(snapshot?.incidents.filter(i => i.status !== "taken") ?? incidents ?? []).map(i => (
              <li key={i.id} className="py-3 text-body">
                <span className="font-semibold">{SERVICE_LABEL[i.service] ?? i.service}</span>: {INCIDENT_LABEL[i.status]}
                {i.candidate ? ` · ${i.candidate.displayName}` : ""}
              </li>
            ))}
          </ul>
        )}
        <p className="text-aux text-muted-foreground">Cerrar tu turno no vuelve a avisar un incidente ya avisado.</p>
      </section>
      {extra}
    </SurfaceShell>
  );
}
