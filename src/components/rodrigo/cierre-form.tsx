"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { RodrigoViewDTO } from "@/lib/contracts/private";
import type {
  CoverageDTO, HandoffId, HandoffSummaryDTO, TicketDisposition, TicketId,
} from "@/lib/contracts/client";
import { PendingList } from "@/components/relevo/pending-row";
import { ContinuityLine } from "@/components/relevo/continuity-line";
import { ROOM_COLUMNS, SurfaceShell } from "@/components/relevo/surface-shell";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/ui/countdown";
import { DegradedNotice, ErrorMessage } from "@/components/ui/feedback";
import { OperatorLogin } from "@/components/acceso/operator-login";
import { isSessionProblem } from "@/components/acceso/messages";
import { SignOutButton } from "@/components/acceso/sign-out-button";
import { announceChange, usePublicState } from "@/lib/client/state";
import { cn } from "@/lib/utils";
import { postJson } from "./api";
import {
  buildSendBody, clockLabel, closingLead, errorMessage, followUp, leftSummary, noteIssue, phaseOf, sendPayloadKey,
} from "./model";
import { NotaEditor } from "./nota-editor";
import { Pendiente, type TicketDraft } from "./pendiente-card";
import { ResumenNoche } from "./resumen/resumen-noche";

type Busy = "idle" | "regenerating" | "sending";
interface Problem { readonly text: string; readonly retryable: boolean; readonly relogin?: boolean }
type SuggestionData = { version: number; note: RodrigoViewDTO["note"] };
type SendData = { handoff: HandoffSummaryDTO; coverage: CoverageDTO };

const POLL_MS = 1500;

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

