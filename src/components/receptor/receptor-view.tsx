"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { HandoffResultDTO } from "@/lib/contracts/http";
import type { HandoffPackageDTO } from "@/lib/contracts/private";
import { ContinuityLine, continuityState } from "@/components/relevo/continuity-line";
import { PendingList, PendingRow } from "@/components/relevo/pending-row";
import { SurfaceShell } from "@/components/relevo/surface-shell";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/ui/countdown";
import { DegradedNotice, ErrorMessage } from "@/components/ui/feedback";
import { announceChange, usePublicState } from "@/lib/client/state";
import { buildRespondRequest, failureView, formatClock, reviewState, type FailureView, type RespondAction } from "./logic";
import { fetchWithTimeout } from "@/lib/client/fetch-timeout";

type Decision = "accepted" | "rejected" | null;

const POLL_MS = 1500;
/** Una red colgada termina como fallo de red: repetir la acción es seguro (clave determinista). */
const RESPOND_TIMEOUT_MS = 15_000;


async function respond(action: RespondAction, pkg: HandoffPackageDTO, token: string): Promise<{ ok: true; result: HandoffResultDTO } | { ok: false; failure: FailureView }> {
  const { url, init } = buildRespondRequest(action, pkg, token);
  try {
    const response = await fetchWithTimeout(url, { ...init, timeoutMs: RESPOND_TIMEOUT_MS });
    const body = await response.json().catch(() => null) as { ok?: boolean; data?: HandoffResultDTO; error?: { code?: string } } | null;
    if (response.ok && body?.ok && body.data) return { ok: true, result: body.data };
    return { ok: false, failure: failureView((body?.error?.code ?? "STORAGE_UNAVAILABLE") as Parameters<typeof failureView>[0]) };
  } catch {
    return { ok: false, failure: failureView("STORAGE_UNAVAILABLE") };
  }
}

