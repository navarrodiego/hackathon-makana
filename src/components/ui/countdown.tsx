"use client";

import { useEffect, useState } from "react";

export interface CountdownProps {
  /** Instante límite, ISO 8601. El plazo real lo decide el servidor; aquí solo se muestra. */
  deadlineAt: string;
  /** Texto para lector de pantalla, p. ej. «Plazo de aceptación hasta las 22:10». No cambia cada segundo. */
  label: string;
  className?: string;
}

function format(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const two = (n: number) => String(n).padStart(2, "0");
  return s >= 3600 ? `${Math.floor(s / 3600)}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}` : `${two(Math.floor(s / 60))}:${two(s % 60)}`;
}

/** Contador visual aria-hidden con texto accesible estático. Limpia el intervalo al desmontar. */
export function Countdown({ deadlineAt, label, className }: CountdownProps) {
  const deadline = Date.parse(deadlineAt);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className={className}>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true">{now === null ? "--:--" : format(deadline - now)}</span>
    </span>
  );
}
