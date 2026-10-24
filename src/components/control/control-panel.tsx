"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ControlViewDTO } from "@/lib/contracts/private";
import { EventLog } from "@/components/relevo/event-log";
import { hhmm } from "@/components/registro/time";
import { SurfaceShell } from "@/components/relevo/surface-shell";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/feedback";
import { Status } from "@/components/ui/status";
import { OperatorLogin } from "@/components/acceso/operator-login";
import { isSessionProblem } from "@/components/acceso/messages";
import { SignOutButton } from "@/components/acceso/sign-out-button";
import { Conexion } from "@/components/proyector/conexion";
import { LIMITS } from "@/lib/contracts/core";
import { announceChange, freshest, qrOnScreen, useLobbyRemaining, useServerViewSync } from "@/lib/client/state";
import { failureMessage, postJson } from "./api";
import {
  SCRIPTED_REPORTS, buildQrRequest, buildReportRequest, buildResetRequest, buildSceneRequest, buildTakeRequest,
  clockLabel, eventText, resolveShortcut, scriptStep, takeableIncident, type Moment, type ScriptedReport, type ShortcutState,
} from "./logic";

const POLL_MS = 1000;
/** Relectura de la vista protegida aunque el estado público no cambie (preparación de la nota). */
const SAFETY_REFRESH_MS = 10_000;
const newKey = () => `control-${crypto.randomUUID()}`;
type Notice = { readonly tone: "ok" | "error"; readonly text: string; readonly relogin?: boolean } | null;

const MOMENT_LABEL: Readonly<Record<Moment, string>> = { closing: "Cierre de turno", night: "Noche", morning: "Mañana" };

/**
 * Operación protegida. Todo cambio pasa por las APIs comunes con origen escenario; la vista se rehace desde el
 * servidor. No hay estado visual propio de cobertura ni reloj de plazos en el cliente.
 */
