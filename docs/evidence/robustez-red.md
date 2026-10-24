# Evidencia · Robustez ante red mala y 15–40 personas en el canal

Base: `d7ff9c1`, rama `claude/app-robustness-poor-connection-b19111`. 24-10-2026. Base local propia del worktree y servidor local (`pnpm build && pnpm start`). Sin commit, deploy ni cambios en Neon o Vercel.

## Decisiones de Diego (24-10-2026)
Timeout IA de 6 s configurable. Estado compartido hasta 1 s por instancia. Rescate degradado de reportes trabados. Cuota global de 150. Abrir el canal al público o solo al jurado se decide después de la prueba de carga contra el entorno real.

## Cambios
| Problema | Cambio |
|---|---|
| La IA se degradaba a menudo con 2,5 s para dos llamadas en paralelo | `CLASSIFICATION_TIMEOUT_MS`, 6 s por defecto, acotado a 1–10 s |
| Cada sondeo tomaba el candado global de la base | Una evaluación en curso por instancia, reutilizada hasta 1 s; las rutas que escriben la invalidan |
| Un ntfy lento retrasaba hasta 5 s la consulta de estado | El despacho de avisos corre con `after()` |
| Un reporte sin clasificación guardada trababa la cola hasta un reset | Reintento con la misma clave reclasifica pasados 10 s; cada consulta guarda como degradado lo trabado > 30 s |
| Con 40 personas la cuota de 50 se llenaba | 150 en `LIMITS` y migración del CHECK |
| Peticiones sin plazo: una red colgada se veía «En vivo» | Plazos de 8 s (estado), 15 s (envío del canal y receptor) y 25 s (control y cierre) |
| El canal no mostraba la pérdida de conexión | Aviso «Sin conexión desde las…», con el texto conservado |
| El borrador se perdía al recargar | `sessionStorage` por pestaña, con la clave de reintento |
| Al volver la red, todos los teléfonos consultaban a la vez | En el canal: tope de 15 s tras fallos y ritmo ±20 % |
| Cada reporte ajeno rehacía `/canal` en todos los teléfonos | El canal se rehace solo por ejecución, apertura o estado de avisos |
| `/api/state` pesaba 85–330 KB sin comprimir | gzip cuando el cliente lo acepta (85 230 → 11 730 B con 40 reportes) |

## Pruebas ejecutadas
- `pnpm lint`, `pnpm typecheck`: sin errores.
- `pnpm test:unit` (68), `pnpm test:db` (17), `pnpm test:execution` (46), `tests/messages` (24), proveedor OpenRouter sin la prueba live (58): todas aprobadas.
- `tests/e2e/canal-conexion.spec.ts` y `tests/e2e/canal.spec.ts` en escritorio y móvil: 10 aprobadas.
- No se midió la latencia real de OpenRouter: este `.env` no tiene `OPENROUTER_API_KEY`. Pendiente con `tests/providers/openrouter/live.test.ts` antes de fijar el valor definitivo del timeout.

## Prueba de carga (`pnpm load:canal`, servidor y PostgreSQL locales)
Cada teléfono simulado tiene sesión propia, consulta `/api/state` cada 4 s ±20 %, rehace `/canal` cada 15 s y envía reportes en momentos al azar. Sin clave de IA, la clasificación cae al instante en modo degradado: mide la base y el servidor, no la IA.

| Teléfonos | Reportes c/u | Duración | `/api/state` p50 / p95 | Envío p50 / p95 | Errores |
|---|---|---|---|---|---|
| 20 | 2 | 90 s | 6 / 85 ms | 164 / 234 ms | 0 |
| 40 | 2 | 90 s | 5 / 106 ms | 210 / 554 ms | 0 |
| 60 | 2 | 90 s | 6 / 1 540 ms | 375 / 2 981 ms | 0 |
| 40 | 3 | 45 s (estrés) | 45 / 3 025 ms | 419 / 3 257 ms | 0 |
| 60 | 3 | 45 s (estrés) | 615 / 12 342 ms | 2 909 / 11 216 ms | 10 `STORAGE_UNAVAILABLE`, 21 cuota llena |

Primera medición de esta rama, ya con estado compartido pero sin gzip: el estrés con 40 teléfonos daba p95 de 4 869 ms en `/api/state`, y con 60 hubo 25 `STORAGE_UNAVAILABLE` y 40 reportes en procesamiento 2 s después de terminar (antes del rescate de 30 s). No hay medición previa a todos los cambios.

## Límites
- PostgreSQL local responde en microsegundos. Neon agrega latencia de red a cada consulta dentro del candado, así que los números reales serán peores. Falta repetir la carga contra un preview de Vercel con una rama de Neon que no sea la de la demo; requiere autorización.
- El candado global de escritura sigue siendo el límite: ráfagas de más de unos 2 envíos por segundo durante decenas de segundos degradan la respuesta.
- Entre instancias de Vercel la invalidación no se comparte: ahí un cambio puede tardar hasta 1 s más en verse.
- No se comprobó si Vercel comprime por su cuenta. Con `content-encoding: gzip` propio, la respuesta pasa tal cual.
- No se probó en un teléfono real ni con lector de pantalla.
