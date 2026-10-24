/**
 * Una sola evaluación de `GET /api/state` en curso por instancia, reutilizada hasta `maxAgeMs` desde que empezó.
 * Con 15–40 teléfonos consultando, evita que cada petición tome el candado global de la base (C07). Un resultado
 * no reutilizable (fallo) solo se comparte con quienes ya esperaban; una invalidación nunca recibe una evaluación
 * empezada antes que ella. Sin dependencias de servidor: se prueba como unidad.
 */
export interface SharedStateOptions<T> {
  readonly maxAgeMs: number;
  readonly now: () => number;
  /** Cambia con cada mutación de esta instancia. */
  readonly generation: () => number;
  readonly reusable: (value: T) => boolean;
}

export function createSharedState<T>(load: () => Promise<T>, options: SharedStateOptions<T>) {
  let current: { promise: Promise<T>; startedAt: number; generation: number; reusable: boolean } | null = null;
  return {
    get(): Promise<T> {
      const now = options.now(), generation = options.generation();
      if (current && current.generation === generation && current.reusable && now - current.startedAt < options.maxAgeMs) {
        return current.promise;
      }
      const entry = { promise: load(), startedAt: now, generation, reusable: true };
      current = entry;
      entry.promise.then(
        value => { if (!options.reusable(value)) entry.reusable = false; },
        () => { entry.reusable = false; },
      );
      return entry.promise;
    },
  };
}

// En globalThis, como el pool de db.ts: cada ruta puede cargar su propia copia del módulo en el mismo proceso.
// Entre instancias de Vercel no se comparte; ahí rige solo el máximo de 1 s.
const counter = globalThis as unknown as { relevoStateMutations?: number };
/** Lo llaman las rutas que escriben: la próxima consulta de estado de esta instancia vuelve a evaluar. */
export function invalidatePublicState(): void { counter.relevoStateMutations = (counter.relevoStateMutations ?? 0) + 1; }
export const publicStateGeneration = (): number => counter.relevoStateMutations ?? 0;

/** Envuelve una ruta que escribe: al terminar, con éxito o no, invalida el estado compartido de esta instancia. */
export async function invalidating(work: () => Promise<Response>): Promise<Response> {
  try { return await work(); } finally { invalidatePublicState(); }
}
