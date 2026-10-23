"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { loginErrorMessage, type OperatorRole, type OriginDetail } from "./messages";

const LABEL: Record<OperatorRole, string> = { outgoing: "Ingresar al cierre de turno", control: "Ingresar a control" };

export interface OperatorLoginProps {
  role: OperatorRole;
  /** Tras ingresar. Por omisión recarga la página; dentro de una acción fallida, conserva lo escrito. */
  onSuccess?: () => void;
  /** Error de un ingreso anterior sin JavaScript (la página lo recibe en `?acceso=`). */
  initialError?: string;
}

/**
 * Ingreso con la contraseña de operador. El rol lo fija la página; el error dice si falló la contraseña o el servidor.
 * Sin JavaScript el formulario hace POST a /api/acceso y vuelve a la página: la contraseña nunca va en la URL.
 */
export function OperatorLogin({ role, onSuccess, initialError }: OperatorLoginProps) {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!secret.trim()) { setError("Escribe la contraseña de operador."); return; }
    setBusy(true); setError(null);
    let code = "UNKNOWN", origin: OriginDetail | undefined;
    try {
      const response = await fetch("/api/acceso", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, secret }), cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: { code?: string }; origin?: OriginDetail } | null;
      if (body?.ok) {
        setSecret("");
        setBusy(false);
        if (onSuccess) onSuccess(); else router.refresh();
        return;
      }
      code = body?.error?.code ?? "UNKNOWN"; origin = body?.origin;
    } catch {
      code = "NETWORK";
    }
    setBusy(false);
    setError(loginErrorMessage(code, role, origin));
  }

  return (
    <form method="post" action="/api/acceso" onSubmit={submit} noValidate className="flex max-w-md flex-col gap-4">
      <input type="hidden" name="role" value={role} />
      {/* Usuario fijo y oculto: el gestor de contraseñas guarda la contraseña asociada a Relevo. */}
      <input type="text" name="username" autoComplete="username" value="operador-relevo" readOnly hidden />
      <TextField label="Contraseña de operador" type={visible ? "text" : "password"} name="secret"
        autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false}
        value={secret} onChange={e => setSecret(e.target.value)} error={error ?? undefined} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" loading={busy} loadingLabel="Ingresando…">{LABEL[role]}</Button>
        <Button aria-pressed={visible} onClick={() => setVisible(v => !v)}>Mostrar contraseña</Button>
      </div>
    </form>
  );
}
