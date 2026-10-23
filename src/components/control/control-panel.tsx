"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ControlViewDTO } from "@/lib/contracts/private";
import { EventLog } from "@/components/relevo/event-log";
import { SurfaceShell } from "@/components/relevo/surface-shell";
import { Button } from "@/components/ui/button";
import { DegradedNotice, ErrorMessage } from "@/components/ui/feedback";
import { Status } from "@/components/ui/status";
import { failureMessage, postJson, touchState } from "./api";
import {
  SCRIPTED_REPORTS, adjacentScene, buildReportRequest, buildResetRequest, buildSceneRequest, buildTakeRequest,
  clockLabel, eventText, resolveShortcut, takeableIncident, type ScriptedReport, type ShortcutState,
} from "./logic";

const REFRESH_MS = 2000;
const newKey = () => `control-${crypto.randomUUID()}`;
type Notice = { readonly tone: "ok" | "error"; readonly text: string } | null;

/**
 * Operación protegida. Todo cambio pasa por las APIs comunes con origen escenario; la vista se rehace desde el
 * servidor. No hay estado visual propio de cobertura ni reloj de plazos en el cliente.
 */
export function ControlPanel({ view }: { view: ControlViewDTO }) {
  const router = useRouter();
  const { state } = view;
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [qr, setQr] = useState(false);
  const [reportIndex, setReportIndex] = useState(0);
  // Una clave por intención hasta que termine bien: un reintento tras un corte no duplica la operación.
  const keys = useRef(new Map<string, string>());
  const shortcut = useRef<ShortcutState>({ armedAt: null, resetOpen: false });
  const busyRef = useRef<string | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  // Estado en refs para que el oyente de teclado sea uno solo y se limpie al desmontar.
  const latest = useRef<Record<string, () => void>>({});

  useEffect(() => {
    let controller: AbortController | null = null;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      controller?.abort();
      controller = new AbortController();
      await touchState(controller.signal);
      router.refresh();
    };
    const id = window.setInterval(tick, REFRESH_MS);
    return () => { window.clearInterval(id); controller?.abort(); };
  }, [router]);

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
      setNotice({ tone: "ok", text: `${label} Registrado con origen escenario.` });
    } else {
      // Un rechazo definitivo del servidor no se reintenta con la misma clave; un corte sí.
      if (result.code !== "NETWORK" && result.code !== "OPERATION_PENDING") keys.current.delete(intent);
      setNotice({ tone: "error", text: failureMessage(result.code ?? "UNKNOWN") });
    }
    busyRef.current = null;
    restoreFocus.current = origin;
    setBusy(null);
    router.refresh();
  }, [router]);

  const changeScene = (sceneId: string, channelOpen: boolean, label: string) =>
    run(`scene:${sceneId}:${channelOpen}`, label, key =>
      postJson("/api/scene", buildSceneRequest(state, sceneId as never, channelOpen, key)));

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

  const tomas = view.representedActors.find(a => a.displayName === "Tomás");
  const scenes = view.sceneOptions;
  const next = adjacentScene(scenes, state.scene.id, 1);
  const previous = adjacentScene(scenes, state.scene.id, -1);
  const takeable = tomas ? takeableIncident(state.incidents, tomas.id) : null;

  const act: Record<string, () => void> = {
    next_scene: () => { if (next) void changeScene(next.id, state.channelOpen, `Escena «${next.label}».`); },
    previous_scene: () => { if (previous) void changeScene(previous.id, state.channelOpen, `Escena «${previous.label}».`); },
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
    toggle_qr: () => setQr(v => !v),
    mute: () => setNotice({ tone: "error", text: "Audio de presentación no disponible: esta demostración no usa audio." }),
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

  return (
    <SurfaceShell title="Control">
      <p className="max-w-prose text-body">
        Escena actual: <strong>{state.scene.label}</strong> · {clockLabel(state.clocks.narrativeNow)} (hora narrativa). Cambiar de escena no acepta, no acusa ni adelanta plazos.
      </p>
      <p role="status" className="text-aux text-muted-foreground">
        {state.channelOpen ? "Canal abierto" : "Canal cerrado"}
        {view.preparation === "pending" ? " · Nota de relevo en preparación" : view.preparation === "failed" ? " · La nota de relevo no se generó" : " · Nota de relevo guardada"}
      </p>
      {/* La región existe antes del aviso: así los lectores de pantalla anuncian su contenido nuevo. */}
      <div data-testid="control-avisos" aria-live="polite" aria-atomic="true" className="empty:hidden">
        {armed ? <p className="text-body font-semibold">Pulsa R otra vez para pedir el reinicio.</p> : null}
        {notice?.tone === "ok" ? <p className="text-body font-semibold">{notice.text}</p> : null}
      </div>
      {notice?.tone === "error" ? <ErrorMessage title="No se completó"><p>{notice.text}</p></ErrorMessage> : null}

      <section aria-labelledby="escenas" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="escenas" className="text-section font-semibold">Escenas</h2>
        <div className="flex flex-wrap gap-3">
          {scenes.map(s => (
            <Button key={s.id} aria-pressed={s.id === state.scene.id} disabled={working || s.id === state.scene.id}
              onClick={() => changeScene(s.id, state.channelOpen, `Escena «${s.label}».`)}>{s.label}</Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button disabled={working || !previous} onClick={act.previous_scene}>Escena anterior</Button>
          <Button variant="primary" disabled={working || !next} onClick={act.next_scene}>Escena siguiente</Button>
        </div>
        <Button loading={busy?.startsWith("scene:") && !busy.startsWith("scene:" + state.scene.id)} loadingLabel="Cambiando canal…"
          disabled={working} onClick={act.toggle_channel}>
          {state.channelOpen ? "Cerrar canal" : "Abrir canal"}
        </Button>
      </section>

      <section aria-labelledby="reportes" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="reportes" className="text-section font-semibold">Reportes guionados</h2>
        <p className="text-aux text-muted-foreground">Entran por el mismo canal, con origen escenario. Una orden no cambia la elegibilidad.</p>
        {!state.channelOpen ? <DegradedNotice title="El canal está cerrado"><p>Ábrelo para enviar reportes guionados.</p></DegradedNotice> : null}
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
        <p className="text-aux text-muted-foreground">Se registra con origen escenario. Tomar el incidente no lo da por resuelto.</p>
      </section>

      <section aria-labelledby="qr" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="qr" className="text-section font-semibold">Código QR</h2>
        <Button aria-pressed={qr} onClick={act.toggle_qr}>{qr ? "Ocultar QR" : "Mostrar QR"}</Button>
        {qr ? <p role="status" className="text-body">El QR del proyector apunta a <code>/canal</code>. Este control solo indica su visibilidad; el dibujo lo entrega la pantalla de proyección.</p> : null}
      </section>

      <section aria-labelledby="registro" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="registro" className="text-section font-semibold">Registro reciente</h2>
        <EventLog entries={entries} />
      </section>

      <section aria-labelledby="reinicio" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="reinicio" className="text-section font-semibold">Reiniciar demostración</h2>
        <p className="text-aux text-muted-foreground">Crea una ejecución nueva con el canal cerrado. Se descarta lo pendiente de la anterior. Atajo: R R y confirmar.</p>
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
    </SurfaceShell>
  );
}
