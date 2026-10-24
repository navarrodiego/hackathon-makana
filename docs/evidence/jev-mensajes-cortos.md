# Jev con mensajes cortos del público

Fecha: 24-10-2026. Rama `claude/jev-demo-categorization-b9f7fb`, base `7eeea86`, sin commit propio. Decisiones de Diego del mismo día: ruta «fuera de TI» solo con alta seguridad, recibo con la clasificación de la IA y suficiencia sin alcance explícito (alcance acotado por defecto).

## Qué cambió

- `prompts.ts` (configuración `relevo-t02-hybrid-deepseek-1017-v2`):
  - contexto fijo de la empresa en `state.company`
  - vocabulario local en los criterios
  - suficiencia = servicio + condición
  - alcance acotado por defecto
  - preguntas nuevas `topic` y `physicalEmergency`
- `validation.ts`: valida los campos nuevos; `noTiProbability` sale de las probabilidades de `topic`, no de su confianza.
- Política: ruta `out_of_scope` (C05), sin incidente ni aviso.
- Recibo: `classified`, `physicalEmergency` y su texto (LANGUAGE).

## Medición en vivo

Script: `scripts/eval/classify-corpus.ts` (doble opt-in, solo etiquetas, ruta y latencia). Corpus: `tests/fixtures/classification/live-corpus.ts`, con mensajes ficticios. Modelos:
- clasificación: `typesafe/jev-1.14`
- evidencia: `deepseek/deepseek-v4.1-flash-1017`

Cada caso se corrió 2 veces. La ráfaga son 20 llamadas concurrentes.

| Corrida | Ruta exacta | Ruta aceptable | Servicio | Emergencias detectadas | Falsos positivos de emergencia | TI enviado a fuera de TI | Fallas proveedor | p50 / p95 |
|---|---|---|---|---|---|---|---|---|
| Base v1, corpus de ajuste (54 casos) | 44/108 (41 %) | 76/108 | 105/108 | n/a | n/a | n/a | 1 timeout | 746 / 1829 ms |
| v2, corpus de ajuste | 106/108 (98 %) | 108/108 | 108/108 | 10/10 | 0 | 0 | 0 | 673 / 1419 ms |
| v2, set de control no usado para ajustar (22 casos) | 42/44 (95 %) | 42/44 | 44/44 | 4/4 | 0 | 0 | 0 | 742 / 1468 ms |
| Ráfaga v2 (20 concurrentes) | — | — | — | — | — | — | 0/20 | p95 1614 ms |

Base v1: Jev acertaba el servicio, pero marcaba como `sufficientInformation=false` casi todo mensaje sin alcance explícito («se cayó el internet», «no pasa la tarjeta», «olvidé mi clave»). Todo terminaba en modo degradado, revisión y aviso a la guardia. Los mensajes ajenos a TI también iban a revisión.

En una iteración intermedia de v2 aparecieron dos problemas:
- «hola» no alcanzaba el umbral 0,85
- «Rodrigo te queremos, descansa» se marcaba como emergencia

Se ajustaron los criterios de saludo y de emergencia explícita antes de la corrida v2 de la tabla.

Fallos que quedan:
- K14 «internet anda lentísimo en el local» → cola. Es aceptable: es una degradación con pc 0,08.
- H05 «caja 1 pegada, no puedo vender» → revisión: Jev lo leyó como degradación (pc 0,61). Es la ruta conservadora, con aviso a la guardia. No se ajustó, para no contaminar el set de control.

Límites:
- El corpus es propio y lo escribió el mismo agente que ajustó los prompts. No es una evaluación independiente ni mide el texto real del público.
- No se midió costo por llamada; T18 registró < USD 0,001 por clasificación.

## Verificación

| Comando | Resultado |
|---|---|
| `pnpm lint` | PASS |
| `pnpm db:generate && pnpm typecheck` | PASS |
| `node --import tsx --test tests/unit/*.test.ts` | PASS 76 (incluye `receipt-text.test.ts` nuevo) |
| `node --conditions=react-server --import tsx --test tests/classification/*.test.ts tests/providers/openrouter/*.test.ts` | PASS 103, 1 SKIP (vivo, doble opt-in) |
| Suites DB: db, messages, execution, incidents, handoff, handoff-note, security | PASS 229 |
| `tests/notifications/db.test.ts` | BLOCKED, igual que en T18: exige la base privada de T08 |
| `pnpm build` | PASS |
| E2E (`playwright test --workers=1`, sin clave IA, `APP_ORIGIN` de pruebas y contraseña de operador local descartable) | PASS 92/92. Con el paralelismo por defecto fallan 21 por pruebas que comparten la misma base y la reinician; no se tocó la configuración |
| Navegador, 375×812, servidor de producción local con Jev real | «se cayó el internet» → incidente, «Clasificación IA: red de locales, no funciona, un local o equipo.». «me caí fuerte» → fuera de TI con orientación 131/132/133, sin incidente. «ayuda tengo una urgencia» y «despierten a Rodrigo» → revisión (degradado). |

Bug encontrado y corregido en el recorrido renderizado: el recibo fuera de TI mostraba además la línea de modo degradado («Lo revisa la guardia…»), que contradice el estado. Se reprodujo con una prueba unitaria (RED) y se corrigió (GREEN).

`live.test.ts` ampliado (doble opt-in, 7 reportes y la nota): PASS.

No ejecutado:
- `pnpm test:e2e:flujos` con IA real
- despliegue o Neon