export function ControlPanel({ view }: { view: ControlViewDTO }) {
  const router = useRouter();
  const live = useServerViewSync(POLL_MS, SAFETY_REFRESH_MS);
  // El sondeo muestra el cambio sin esperar a que la página vuelva del servidor; nunca retrocede.
  const state = freshest(view.state, live.state);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [reportIndex, setReportIndex] = useState(0);
  // Una clave por intención hasta que termine bien: un reintento tras un corte no duplica la operación.
  const keys = useRef(new Map<string, string>());
  const shortcut = useRef<ShortcutState>({ armedAt: null, resetOpen: false });
  const busyRef = useRef<string | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  // Estado en refs para que el oyente de teclado sea uno solo y se limpie al desmontar.
  const latest = useRef<Record<string, () => void>>({});

  const keyFor = (intent: string) => {
    let key = keys.current.get(intent);
    if (!key) { key = newKey(); keys.current.set(intent, key); }
    return key;
  };

  const run = useCallback(async (intent: string, label: string, send: (key: string) => Promise<{ ok: boolean; code?: string }>) => {
    if (busyRef.current) return;
    busyRef.current = intent;
    // Los botones se deshabilitan mientras corre la acción y el navegador suelta el foco: se devuelve al terminar.
    const origin = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    setBusy(intent);
    setNotice(null);
    const key = keys.current.get(intent) ?? newKey();
    keys.current.set(intent, key);
    const result = await send(key);
    if (result.ok) {
      keys.current.delete(intent);
      // Los botones vuelven cuando la vista ya tiene la versión que dejó esta acción.
      await announceChange();
      setNotice({ tone: "ok", text: `${label} Registrado con origen escenario.` });
    } else {
      // Un rechazo definitivo del servidor no se reintenta con la misma clave; un corte sí.
      if (result.code !== "NETWORK" && result.code !== "OPERATION_PENDING") keys.current.delete(intent);
      setNotice({ tone: "error", text: failureMessage(result.code ?? "UNKNOWN"), relogin: isSessionProblem(result.code ?? "") });
    }
    busyRef.current = null;
    restoreFocus.current = origin;
    setBusy(null);
    router.refresh();
  }, [router]);

  const changeScene = (sceneId: string, channelOpen: boolean, label: string) =>
    run(`scene:${sceneId}:${channelOpen}`, label, key =>
      postJson("/api/scene", buildSceneRequest(state, sceneId as never, channelOpen, key)));

  const changeQr = (action: "extend" | "show") =>
    run(`qr:${action}`, action === "extend" ? "Se sumaron 30 s al QR." : "El QR volvió a la pantalla por 30 s.", key =>
      postJson("/api/qr", buildQrRequest(state, action, key)));

  const sendReport = (report: ScriptedReport) =>
    run(`report:${report.id}`, `Reporte guionado «${report.label}» enviado.`, key =>
      postJson("/api/messages", buildReportRequest(state.executionId, report, key)));

  const takeAsTomas = () => {
    const incident = takeableIncident(state.incidents, tomas?.id ?? "");
    if (!incident) return;
    const req = buildTakeRequest(state.executionId, incident, keyFor(`take:${incident.id}:${incident.version}`));
    return run(`take:${incident.id}:${incident.version}`, "Incidente tomado por Tomás.", async () => postJson(req.url, req.body));
  };

  const reset = () => run("reset", "Nueva ejecución creada.", async key => {
    const result = await postJson("/api/reset", buildResetRequest(state, key));
    if (result.ok) { setResetOpen(false); shortcut.current = { armedAt: null, resetOpen: false }; }
    return result;
  });

  // Misma cuenta y misma regla que el proyector: control ve lo que la sala tiene en pantalla.
  const qrLeft = useLobbyRemaining(live, state.channelOpen ? state.qrEndsAt : null);
  const lobbyLeft = useLobbyRemaining(live, state.channelOpen ? state.lobbyEndsAt : null);
  const qrShown = qrOnScreen(state.channelOpen, qrLeft, lobbyLeft, state.incidents.length);
  const qrAtCap = qrLeft !== null && qrLeft + LIMITS.qrExtensionMs > LIMITS.qrMaxAheadMs;

  const tomas = view.representedActors.find(a => a.displayName === "Tomás");
  const step = scriptStep(view.sceneOptions, state.scene.label);
  const next = step.next;
  const takeable = tomas ? takeableIncident(state.incidents, tomas.id) : null;
  const stepLabel = step.moment === "closing" ? "Empezar la noche y abrir el canal" : "Pasar a la mañana";

  const act: Record<string, () => void> = {
    next_step: () => {
      if (!next) return;
      const open = step.opensChannel || state.channelOpen;
      void changeScene(next.id, open, step.opensChannel ? `Son las ${hhmm(next.narrativeAt)} y el canal está abierto.` : `Son las ${hhmm(next.narrativeAt)}.`);
    },
    toggle_channel: () => {
      const open = !state.channelOpen;
      void changeScene(state.scene.id, open, open ? "Canal abierto." : "Canal cerrado.");
    },
    next_report: () => {
      const report = SCRIPTED_REPORTS[reportIndex % 3];
      setReportIndex(i => i + 1);
      void sendReport(report);
    },
    billing_report: () => { void sendReport(SCRIPTED_REPORTS[3]); },
  };
  useEffect(() => { latest.current = act; });

  useEffect(() => {
    let timer: number | undefined;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const result = resolveShortcut({
        key: e.key, now: Date.now(), repeat: e.repeat, ctrl: e.ctrlKey, alt: e.altKey, meta: e.metaKey,
        target: target ? { tagName: target.tagName, isContentEditable: target.isContentEditable } : null,
      }, shortcut.current);
      shortcut.current = result.state;
      if (!result.action) return;
      // Espacio y flechas no deben desplazar la página ni activar el botón enfocado.
      e.preventDefault();
      window.clearTimeout(timer);
      if (result.action === "reset_arm") {
        setArmed(true);
        timer = window.setTimeout(() => { shortcut.current = { armedAt: null, resetOpen: false }; setArmed(false); }, 4000);
        return;
      }
      setArmed(false);
      if (result.action === "reset_open") { setResetOpen(true); return; }
      latest.current[result.action]?.();
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); window.clearTimeout(timer); };
  }, []);

  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (resetOpen) dialogRef.current?.querySelector("button")?.focus(); }, [resetOpen]);
  const closeReset = () => {
    setResetOpen(false);
    shortcut.current = { armedAt: null, resetOpen: false };
    document.getElementById("reiniciar")?.focus();
  };

  const entries = [...state.events].sort((a, b) => b.sequence - a.sequence).slice(0, 12).map(e => ({
    id: e.id, timeLabel: clockLabel(e.narrativeAt),
    text: `${eventText(e.kind)}${e.actor ? ` · ${e.actor.displayName}` : ""}`,
    originLabel: e.origin === "scenario" ? "origen escenario" : e.channel === "ntfy" ? "ntfy" : undefined,
  }));
  const working = busy !== null;
  // Con los botones ya habilitados de nuevo se devuelve el foco, salvo que la persona lo haya movido.
  useEffect(() => {
    const target = restoreFocus.current;
    if (busy !== null || !target) return;
    restoreFocus.current = null;
    if (target.isConnected && document.activeElement === document.body) target.focus();
  }, [busy]);

  const status = (
    <span role="status">
      {step.moment ? MOMENT_LABEL[step.moment] : state.scene.label} · {hhmm(state.clocks.narrativeNow)}<span className="sr-only"> (hora de la historia)</span>
      {" · "}{state.channelOpen ? "Canal abierto" : "Canal cerrado"}
      {view.preparation === "pending" ? " · Preparando la demostración" : null}
    </span>
  );

  return (
    <SurfaceShell title="Control" lead={status}>
      {/* «En vivo» no le sirve al presentador: solo se muestra la carga y la pérdida de conexión. */}
      {live.status !== "live" ? <Conexion view={live} /> : null}
      {/* La región existe antes del aviso: así los lectores de pantalla anuncian su contenido nuevo. */}
      <div data-testid="control-avisos" aria-live="polite" aria-atomic="true" className="empty:hidden">
        {armed ? <p className="text-body font-semibold">Pulsa R otra vez para pedir el reinicio.</p> : null}
        {notice?.tone === "ok" ? <p className="text-body font-semibold">{notice.text}</p> : null}
      </div>
      {notice?.tone === "error" ? <ErrorMessage title="No se completó"><p>{notice.text}</p></ErrorMessage> : null}
      {notice?.relogin ? (
        <OperatorLogin role="control" onSuccess={() => setNotice({ tone: "ok", text: "Ingresaste de nuevo. Vuelve a pulsar la acción." })} />
      ) : null}

      <section aria-labelledby="guion" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="guion" className="text-section font-semibold">Siguiente paso</h2>
        {next ? (
          <>
            <p className="text-body">
              {step.opensChannel
                ? `Pasa la historia a las ${hhmm(next.narrativeAt)} y abre el canal. Si alguien ya aceptó el relevo, su cobertura empieza a esa hora.`
                : `Pasa la historia a las ${hhmm(next.narrativeAt)}. En /rodrigo aparece el resumen de la noche.`}
            </p>
            <Button variant="primary" loading={busy?.startsWith(`scene:${next.id}:`)} loadingLabel="Cambiando…"
              disabled={working} onClick={act.next_step}>{stepLabel}</Button>
          </>
        ) : (
          <p className="text-body">
            {step.moment === "morning" ? "Terminó el guion. Para repetirlo, reinicia la demostración." : "Esta escena no es parte del guion. Reinicia la demostración."}
          </p>
        )}
        <Button loading={busy === `scene:${state.scene.id}:${!state.channelOpen}`} loadingLabel="Cambiando canal…"
          disabled={working} onClick={act.toggle_channel}>
          {state.channelOpen ? "Cerrar canal" : "Abrir canal"}
        </Button>
      </section>

      <section aria-labelledby="qr" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="qr" className="text-section font-semibold">QR en el proyector</h2>
        <QrStatus open={state.channelOpen} shown={qrShown} qrLeft={qrLeft} lobbyLeft={lobbyLeft} />
        {state.channelOpen ? (
          <div className="flex flex-wrap gap-3">
            {qrShown ? (
              <Button loading={busy === "qr:extend"} loadingLabel="Sumando…" disabled={working || qrAtCap} onClick={() => changeQr("extend")}>Sumar 30 s al QR</Button>
            ) : qrLeft === 0 ? (
              <Button loading={busy === "qr:show"} loadingLabel="Mostrando…" disabled={working} onClick={() => changeQr("show")}>Mostrar QR otra vez</Button>
            ) : null}
          </div>
        ) : null}
        {qrShown && qrAtCap ? <p className="text-aux text-muted-foreground">El QR ya tiene casi 2 min por delante. Podrás sumar más cuando baje de 90 s.</p> : null}
      </section>

      <section aria-labelledby="reportes" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="reportes" className="text-section font-semibold">Reportes guionados</h2>
        {!state.channelOpen ? <p className="text-aux text-muted-foreground">El canal está cerrado. Ábrelo para enviar reportes guionados.</p> : null}
        <div className="flex flex-wrap gap-3">
          {SCRIPTED_REPORTS.map(r => (
            <Button key={r.id} disabled={working || !state.channelOpen} onClick={() => sendReport(r)}>{r.label}</Button>
          ))}
        </div>
      </section>

      <section aria-labelledby="tomas" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="tomas" className="text-section font-semibold">Tomás</h2>
        {takeable ? (
          <Status kind="pending">Incidente esperando acuse de Tomás</Status>
        ) : (
          <p className="text-body">No hay un incidente esperando a Tomás.</p>
        )}
        <Button variant="primary" disabled={working || !takeable} onClick={takeAsTomas}>Tomar incidente como Tomás</Button>
      </section>

      <section aria-labelledby="registro" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="registro" className="text-section font-semibold">Registro reciente</h2>
        <EventLog entries={entries} />
      </section>

      <section aria-labelledby="reinicio" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="reinicio" className="text-section font-semibold">Reiniciar demostración</h2>
        <p className="text-aux text-muted-foreground">Crea una ejecución nueva con el canal cerrado. Atajo: R R y confirmar.</p>
        <Button id="reiniciar" variant="danger" disabled={working} onClick={() => setResetOpen(true)}>Reiniciar demostración</Button>
        {resetOpen ? (
          <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="reinicio-titulo" className="flex flex-col gap-3 border-2 border-danger p-4"
            onKeyDown={e => {
              if (e.key === "Escape") { closeReset(); return; }
              if (e.key !== "Tab") return;
              const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
              const first = items[0], last = items[items.length - 1];
              if (!first || !last) return;
              if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
              else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }}>
            <h3 id="reinicio-titulo" className="text-body font-semibold">¿Reiniciar la demostración?</h3>
            <p className="text-body">Se pierde el avance de esta ejecución. Las respuestas pendientes y los enlaces anteriores dejan de valer.</p>
            <div className="flex flex-wrap gap-3">
              <Button variant="danger" loading={busy === "reset"} loadingLabel="Reiniciando…" onClick={reset}>Reiniciar ahora</Button>
              <Button disabled={busy === "reset"} onClick={closeReset}>Cancelar</Button>
            </div>
          </div>
        ) : null}
      </section>
      <SignOutButton />
    </SurfaceShell>
  );
}

const seconds = (ms: number | null) => (ms === null ? null : Math.ceil(ms / 1000));

/** Estado del QR con su cuenta. Sin región viva: el lector no anuncia cada segundo. */
function QrStatus({ open, shown, qrLeft, lobbyLeft }: { open: boolean; shown: boolean; qrLeft: number | null; lobbyLeft: number | null }) {
  if (!open) return <p className="text-body">El canal está cerrado. El QR aparece al abrirlo.</p>;
  const qr = seconds(qrLeft), lobby = seconds(lobbyLeft);
  const sending = lobby === null ? "" : lobby > 0 ? ` Los teléfonos pueden enviar en ${lobby} s.` : " Los teléfonos ya pueden enviar.";
  if (shown) return <p className="text-body font-semibold">{qr === null ? "QR en pantalla." : `QR en pantalla: quedan ${qr} s.`}{sending}</p>;
  if (qr !== 0) return <p className="text-body">El QR cedió al panel por un incidente.{sending}</p>;
  return <p className="text-body">El QR no está en pantalla.{sending} Si alguien no alcanzó a entrar, muéstralo otra vez.</p>;
}