/** Revisión del paquete. Abrir el enlace no acepta: solo estos dos botones envían una respuesta. */
export function ReceptorView({ pkg: initial, token }: { pkg: HandoffPackageDTO; token: string }) {
  const router = useRouter();
  const [pkg, setPkg] = useState(initial);
  const [decision, setDecision] = useState<Decision>(null);
  const [busy, setBusy] = useState<RespondAction | null>(null);
  const [failure, setFailure] = useState<FailureView | null>(null);
  const inFlight = useRef(false);
  const outcomeRef = useRef<HTMLDivElement>(null);

  const { handoff, coverage, outgoing } = pkg;
  const state = reviewState(pkg);
  const candidate = handoff.candidate;
  const startsAt = formatClock(coverage.startsAt);

  async function submit(action: RespondAction) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(action); setFailure(null);
    const outcome = await respond(action, pkg, token);
    if (outcome.ok) {
      setPkg({ ...pkg, handoff: outcome.result.handoff, coverage: outcome.result.coverage });
      setDecision(action === "accept" ? "accepted" : "rejected");
      void announceChange();
    } else setFailure(outcome.failure);
    inFlight.current = false; setBusy(null);
  }

  // Si el relevo cambió en el servidor (plazo vencido, otra respuesta, reinicio) mientras se revisa, la página se
  // vuelve a leer con el mismo enlace. Es una lectura: no acepta ni responde. Tras responder aquí ya no se relee.
  const live = usePublicState(POLL_MS);
  const remote = live.state;
  const changedElsewhere = decision === null && busy === null && remote !== null && (
    remote.executionId !== pkg.executionId
    || (remote.handoff?.id === pkg.handoff.id && remote.handoff.version > pkg.handoff.version));
  useEffect(() => { if (changedElsewhere) router.refresh(); }, [changedElsewhere, router]);

  // Un relevo ya aceptado también se lee así tras recargar: el estado persistido manda, no el clic local.
  const accepted = decision === "accepted" || (decision === null && state !== "awaiting");
  const settled = accepted || decision === "rejected" || failure?.kind === "reassigned";
  // Al responder desaparecen los botones: el foco pasa al resultado para no quedar en el vacío.
  useEffect(() => { if (decision !== null) outcomeRef.current?.focus(); }, [decision]);
  const actions = settled ? undefined : (
    <div className="flex flex-col gap-3">
      <Button variant="primary" loading={busy === "accept"} loadingLabel="Enviando respuesta…" onClick={() => submit("accept")} disabled={busy === "reject"}>
        Aceptar relevo
      </Button>
      <Button variant="secondary" loading={busy === "reject"} loadingLabel="Enviando respuesta…" onClick={() => submit("reject")} disabled={busy === "accept"}>
        No puedo cubrir
      </Button>
    </div>
  );

  return (
    <SurfaceShell title="Revisión del relevo" action={actions}>
      <p className="text-body">
        {outgoing.displayName} te envió el relevo. Abrir este enlace no lo acepta: eliges con los botones de abajo.
      </p>

      {accepted ? (
        <div ref={outcomeRef} tabIndex={-1} role="status" className="border-l-4 border-primary py-1 pl-4">
          <p className="text-body font-semibold">
            {state === "active" ? "Aceptaste el relevo. Tu cobertura está activa" : `Aceptaste el relevo. Tu cobertura comienza a las ${startsAt}`}
          </p>
          <p className="mt-1 text-body">Aceptar no toma ni resuelve incidentes. Los incidentes anteriores a esa hora no se te asignan.</p>
        </div>
      ) : null}
      {decision === "rejected" ? (
        <div ref={outcomeRef} tabIndex={-1} role="status" className="border-l-4 border-primary py-1 pl-4">
          <p className="text-body font-semibold">Indicaste que no puedes cubrir</p>
          <p className="mt-1 text-body">El relevo sigue el recorrido definido. Este enlace ya no permite otra respuesta.</p>
        </div>
      ) : null}
      {failure && failure.kind === "reassigned" ? (
        <DegradedNotice title={failure.title}><p>{failure.detail}</p></DegradedNotice>
      ) : failure ? (
        <ErrorMessage title={failure.title}><p>{failure.detail}</p></ErrorMessage>
      ) : null}

      {decision !== "rejected" ? (
        <ContinuityLine outgoing={outgoing} incoming={state === "awaiting" ? candidate : coverage.actor ?? candidate}
          state={state === "awaiting" ? continuityState(handoff, coverage) : state} startsAtLabel={startsAt} />
      ) : null}

      {state === "awaiting" && handoff.deadlineAt && !settled ? (
        <p className="text-body">
          Plazo para responder: <Countdown deadlineAt={handoff.deadlineAt} label={`Tienes hasta las ${formatClock(handoff.deadlineAt)} para responder`} className="font-semibold tabular-nums" />.
          {" "}Si no respondes, el relevo pasa al siguiente candidato.
        </p>
      ) : null}

      <section aria-labelledby="ventana">
        <h2 id="ventana" className="text-section font-semibold">Ventana de cobertura</h2>
        <p className="mt-2 text-body">De {startsAt} a {formatClock(coverage.endsAt)}. Una aceptación anticipada comienza a la hora prevista, no antes.</p>
      </section>

      {pkg.note.trim() ? (
        <section aria-labelledby="nota">
          <h2 id="nota" className="text-section font-semibold">Nota de {outgoing.displayName}</h2>
          <p className="mt-2 max-w-prose whitespace-pre-line break-words text-body">{pkg.note}</p>
        </section>
      ) : null}

      <section aria-labelledby="pendientes">
        <h2 id="pendientes" className="text-section font-semibold">Pendientes del turno</h2>
        <PendingList label="Pendientes del relevo">
          {pkg.tickets.map(t => (
            <PendingRow key={t.id} ticketId={t.reference} title={t.text}
              proposal={t.disposition === "transferir" ? <><span className="font-semibold text-primary">Para seguimiento.</span> {t.reason}</> : null} />
          ))}
        </PendingList>
      </section>
    </SurfaceShell>
  );
}
