"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { RodrigoViewDTO } from "@/lib/contracts/private";
import type { ActorDTO, CoverageDTO, HandoffId, HandoffSummaryDTO, TicketId } from "@/lib/contracts/client";
import { HANDOFF_SUMMARY } from "@/lib/contracts/fixtures";
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

type Busy = "idle" | "sending";
interface Problem { readonly text: string; readonly retryable: boolean; readonly relogin?: boolean }
type SendData = { handoff: HandoffSummaryDTO; coverage: CoverageDTO };

const POLL_MS = 1500;

const INCIDENT_LABEL = { awaiting_ack: "Esperando acuse", unacknowledged: "Sin acuse", taken: "Tomado" } as const;
const SERVICE_LABEL: Record<string, string> = {
  facturacion: "Facturación", red_locales: "Red de locales", correo: "Correo", vpn: "VPN",
  impresora: "Impresora", cuentas: "Cuentas", otro: "Otro servicio",
};

/** Decisión y razón vienen del pendiente del escenario; el cierre no usa IA. */
function initialTickets(view: RodrigoViewDTO): TicketDraft[] {
  return view.tickets.map(t => ({ id: t.id, reference: t.reference, text: t.text, disposition: t.disposition, reason: t.reason }));
}

/** Plegable con flecha dibujada para lo ya entregado. */
function Plegable({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  return (
    <details className="group">
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

export function CierreForm({ view, handoffId }: { view: RodrigoViewDTO; handoffId: HandoffId }) {
  const router = useRouter();
  const [tickets] = useState<TicketDraft[]>(() => initialTickets(view));
  // Resumen de traspaso fijo en el código, editable antes de enviar.
  const [note, setNote] = useState(HANDOFF_SUMMARY);
  const version = view.draftVersion;
  const [localHandoff, setLocalHandoff] = useState<HandoffSummaryDTO | null>(view.handoff);
  const [localCoverage, setLocalCoverage] = useState<CoverageDTO | null>(view.coverage);
  const [busy, setBusy] = useState<Busy>("idle");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [staleByServer, setStaleByServer] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [firstCandidate, setFirstCandidate] = useState<ActorDTO | null>(view.handoff?.candidate ?? null);
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
  // Primer candidato visto: se recuerda aunque el relevo escale después.
  if (firstCandidate === null && handoff?.status === "awaiting_candidate" && handoff.candidate) setFirstCandidate(handoff.candidate);

  // Tras un reset la vista se rehace sola, salvo que haya cambios sin enviar: entonces se avisa y se espera el clic.
  const rebuild = otherExecution && !dirty && busy === "idle";
  useEffect(() => { if (rebuild) router.refresh(); }, [rebuild, router]);

  const locked = sent || stale || busy !== "idle";

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
        retryable: result.network || result.code === "OPERATION_PENDING", relogin: isSessionProblem(result.code),
      });
      if (result.code === "VERSION_CONFLICT" || result.code === "EXECUTION_STALE" || result.code === "STATE_CONFLICT") setStaleByServer(true);
      return;
    }
    setFirstCandidate(result.data.handoff.candidate ?? null);
    setLocalHandoff(result.data.handoff); setLocalCoverage(result.data.coverage);
    void announceChange();
  }

  // Nombre y no «Tú»: esta vista también se proyecta a la sala.
  const outgoing = { id: view.actorId, displayName: "Rodrigo" };
  const follow = sent ? followUp({
    handoff, coverage, outgoing, firstCandidate, events: snapshot?.events ?? [],
  }) : null;
  const active = snapshot?.incidents.filter(i => i.status !== "taken") ?? view.activeIncidents;
  const phase = phaseOf(sent, snapshot?.scene.label ?? null);

  const action = sent ? undefined : (
    <Button variant="primary" className="w-full" loading={busy === "sending"} loadingLabel="Enviando relevo…"
      disabled={stale} onClick={send}>
      Enviar relevo
    </Button>
  );

  const pendientes = (
    <section aria-labelledby="pendientes" className="space-y-3">
      <h2 id="pendientes" className="text-body font-semibold text-muted-foreground">Pendientes que dejas</h2>
      <PendingList label="Pendientes del turno">
        {tickets.map(t => <Pendiente key={t.id} ticket={t} />)}
      </PendingList>
    </section>
  );

  const nota = (
    // Campo visible y editable desde el inicio, con el resumen fijo ya escrito: sin plegable ni salto de diseño.
    <section aria-label="Nota para quien entra">
      <NotaEditor note={note} disabled={locked} showErrors={showErrors}
        onChange={value => { setNote(value); setDirty(true); }} />
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
