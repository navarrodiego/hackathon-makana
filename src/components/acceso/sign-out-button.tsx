"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Cierra las sesiones de operador de este navegador (Rodrigo y control) y vuelve al ingreso. No cambia la demostración. */
export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setBusy(true); setFailed(false);
    try {
      const response = await fetch("/api/acceso/salir", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", cache: "no-store",
      });
      if (!response.ok) throw new Error(String(response.status));
      router.refresh();
    } catch {
      setFailed(true);
    }
    setBusy(false);
  }

  return (
    <div className="border-t border-line pt-6">
      <Button onClick={signOut} loading={busy} loadingLabel="Cerrando sesión…">Cerrar sesión</Button>
      {failed ? <p role="alert" className="mt-2 text-aux text-danger">No se pudo cerrar la sesión. Revisa la conexión y vuelve a intentarlo.</p> : null}
    </div>
  );
}