/** Plegable con flecha dibujada; `open`/`onToggle` opcionales para abrirlo desde fuera (errores de la nota). */
function Plegable({ summary, open, onToggle, children }: {
  summary: ReactNode; open?: boolean; onToggle?: (open: boolean) => void; children: ReactNode;
}) {
  return (
    <details className="group" open={open} onToggle={onToggle ? event => onToggle(event.currentTarget.open) : undefined}>
      <summary className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg text-body font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
        <svg aria-hidden="true" viewBox="0 0 12 12" className="size-[0.75em] shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none">
          <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        {summary}
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

/** Origen del borrador guardado; solo se muestra cuando existe (`aiDraft`). */
function originText(view: RodrigoViewDTO): string {
  return view.note.saved ? `Guardada a las ${clockLabel(view.note.saved.generatedAt)}, al preparar el turno.` : "";
}

export function CierreForm({ view, handoffId }: { view: RodrigoViewDTO; handoffId: HandoffId }) {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketDraft[]>(() => initialTickets(view));
  const [note, setNote] = useState(view.note.saved?.output.note ?? "");
  const [origin, setOrigin] = useState(() => originText(view));
  // Solo hay borrador de IA si se guardó al preparar el turno o se regeneró aquí; si no, los avisos ya lo explican.
  const [aiDraft, setAiDraft] = useState(view.note.status === "ready" && view.note.saved !== null);
  const [version, setVersion] = useState<number>(view.draftVersion);
  const [localHandoff, setLocalHandoff] = useState<HandoffSummaryDTO | null>(view.handoff);
  const [localCoverage, setLocalCoverage] = useState<CoverageDTO | null>(view.coverage);
  const [busy, setBusy] = useState<Busy>("idle");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [staleByServer, setStaleByServer] = useState(false);
  const [dirty, setDirty] = useState(false);
  // La edición de la nota se abre sola si la nota no se generó o si su error bloquea el envío.
  const [editing, setEditing] = useState(view.note.status === "failed");
  const [firstCandidate, setFirstCandidate] = useState<string | null>(view.handoff?.candidate?.id ?? null);
  const attempt = useRef<{ payload: string; key: string } | null>(null);

  // Estado público compartido con las demás pantallas. Otra ejecución significa que se reinició la demostración.
  const live = usePublicState(POLL_MS);
  const otherExecution = live.state !== null && live.state.executionId !== view.executionId;
  const snapshot = live.state && !otherExecution ? live.state : null;
  const lost = live.status === "lost";
  const stale = staleByServer || otherExecution;
  const remote = snapshot?.handoff && snapshot.handoff.status !== "draft" ? snapshot.handoff : null;
  // Lo más nuevo entre la respuesta de enviar y el sondeo: una lectura en vuelo no deshace el envío.
  const handoff = remote && (!localHandoff || remote.version >= localHandoff.version) ? remote : localHandoff;
  const coverage = handoff === remote && snapshot?.coverage ? snapshot.coverage : localCoverage;
  const sent = handoff !== null && handoff.status !== "draft";
  const preparing = view.note.status === "pending" && !dirty && !sent;
  // Primer candidato visto: se recuerda aunque el relevo escale después.
  if (firstCandidate === null && handoff?.status === "awaiting_candidate" && handoff.candidate) setFirstCandidate(handoff.candidate.id);

  const notePrepared = preparing && snapshot !== null && snapshot.preparation !== "pending";
  useEffect(() => { if (notePrepared) router.refresh(); }, [notePrepared, router]);
  // Tras un reset la vista se rehace sola, salvo que haya cambios sin enviar: entonces se avisa y se espera el clic.
  const rebuild = otherExecution && !dirty && busy === "idle";
  useEffect(() => { if (rebuild) router.refresh(); }, [rebuild, router]);

  const locked = sent || stale || busy !== "idle";

  async function regenerate() {
    setBusy("regenerating"); setProblem(null);
    const result = await postJson<SuggestionData>("/api/handoff/suggest", {
      executionId: view.executionId, idempotencyKey: crypto.randomUUID(), expectedVersion: version, handoffId,
    });
    setBusy("idle");
    if (!result.ok) {
      setProblem({ text: result.network ? "No se pudo conectar. Se conserva tu borrador." : errorMessage(result.code, "suggest"), retryable: result.network, relogin: isSessionProblem(result.code) });
      if (result.code === "VERSION_CONFLICT" || result.code === "EXECUTION_STALE") setStaleByServer(true);
      return;
    }
    const saved = result.data.note.saved;
    setVersion(result.data.version);
    if (!saved) { setProblem({ text: errorMessage("PROVIDER_FAILED", "suggest"), retryable: true }); return; }
    setNote(saved.output.note);
    setOrigin(`Regenerada en esta sesión a las ${clockLabel(saved.generatedAt)}.`);
    setAiDraft(true);
    setTickets(list => list.map(t => {
      const s = saved.output.suggestions.find(x => x.ticketId === (t.id as TicketId));
      return s ? { ...t, disposition: s.disposition as TicketDisposition, reason: s.reason } : t;
    }));
    setDirty(true);
  }

  async function send() {
    if (noteIssue(note)) { setShowErrors(true); setEditing(true); setProblem({ text: "Acorta la nota antes de enviar.", retryable: false }); return; }
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
        retryable: result.network || result.code === "OPERATION_PENDING", relogin: isSessionProblem(result.code),
      });
      if (result.code === "VERSION_CONFLICT" || result.code === "EXECUTION_STALE" || result.code === "STATE_CONFLICT") setStaleByServer(true);
      return;
    }
    setFirstCandidate(result.data.handoff.candidate?.id ?? null);
    setLocalHandoff(result.data.handoff); setLocalCoverage(result.data.coverage);
    void announceChange();
  }

  // Nombre y no «Tú»: esta vista también se proyecta a la sala.
  const outgoing = { id: view.actorId, displayName: "Rodrigo" };
  const follow = sent ? followUp({
    handoff, coverage, outgoing, firstCandidateId: firstCandidate, events: snapshot?.events ?? [],
  }) : null;
  const active = snapshot?.incidents.filter(i => i.status !== "taken") ?? view.activeIncidents;
  const phase = phaseOf(sent, snapshot?.scene.label ?? null);

  const action = sent ? undefined : (
    <Button variant="primary" className="w-full" loading={busy === "sending"} loadingLabel="Enviando relevo…"
      disabled={busy === "regenerating" || stale} onClick={send}>
      Enviar relevo
    </Button>
  );

  const pendientes = (
    <section aria-labelledby="pendientes" className="space-y-3">
      <h2 id="pendientes" className="text-section font-semibold">Pendientes que dejas</h2>
      <p className="text-aux text-muted-foreground">La IA destaca los que necesitan seguimiento; eso no los vuelve urgentes.</p>
      <PendingList label="Pendientes del turno">
        {tickets.map(t => <Pendiente key={t.id} ticket={t} />)}
      </PendingList>
    </section>
  );

  const nota = (
    <section aria-labelledby="nota" className="space-y-4">
      <h2 id="nota" className="text-section font-semibold">Nota para quien entra (opcional)</h2>
      {/* Mientras se edita, el campo ya muestra la nota: la cita sobraría. */}
      {editing ? null : note.trim()
        ? <blockquote className="max-w-[60ch] text-body text-pretty break-words whitespace-pre-line">{note}</blockquote>
        : <p className="text-body text-muted-foreground">Sin nota. Es opcional.</p>}
      {aiDraft ? <p className="text-aux text-muted-foreground">Borrador de IA · puedes enviarla tal cual, editarla o dejarla vacía. {origin}</p> : null}
      <Plegable summary="Editar nota" open={editing} onToggle={setEditing}>
        <NotaEditor note={note} disabled={locked} regenerating={busy === "regenerating"} showErrors={showErrors}
          onChange={value => { setNote(value); setDirty(true); }} onRegenerate={regenerate} />
      </Plegable>
    </section>
  );

  return (
    <SurfaceShell surface="adaptive" title={phase === "morning" ? "Resumen de la noche" : "Cierre de turno"}
      lead={phase === "closing" ? closingLead(tickets.length) : phase === "following" ? "Rodrigo envió el relevo." : undefined} action={action}>
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
      {problem?.relogin ? (
        <OperatorLogin role="outgoing" onSuccess={() => setProblem({ text: "Ingresaste de nuevo. Tu borrador se conserva; vuelve a pulsar el botón.", retryable: false })} />
      ) : null}

      {phase === "morning" && snapshot && follow ? <ResumenNoche state={snapshot} follow={follow} outgoing={outgoing} /> : null}

      {phase === "following" && follow ? (
        <section aria-labelledby="estado" className="space-y-4">
          <h2 id="estado" className="text-section font-semibold">Estado del relevo</h2>
          <ContinuityLine emphasis outgoing={outgoing} incoming={follow.incoming} state={follow.state} startsAtLabel={follow.startsAtLabel} />
          {follow.derivedNotice ? <p role="status" className="text-body">{follow.derivedNotice}</p> : null}
          {follow.coverageNotice ? <p role="status" className="text-body">{follow.coverageNotice}</p> : null}
          <dl className="grid items-baseline gap-x-6 gap-y-2 text-body sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">Tu turno termina</dt>
            <dd className="text-people font-semibold">{coverage ? clockLabel(coverage.outgoingEndsAt) : "Sin dato"}</dd>
            {handoff?.status === "awaiting_candidate" && handoff.deadlineAt && handoff.candidate ? (
              <><dt className="text-muted-foreground">Plazo real de {handoff.candidate.displayName}</dt>
                <dd className="text-people font-semibold"><Countdown deadlineAt={handoff.deadlineAt} label={`Plazo de aceptación de ${handoff.candidate.displayName} hasta las ${clockLabel(handoff.deadlineAt)}`} /></dd></>
            ) : null}
          </dl>
        </section>
      ) : null}

      {active.length > 0 ? (
        <section aria-labelledby="incidentes" className="space-y-2">
          <h2 id="incidentes" className="text-section font-semibold">Incidentes activos</h2>
          <ul className="divide-y divide-line border-y border-line">
            {active.map(i => (
              <li key={i.id} className="py-3 text-body">
                <span className="font-semibold">{SERVICE_LABEL[i.service] ?? i.service}</span>: {INCIDENT_LABEL[i.status]}
                {i.candidate ? ` · ${i.candidate.displayName}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sent ? (
        <div className="border-t border-line pt-4">
          <Plegable summary={leftSummary(tickets.length, note)}>
            <div className="flex flex-col gap-8">{pendientes}{nota}</div>
          </Plegable>
        </div>
      ) : (
        <div className={cn("flex flex-col gap-10", ROOM_COLUMNS)}>{pendientes}{nota}</div>
      )}
      <SignOutButton />
    </SurfaceShell>
  );
}
