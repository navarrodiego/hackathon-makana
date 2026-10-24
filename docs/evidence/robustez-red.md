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

## Prueba de carga contra producción · 24-10-2026
Base `f7f2798` desplegada en `relevo-dun.vercel.app` (funciones `iad1`, Neon `us-east-1`, `/api/state` con gzip). Autorizada por Diego: producción completa, con OpenRouter real. Carga desde un solo equipo y red. `pnpm load:canal -- --remote --production`, que ahora respeta la espera común de 30 s, simula el proyector (1 consulta/s) y admite `--burst` y `--reset-after`.

| Corrida | Proyector p50 / p95 | `/api/state` teléfonos p50 / p95 | Envío p50 / p95 | Envíos aceptados | Errores |
|---|---|---|---|---|---|
| 40 teléfonos, 2 reportes, 90 s | 281 ms / 10,1 s | 411 ms / 11,6 s | 1,6 s / 15,8 s | 57 de 80 | 22 `AUTH_REQUIRED`, 1 `STORAGE_UNAVAILABLE` |
| 50 teléfonos, 3 reportes, ráfaga al terminar la espera, 120 s | 326 ms / 20,8 s | 4,8 s / 26,9 s | 6,3 s / 22,0 s | 59 de 150 | 54 `AUTH_REQUIRED`, 123 `STORAGE_UNAVAILABLE` (82 en estado, 4 en proyector, 37 en envío) |

- El proyector completó solo 56 consultas en 90 s y 28 en 120 s, con máximos de 17,7 s y 23,2 s. Supera su plazo de 8 s, así que la sala vería «Sin conexión» y los plazos no avanzarían.
- En la ráfaga quedaron 73 reportes guardados, pero solo 59 recibieron 201: 14 se admitieron después de que el teléfono ya había visto un error. Clasificación: 67 por modelo y 6 degradados. Ninguno quedó en `processing`.
- `AUTH_REQUIRED`: con la base saturada, `channelEntry` en `src/proxy.ts` captura el fallo de `sessions.enter` y entrega `/canal` sin cookie. Ese teléfono no puede enviar. Un navegador real podría recuperar la sesión en la relectura siguiente; el script conserva la cookie inicial, así que esta cifra puede estar exagerada, pero el fallo silencioso es real.
- Después de la última corrida se reinició la ejecución: escena Cierre, canal cerrado, 0 incidentes y relevo en borrador.

**Resultado: A09 no pasa en producción con 40 ni con 50 teléfonos.** Con los criterios de DEMO, el canal se abre solo al jurado mientras no cambie esto. Causa probable, sin medir: el candado global (`executionLock`, `pg_advisory_xact_lock`) serializa cada escritura y cada evaluación de vencimientos, y cada vuelta a Neon cuesta milisegundos de red en vez de microsegundos.

## Diagnóstico del cuello de botella · 24-10-2026
Medición local con un proxy TCP entre la app y PostgreSQL, que cuenta las idas y vueltas a la base y agrega latencia. Sin cambios de código en la app.

| Petición | Idas y vueltas a la base |
|---|---|
| `GET /canal` con sesión nueva | 19 |
| `GET /api/state` con 0 / 10 / 50 / 100 / 145 reportes | 47 / 125 / 147 / 247 / 337 |
| `POST /api/messages` | 61–73 |

- Casi todas ocurren dentro de transacciones que toman el candado global (`executionLock`), incluidas las de solo lectura (`publicState`, `ownReports`) y la creación de sesión. Cada consulta de estado abre además tres transacciones con candado para revisar vencimientos aunque no haya ninguno.
- Cada reporte cuesta dos consultas más al armar el estado: su clasificación y su decisión se leen una por una (`hydrate` en `repositories/index.ts`).
- Con unos 3 ms simulados por ida y vuelta (Neon desde `iad1` estaría entre 1 y 3 ms; la estimación con producción en reposo es imprecisa), 40 teléfonos en local reproducen el colapso de producción: proyector p95 14,1 s, envío p95 17,3 s, 69 `STORAGE_UNAVAILABLE`. Sin latencia, el mismo escenario daba p95 de 106 ms.
- Conclusión: el problema no es la capacidad de Neon. Cientos de idas y vueltas por segundo se hacen en fila detrás de un solo candado; con latencia de red, el candado se ocupa más tiempo del que pasa entre consultas.

## Arreglos 1–4 y nueva medición local · 24-10-2026
Cambios sin desplegar: lecturas y evaluaciones sin nada vencido en una foto de solo lectura sin el candado (`runReadFirst`), clasificaciones y decisiones en dos consultas por lista, y la sesión del canal con un insert suelto. Tests nuevos: `tests/db/read-first.test.ts` (7) y `tests/execution/lock-free.test.ts` (4), escritos antes del código y vistos fallar.

Corrección al diagnóstico anterior: sin sesión, `/canal` sí muestra «No se pudo abrir tu sesión del canal». No es una falla silenciosa para una persona; el script no renderiza la página.

Medición local con unos 3 ms simulados por ida y vuelta (proxy), pool de 3 conexiones como en producción:

| Escenario | Proyector p95 | `/api/state` p95 | Envío p95 | Errores |
|---|---|---|---|---|
| 40 teléfonos, 2 reportes, antes | 14,1 s | 16,7 s | 17,3 s | 69 `STORAGE_UNAVAILABLE` |
| 40 teléfonos, 2 reportes, después | 0,8 s | 1,9 s | 3,9 s | 0 |
| 50 teléfonos, 1 reporte, ráfaga, después | 1,9 s | 7,8 s | 12,1 s | 42 `STORAGE_UNAVAILABLE` |
| 50 teléfonos, 2 reportes, ráfaga, después | 11,6 s | 14,6 s | 13,7 s | 42 `STORAGE_UNAVAILABLE` |
| 50 teléfonos, 3 reportes, ráfaga, después | 9,3 s | 19,5 s | 16,7 s | 119 `STORAGE_UNAVAILABLE` |

- La ráfaga sigue colapsando: cada envío toma el candado en tres transacciones (admitir, guardar clasificación, drenar la cola) y 50 envíos simultáneos forman una fila de más de 10 s. Con un pool de 10 conexiones (experimento revertido) tampoco alcanza. El siguiente arreglo sería acortar el envío; no está implementado.
- Decisión de Diego (24-10-2026): en la demo solo el jurado escanea el QR.
