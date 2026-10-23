# Contratos de Relevo

Fuente técnica del paquete. Describe comportamiento aprobado, no implementación comprobada. PRODUCT define propósito/alcance; LANGUAGE define texto humano. T01 congela los DTO e interfaces en `src/lib/contracts/`; C10–C15 fijan sus decisiones exactas. Esto no acredita motores, endpoints, seguridad ejecutable ni persistencia. Las migraciones siguen siendo responsabilidad de T03.

## C01 · Persistencia y entornos

- Next.js App Router en Vercel. Desarrollo con un servidor PostgreSQL local (Postgres.app o un único contenedor); una base por worktree y otra de integración. Neon aloja la base compartida de la demo pública. No instalar un stack Supabase ni usar sus SDK/Auth/Storage/Realtime.
- Ejemplos de nombres locales: `relevo_ui`, `relevo_backend`, `relevo_escenario`, `relevo_integracion`. No son recursos creados. Conexión privada por entorno mediante `DATABASE_URL`; nunca `NEXT_PUBLIC_`. Cada app local necesita su propio puerto.
- Un origen versionado de migraciones y seed ficticio. WT-B coordina schema; las ramas integran archivos, no datos de otras bases. Probar migraciones desde base limpia e integración con todas las ramas.
- Limitar credenciales a su base; compartir servidor no equivale a aislamiento de seguridad. No exponer Postgres local a internet. Comprobar compatibilidad de versiones/SQL/extensiones con Neon.
- Conexiones solo backend; consultas parametrizadas. Seleccionar driver y estrategia de pool compatibles con local/Neon/Vercel y probar transacciones reales. Decisión de inicialización del 23-10-2026: Prisma ORM 7 con `@prisma/adapter-pg` y `pg`, elegida por familiaridad del equipo. `prisma/schema.prisma` conserva solo datasource/generador, sin modelos de negocio. El cliente es exclusivo del servidor, con pool máximo de 3 conexiones por instancia y timeout de conexión de 5 s. `DIRECT_URL` queda reservada para futuras migraciones; `DATABASE_URL` es la conexión de aplicación. Generar el cliente no aplica migraciones ni prueba transacciones.
- Tests/reset destructivos solo sobre destinos locales de prueba permitidos; rechazar Neon/demo por defecto. Migraciones/seed remotos requieren destino verificado y acción explícita. El reset escénico C09 no destruye schema.
- Push ntfy real desactivado en desarrollo por defecto. Habilitarlo expresamente en ensayo físico/demo con tópico separado. No confundir aislamiento de DB con aislamiento de efectos externos.

## C02 · Actores, ventanas y relojes

Rodrigo saliente; Paula entrante; Tomás respaldo; Carla jefatura. Ventanas/destinatarios en seed, sin editor de turnos. En el escenario principal Rodrigo termina a las 22:10 y no es respaldo elegible. No excluirlo por nombre en el motor: evaluar ventana/rol explícitos.

Registrar por separado envío, aceptación, inicio efectivo de cobertura y fin del saliente. La hora narrativa 22:10/03:00/07:00 no es el reloj de los plazos. Persistir timestamps operacionales; mostrar ambos relojes sin confundirlos. El sistema registra 24/7, no exige disponibilidad 24/7 de una persona.

## C03 · Pendientes, nota y envío

Cinco tickets sintéticos: #481 adjuntos de correo de una persona; #477 impresora administrativa sin tóner; #470 respaldo fallido y próximo intento a las 02:00; #466 VPN lenta de dos personas; #462 cuenta para el lunes. Todos pueden esperar según política del ejemplo salvo #470, que se transfiere para seguimiento sin urgencia inmediata.

La IA propone `puede_esperar` / `transferir`, razón breve y nota de hasta 60 palabras. Rodrigo no clasifica ni escribe razones (decisión de Diego, 23-10-2026): la lista es de solo lectura y solo `transferir` se muestra, como «Para seguimiento» con su razón, a Rodrigo y a quien entra. Sin propuesta guardada se usa la decisión base del ticket. Quien entra recibe todos los pendientes. La nota es un borrador editable y opcional: vacía no bloquea el envío; solo bloquea si pasa de 60 palabras. No inventar compromisos, causas o resolución. Generar y guardar al reiniciar; Regenerar hace llamada real. Si falla, no fingir generación. Cerrar no reavisa un incidente ya avisado, ni publica los tickets como mensajes del canal.

## C04 · Relevo y cobertura

Secuencia conceptual del master: borrador → pendiente_paula → aceptado/programado o pendiente_tomas → aceptado/programado o sin_cobertura. Los nombres con personas describen la escena; no son enums de código congelados ni una excepción de elegibilidad por nombre.

1. Enviar paquete al candidato vigente. Un aviso de relevo, no una alarma por ticket.
2. Aceptar/rechazar exige acción explícita y autorización del candidato actual.
3. Aceptación anticipada programa cobertura desde la ventana; no redirige incidentes antes. Nunca mostrar cobertura activa solo por enviar.
4. Cada candidato tiene 30 s reales desde su solicitud en la demo. Rechazo deriva inmediatamente; silencio deriva al vencer.
5. Paula → Tomás. Si Tomás también falla: Sin cobertura confirmada y aviso a Carla como coordinación. No extender automáticamente a Rodrigo ni implementar que Carla asuma/asigne.
6. Acción tardía del candidato anterior no modifica asignación. Explicar que ya fue derivado.
7. Fin del turno saliente y estado de cobertura son independientes. Sin cobertura, críticos nuevos se registran y elevan a jefatura sin inventar responsable técnico.

Aceptar relevo no toma ni resuelve incidentes. Escalar un incidente tampoco cambia al titular de toda la cobertura.

## C05 · Reportes, clasificación y política

Canal cerrado hasta escena habilitada. Apodo ficticio, texto máximo 280 caracteres y 5 envíos por sesión, aunque cambie el apodo, y 50 por ejecución; filtro básico y reserva atómica según C13. El apodo no es identidad confiable ni protección suficiente ante abuso.

Clasificador: servicio `facturacion`, `red_locales`, `correo`, `vpn`, `impresora`, `cuentas`, `otro`; estado caída/degradación/solicitud; alcance persona/local-equipo/generalizado; manipulación informativa. La salida exacta se valida contra schema. Un texto malicioso no modifica política, elegibilidad ni destinatarios y tampoco borra el incidente real que pueda contener.

Facturación/red son críticos; correo generalizado puede serlo. Impresora no es siempre diferible: puede bloquear cajas/boletas. Desconocido no equivale a seguro para diferir.

`pc` representa probabilidad de caída. Servicio crítico con `pc ≥ 0,70`: avisar; con `0,40 ≤ pc < 0,70`: revisión por guardia. Caída generalizada también avisa. La prioridad se evalúa antes de la ruta diferible; el límite 0,70 pertenece a aviso para evitar solapamiento. Calibrar, no prometer ausencia de falsos negativos.

Diferible: cola para próxima atención definida por política, sin push inmediato. 08:00 es ejemplo. Requiere atención: incidente al destinatario elegible de cobertura efectiva, no a Paula por nombre fijo. Sin cobertura se aplica C04.

Jev previsto `typesafe/jev-1.14`, Decisions API alfa de OpenRouter: verificar disponibilidad y contrato. Si no funciona, chat con salida estructurada y misma política. Objetivo de timeout 2,5 s; timeout/salida inválida/información insuficiente ⇒ modo degradado rotulado y revisión conservadora por guardia elegible, no diferir por ausencia de palabras clave. Sin guardia confirmada: coordinación pendiente, no inventar receptor.

Deduplicar atómicamente incidentes equivalentes del mismo hecho/servicio en ventana de 10 min de la escena. No colapsar hechos distintos solo por servicio. Clave de equivalencia y cálculo narrativo congelados en C13; pruebas deben cubrir ambos lados del límite. Registrar modo y razón de decisión sin exponer secretos.

## C06 · Incidente y acuse

Secuencia conceptual: pendiente_de_acuse → avisado a responsable → tomado; o escalado al respaldo → tomado; o sin_acuse y coordinación avisada. Cada candidato tiene plazo propio de 30 s reales. Tomar incidente detiene escalada, no resuelve el incidente ni cambia cobertura global. Resolución solo por evento explícito si se implementa; no necesaria para terminar el recorrido principal.

Acuse tardío después de derivar no reasigna silenciosamente. Candidato/ejecución/versión/estado deben coincidir. Dos personas no pueden convertirse en responsables del mismo incidente mediante carreras.

## C07 · Concurrencia, plazos y eventos

Toda transición valida ejecución, entidad, versión, estado y destinatario. Cambios atómicos e idempotentes, con constraints/transacciones/actualizaciones condicionadas apropiadas. Verificar acuse frente a vencimiento, doble aceptación, reportes equivalentes y reintentos.

Plazos de relevo e incidente separados y persistidos. El proyector consulta cada segundo; esa petición evalúa vencimientos. Sin lectores activos no se garantiza ejecución puntual. Neon no aporta por sí solo scheduler; un worker autónomo está fuera de alcance. Al volver una petición, evaluar plazos vencidos sin duplicar transiciones.

Registro continuo: envío/aceptación/rechazo/vencimiento/derivación, cobertura, reporte/clasificación/política, intención de aviso, resultado del proveedor, acuse, escalada y resolución solo si ocurrió. Incluir ejecución, actor, entidad, timestamp, origen/canal y resultado observado. No garantizar entrega exactamente una vez por HTTP externo ni confundir aceptación del proveedor, recepción física y acuse.

## C08 · Rutas y permisos

| Ruta | Contrato aprobado |
|---|---|
| `/canal` | QR público; reporte y respuestas propias |
| `/rodrigo` | Cierre, estado y resumen; acciones autorizadas, no control público de roles |
| `/relevo/[id]` | Revisión con token de destinatario limitado |
| `/proyector` | Estado saneado, espejo sin botones privilegiados ni secretos |
| `/control` | Operación protegida; acciones de personajes con origen escenario |
| `POST /api/messages` | Validar, clasificar, decidir y registrar |
| `GET /api/state` | Estado saneado; en demo también evalúa vencimientos al consultar |
| `POST /api/handoff` | Enviar relevo |
| `POST /api/handoff/suggest` | Generar sugerencia IA |
| `POST /api/handoff/[id]/accept` | Aceptar solo candidato vigente |
| `POST /api/handoff/[id]/reject` | Rechazar solo candidato vigente |
| `POST /api/ack/[id]` | Tomar incidente con token limitado o control autorizado |
| `POST /api/scene` | Cambiar escena, sin falsificar eventos |
| `POST /api/reset` | Nueva ejecución de demo, protegido |

No cachear estado operativo que oculte cambios; limpiar polling al desmontar. GET de enlace nunca acepta relevo ni acusa. Excepción explícita: el GET de estado evalúa plazos para la demo; no usarlo para acciones humanas. Evitar que enlaces tokenizados se filtren por vistas públicas, logs o referencias externas. El token de demo no equivale a autenticación empresarial. C12 fija HTTP Basic por rol, sesión pública, tokens y protección de origen/CSRF.

DTO, errores/status, tokens, cuotas e idempotencia están congelados por T01 en C10–C15 y en código. Una tabla o interfaz no demuestra que sus controles estén implementados.

## C09 · Avisos y reset

Paula: tópico ntfy aleatorio secreto, nunca en repo ni estado público. Relevo: enlace a revisión; aceptar/rechazar son POST. Incidente: «P1 · Facturación caída», acción POST «Tomar incidente» a `/api/ack/[id]` con token limitado a ejecución/destinatario/incidente. Probar soporte real de la acción en S26.

Tomás/Carla: representación in-app y canal visible; no fingir dispositivos físicos. Jefatura avisada requiere evento comprobable y canal; si solo hay intención, Aviso a jefatura pendiente. Publicación aceptada por ntfy no prueba que el teléfono recibió, sonó o que alguien actuó.

Reset escénico crea nueva ejecución; toda respuesta IA, acción tokenizada o petición anterior queda rechazada/descartada para no repoblarla. Cambiar hora narrativa no adelanta plazos. Control invoca contratos comunes, no escribe resultados visuales ficticios. La nota IA generada en reset se muestra como guardada, no como llamada en vivo.

## Fuera de alcance

Integración WhatsApp/ticketera real, solver/editor de turnos/políticas, resolución de hueco por Carla, telefonía de todos los personajes, scheduler autónomo, salud/sueño real y validación legal/clínica. wa.me opcional solo comparte borrador. No ampliar estos contratos por sugerencia de una skill.

## C10 · Paquete de contratos y persistencia acordada (T01)

Decisiones aprobadas por Diego al solicitar la implementación de T01 el 23-10-2026: HTTP Basic por rol (reemplazado después por la sesión de operador de C12), 50 reportes por ejecución, equivalencia conservadora y reloj narrativo 1:1. Este apartado y los tipos son la base común de T02/T03/T04; no crear contratos alternativos en cada módulo.

### Entradas y nombres

- `src/lib/contracts/client.ts`: única entrada de conveniencia para proyecciones públicas y constantes. Vistas privadas se importan explícitamente desde `private.ts`; comandos/respuestas desde `http.ts`. No existe un barrel que mezcle credenciales y DTO públicos.
- `core.ts`: identificadores, versión, instantes, estados y límites. IDs opacos con prefijos de entidad (no nombres de personas); UTC ISO con milisegundos y sufijo Z; versiones enteras >= 1. Las plantillas TypeScript no validan entradas runtime: T05 valida formatos y límites.
- `classification.ts`: salida estructurada exacta y adaptador T02. `domain.ts`: entidades internas. `auth.ts`, `services.ts`, `repositories.ts`: puertos independientes de framework, ORM y proveedor. `fixtures.ts`: datos/preparación declarativos. Ejemplos y pruebas estáticas no se importan desde producción.
- Ningún contrato importa Next, Node, Prisma, código de servidor ni SDK de proveedor. `AbortSignal` es el tipo estándar de cancelación; el paquete no llama APIs.

| Entidad | Nombre persistente acordado |
|---|---|
| Execution / Scene / Actor | `executions` / `scenes` / `actors` |
| CoverageWindow / Coverage | `coverage_windows` / `coverages` |
| Ticket / Handoff / HandoffAttempt | `tickets` / `handoffs` / `handoff_attempts` |
| ReportSession / RecipientGrant / Report | `report_sessions` / `recipient_grants` / `reports` |
| Classification / PolicyDecision | `report_classifications` / `report_policy_decisions` |
| Incident / IncidentAttempt | `incidents` / `incident_attempts` |
| Event / NotificationIntent / IdempotencyRecord | `events` / `notification_intents` / `idempotency_records` |

T03 materializa esos nombres, claves y constraints sin inferir tablas ya existentes. `recipient_grants` persiste hash/scope/expiración, sin token crudo. El puntero vigente es la ejecución con status active, protegida por exclusión única y bloqueo transaccional común durante reset; no se requiere otra tabla de puntero. Versiones cambian al persistir, no al consultar/renderizar. La ejecución usa `executionId` como identidad; las demás entidades usan `id` y `executionId`. Estados canónicos: relevo `draft/awaiting_candidate/accepted/uncovered`; cobertura `unconfirmed/scheduled/active/ended`; incidente `awaiting_ack/taken/unacknowledged`. No hay comando de resolución ni de asignación por jefatura.

### Límites transaccionales y puertos

`UnitOfWork.run` bloquea y comprueba la ejecución vigente hasta commit. T03 puede serializar las transacciones cortas de la demo mediante un bloqueo transaccional común del puntero de ejecución; reset usa el mismo orden. Luego se validan versiones, estado e intento/candidato. `compareAndSwap` condiciona todos esos campos y aumenta la versión una vez. `ok:false` revierte todas las escrituras de esa unidad de trabajo. Repositorios no implementan reglas de política ni aceptan ejecución elegida por una consulta sin comprobar.

Entidades/transiciones, eventos (incluido principal iniciador separado del actor representado), intenciones de aviso y respuesta idempotente se confirman juntos. `EventDetails` conserva razón/modo de clasificación y política; esos detalles no se copian a PublicEventDTO. La sugerencia guardada y su procedencia se almacenan con el relevo; no se añade un módulo de notas independiente. Índices/constraints mínimos: identidad y ejecución; un intento pendiente vigente por proceso; secuencia única de evento por ejecución; clave lógica única de aviso; scope único de idempotencia; secuencia única de admisión por ejecución e índice de cuota por sesión/ejecución. T03 garantiza referencias dentro de la misma ejecución y búsquedas parametrizadas. No hacer llamadas IA/ntfy manteniendo locks. `replaceExecution` devuelve repositorios acotados a la sucesora dentro de la misma transacción para insertar ventanas/fixtures antes del commit; no abre una transacción separada ni una guarda de reset destructivo. T03 materializa actores y escenas con identidad compuesta `(executionId, id)`: cada preparación remapea los IDs, y `replaceExecution` copia estas referencias a filas de la sucesora conservando sus IDs. Así el reset puede consumir los puertos existentes sin compartir filas con la ejecución retirada. Las demás referencias se validan dentro de su ejecución, incluidas las polimórficas y arrays mediante constraints diferidos. No cambia las firmas de T01.

`HandoffService` es dueño de elegibilidad/cobertura y de sus plazos; `IncidentService`, de registro equivalente/acuse/escalada y sus plazos. `ClassificationService` consume T02; `PolicyService` decide sin permitir instrucciones del reportante. `MessageService` orquesta ingreso común de web/control. `IncidentService.register` recibe obligatoriamente los repositorios de la transacción de ese ingreso; no abre otro commit. Las consultas de cobertura/elegibilidad de T06 también reciben esa transacción para decidir sobre el mismo estado. `ExecutionService` es el único ensamblador global en T11. `ReadService` construye proyecciones, no duplica motores.

`NotificationTransport.deliver` admite un doble de prueba: `provider_accepted`, `in_app_recorded`, `failed` o `discarded`. Una intención pendiente no equivale a envío. T08 resuelve tópico/token privadamente, revalida ejecución/intento antes del efecto y registra el resultado solo si sigue vigente. Si un reset ocurre durante un HTTP ya enviado, no puede retirar ese envío físico; su resultado antiguo se descarta y no contamina la sucesora. No se garantiza exactamente una entrega externa.

## C11 · Wire de rutas, vistas y errores

Todos los POST usan JSON y llevan `executionId` e `idempotencyKey` en el cuerpo. `expectedVersion` corresponde a la entidad indicada abajo, nunca a una versión visual. Candidatos envían `attemptId`. `[id]` es parámetro de ruta y debe coincidir con la entidad autorizada. `representedActorId` solo se admite en operaciones de actor invocadas por control; auth verifica elegibilidad/identidad y fija `origin=scenario`.

Éxito: `{ok:true,data,correlationId}`. Error: `{ok:false,error:{code,message},correlationId}`. La propiedad `status` de los ejemplos representa el status HTTP, no un segundo estado de negocio. Replays conservan status y cuerpo originales. Ningún error revela credenciales, entrada privada, SQL ni existencia de entidades inaccesibles.

| API | Entrada adicional | Salida / status | Acceso |
|---|---|---|---|
| POST messages | `nickname`, `text` | `ReportReceiptDTO` / 201 | Sesión pública o control |
| GET state | Sin cuerpo | `PublicStateDTO` / 200 | Público |
| POST handoff | `handoffId`, versión del borrador, `note` (puede ir vacía), cinco decisiones de tickets con razón tomadas de la propuesta IA o la base | `HandoffResultDTO` / 201 | Saliente o control representándolo |
| POST handoff/suggest | `handoffId`, versión del borrador | `SuggestionResultDTO` / 200 | Saliente o control representándolo |
| POST handoff/[id]/accept | Versión del relevo, `attemptId` | `HandoffResultDTO` / 200 | Destinatario vigente o control representándolo |
| POST handoff/[id]/reject | Versión del relevo, `attemptId` | `HandoffResultDTO` / 200 | Destinatario vigente o control representándolo |
| POST ack/[id] | Versión del incidente, `attemptId` | `IncidentResultDTO` / 200 | Destinatario vigente o control representándolo |
| POST scene | Versión de ejecución, `sceneId`, `channelOpen` | `PublicStateDTO` / 200 | Control |
| POST reset | Versión de ejecución | `ResetResultDTO` / 201 | Control |

Enviar persiste las cinco decisiones (propuesta IA o base, sin edición de Rodrigo) y la nota opcional de hasta 60 palabras; IDs exactos, únicos y de la ejecución, sin aceptar tickets arbitrarios. Las ediciones locales aún no enviadas se identifican como borrador sin guardar, sin inventar un endpoint de guardado. Sugerir regenera realmente, guarda propuestas/nota y aumenta la versión del borrador; el fallo conserva lo guardado. Reset responde con ejecución nueva `preparation=pending`, canal cerrado y nota aún no disponible; T11 prepara mediante T09 y pasa a `ready` o `failed`, sin fingir llamada en vivo posterior.

GET state evalúa vencimientos/activación mediante T11 y devuelve revisión persistida. No acepta ni acusa por una persona. Toda respuesta de estado es `no-store`; consumidores descartan respuestas viejas por ejecución y revisión. Para una nueva ejecución se vuelve a cargar la lectura vigente; las operaciones de la anterior reciben conflicto.

### Vistas

`PageViewMap` congela `/canal → ChannelViewDTO`, `/rodrigo → RodrigoViewDTO`, `/relevo/[id] → HandoffPackageDTO`, `/proyector → PublicStateDTO`, `/control → ControlViewDTO`. Las lecturas privadas se hacen en la página servidor con `ReadService` y autorización en cada carga/refresco; no se añaden API privadas nuevas ni se amplía state según la credencial recibida.

El campo `audience` distingue público, reportante, saliente, destinatario y control. `PublicStateDTO` contiene solo escena, relojes, cobertura, resúmenes de relevo/incidentes, resultados de aviso y eventos saneados; no contiene texto de reportes, tickets, nota privada, concesiones, enlaces tokenizados, tópicos ni secretos. Construir mediante lista permitida, no spreads de entidades. TypeScript estructural no garantiza saneamiento de un objeto runtime: T11 debe comprobar la serialización real. Una vista privada también excluye secretos innecesarios para el actor.

El canal recibe solo sus propios recibos mediante cookie, sin exponer el ID/credencial de sesión. No se usa el apodo para recuperar reportes ajenos. El proyector nunca recibe botones/credenciales de control. `outgoingNoticeCount` cuenta intenciones de aviso distintas dirigidas al actor saliente de la ventana; no cuenta intentos HTTP, recepciones ni despertares.

### Catálogo de errores

`http.ts` enlaza códigos y status con una unión discriminada; `error-examples.ts` contiene un ejemplo de cada código. El mapa `ApiRoutes` acota los errores por operación.

| HTTP | Códigos |
|---|---|
| 400 | `INVALID_INPUT` |
| 401 | `AUTH_REQUIRED`, `AUTH_INVALID`, `AUTH_EXPIRED` |
| 403 | `FORBIDDEN`, `ORIGIN_REJECTED` |
| 404 | `NOT_FOUND` |
| 409 | `EXECUTION_STALE`, `VERSION_CONFLICT`, `CANDIDATE_STALE`, `STATE_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `OPERATION_PENDING`, `CHANNEL_CLOSED` |
| 410 | `ACTION_EXPIRED` |
| 429 | `QUOTA_EXCEEDED` |
| 502 / 504 | `PROVIDER_FAILED` / `PROVIDER_TIMEOUT`, solo sugerencia IA |
| 503 | `STORAGE_UNAVAILABLE` |

Orden de comprobación: formato mínimo → autorización/origen → ejecución vigente → replay idempotente → entidad accesible → versión/intento/estado/plazo → mutación. Con credencial válida pero intento ya derivado: `CANDIDATE_STALE`; mismo intento aún pendiente cuyo plazo venció: `ACTION_EXPIRED`; credencial expirada por su TTL: `AUTH_EXPIRED`. No usar errores para revelar un recurso ajeno. Reportes admitidos con IA fallida devuelven resultado degradado conservador, no 502/504 ni salida modelo inventada.

## C12 · Autorización de demo y origen

- Rodrigo y control (decisión de Diego del 23-10-2026, reemplaza HTTP Basic por rol): ingreso con formulario propio y **una sola contraseña de operador**, `OPERATOR_SECRET` (mínimo 12 caracteres, se recorta al leerla). Sin ella el acceso falla cerrado. El rol no lo fija la contraseña sino la página donde se ingresa: `/rodrigo` emite sesión de Rodrigo (principal saliente, origen web) y `/control`, sesión de control (origen escenario). Riesgo aceptado: quien conoce la contraseña abre ambas páginas. No hay cuentas ni usuarios.
- Sesión de operador: `POST /api/acceso` `{ role: "outgoing" | "control", secret }` exige `Origin` igual a `APP_ORIGIN` y emite una cookie por rol (`relevo_op_rodrigo`, `relevo_op_control`): HttpOnly, Path=/, SameSite=Lax, Max-Age=43200, Secure en HTTPS. El valor es un token sin estado `v1.<rol>.<expira>.<nonce>.<hmac>`, HMAC-SHA256 con `OPERATOR_SECRET`; no se guarda en base de datos y cambiar la contraseña invalida todas las sesiones. Errores: `AUTH_INVALID` (contraseña), `AUTH_NOT_CONFIGURED` (503, falta la variable) y `ORIGIN_REJECTED`, que en este endpoint incluye `origin.expected` (el `APP_ORIGIN` configurado, público) y `origin.received` para diagnosticar la configuración. Una contraseña errónea espera 400 ms. `POST /api/acceso/salir` (cuerpo JSON) borra las cookies de ambos roles, porque una sesión de control también abre `/rodrigo`; no exige `APP_ORIGIN`, para que un origen mal configurado no impida salir.
- Autorización: la cookie de operador válida de un rol permitido gana sobre Basic; con ambas sesiones en el mismo navegador, las rutas que admiten los dos roles actúan como Rodrigo. Una sesión válida de un rol no permitido responde `FORBIDDEN`, no `AUTH_REQUIRED`. Basic queda solo como respaldo para clientes sin navegador (pruebas, scripts): usuario `rodrigo` o `control` y contraseña `OPERATOR_SECRET`. `/rodrigo` y `/control` ya no pasan por el proxy ni responden 401 con desafío: sin sesión muestran el formulario; si una acción falla por sesión, el formulario aparece en la misma página y conserva lo escrito. HTTPS en demo, HTTP solo loopback en desarrollo. La contraseña y los tokens no aparecen en DTO, URLs, logs ni almacenamiento accesible por JavaScript.
- Control no tiene atajos para escribir estados: invoca los mismos servicios. Acciones de Tomás o Paula registran actor representado, principal de control y origen escenario; el identificador recibido nunca concede permiso. El sistema tiene un principal interno que no puede solicitarse por JSON público.
- Token: 32 bytes aleatorios criptográficos como mínimo, codificados base64url; hash SHA-256 persistido (no token crudo), scope de ejecución/actor/entidad/intento/acciones. TTL máximo de 30 min desde emisión, comprobado con reloj operacional. El plazo de 30 s limita actuar antes del TTL. Aceptar/rechazar o tomar invalida la capacidad de otra transición, pero permite replay autorizado de la misma acción.
- Relevo: enlace privado `/relevo/[id]?token=...` para GET de revisión; POST explícitos con `Authorization: Bearer ...`. Incidente: bearer solo para `take_incident`. Una concesión de incidente no abre paquetes de relevo. Página tokenizada sin recursos/enlaces externos, `Referrer-Policy: no-referrer`, `no-store`; redactar query token y Authorization en logs de app, proxy y proveedor antes de ensayo. No incluir enlaces tokenizados en evidencia.
- POST del navegador: `Content-Type: application/json`, `Origin` exactamente igual a `APP_ORIGIN` configurado por entorno (esquema, host y puerto); rechazar `null`, ausente o distinto. No confiar en Host arbitrario para construir la lista. Sin CORS abierto. Aplica también a las cookies de operador y a Basic, que el navegador adjunta automáticamente; el control de origen impide CSRF. Por esa misma razón, el formulario de `/canal` envía `x-relevo-canal: 1` (`SECURITY.publicSubmitHeader`): con ese encabezado, `POST /api/messages` ignora Basic y las cookies de operador y solo acepta la cookie `relevo_session`. Así, una sesión de control o de Rodrigo abierta en el navegador no atribuye el reporte a escenario ni lo rechaza. Ignorarlas solo quita privilegios; sin cookie válida, la respuesta sigue siendo `AUTH_REQUIRED`/`AUTH_INVALID`.
- Excepción nativa: únicamente POST ack con bearer de incidente puede carecer de Origin, para acción HTTP ntfy. Un Origin presente y ajeno se rechaza igualmente. Basic/sesión no sustituyen ese bearer en una solicitud sin origen. El cuerpo JSON lleva ejecución, versión, intento y clave idempotente predefinida del aviso; T08 debe comprobar soporte real del S26.
- Cookie pública `relevo_session`: valor aleatorio opaco con 32 bytes de entropía, solo hash persistido, HttpOnly, Path=/, SameSite=Lax, Max-Age=43200, Secure en HTTPS. Se emite en la entrada al canal; una cookie ausente/expirada en POST no crea silenciosamente otra sesión. La sesión dura 12 h; sus cuotas son independientes por ejecución y no se reinician cambiando apodo.

No es autenticación empresarial. La comprobación ejecutable pertenece a T05/T14; la configuración de logs de plataforma y el ensayo nativo se verifican en T20/T21.

## C13 · Cuotas, IA y equivalencia conservadora

### Admisión

Máximo 280 puntos de código Unicode después de trim; rechazar vacío, caracteres de control salvo saltos de línea/tabulación, apodo vacío o mayor de 40 puntos de código. No permitir HTML ejecutable: renderizar texto escapado, nunca insertar contenido como HTML. Estas comprobaciones de formato no borran el hecho reportado ni aplican una política de palabras clave. Apodo ficticio para presentación, sin identidad ni permisos.

Admitir requiere canal abierto, ejecución vigente, sesión autorizada y cuota disponible. Reservar atómicamente cuotas por `(executionId, sessionId)` y global: 5 por sesión y 50 globales. El contador de sesión se obtiene de los reportes admitidos, incluidos processing, con índice `(executionId, sessionId)` bajo el bloqueo de ejecución; el global usa `Execution.admittedReports`. Reserva e inserción de reporte se confirman juntas: no se requiere una tabla de cuotas adicional. Control usa una sesión de escenario estable por ejecución, validada desde su principal, con los mismos límites; no elige una nueva sesión en cada reporte. Todos cuentan, incluidos equivalentes y degradados. Una entrada rechazada no cuenta; repetir la misma clave tampoco. Cambiar apodo no renueva cuota. Borrar cookies puede crear otra sesión: el límite global acota ese abuso; no se promete identidad de persona.

Ingreso por fases: transacción corta reserva idempotencia/cuota, asigna `admissionSequence` creciente y crea reporte `processing`; clasificación fuera de transacción; transacción posterior comprueba ejecución/versión del reporte y guarda su clasificación. El mismo orquestador drena el prefijo de reportes en orden de admisión que ya tienen clasificación guardada, confirmando decisión, vínculo/incidente, eventos, intención y respuesta final juntos. `reportsAwaitingDecision()` permite ese orden persistido sin depender de memoria local ni de T11. La respuesta normal POST es recibo final 201. Una operación concurrente pendiente devuelve `OPERATION_PENDING`; no repite IA ni reserva cuota. No devolver al cliente éxito de guardado si el resultado de commit es desconocido. Una ejecución retirada descarta el resultado tardío sin repoblar la nueva.

T02 implementa `StructuredProvider`, valida salida exacta `ClassificationOutput/NoteOutput` y distingue timeout, salida inválida y proveedor no disponible. El caller decide política y persistencia. Servicio, condición, alcance, pc finito [0,1], manipulación, bloqueo de boletas y evidencia extraída son datos; no autorizan acciones por sí solos. Las evidencias deben ser fragmentos literales del texto, no lugares/recursos inventados. Nota: una propuesta por cada uno de los cinco tickets, IDs sin duplicar ni omitir, razón no vacía y nota <=60 palabras separadas por espacio Unicode. En insuficiencia o servicio `otro` sin base suficiente, revisión conservadora rotulada.

### Identidad del hecho

Normalización determinista de texto y evidencia: NFC, minúsculas Unicode, compactar espacios y trim. En problema/texto sustituir puntuación Unicode por espacios salvo cuando está entre letras o dígitos; en lugar/recurso conservar la puntuación identificadora. Conservar letras, tildes, dígitos y símbolos no puntuación; no aplicar stemming, sinónimos, similitud vectorial ni eliminar números. Las coordenadas/lugares y recursos deben seguir distinguiéndose. Para fallback de texto se normaliza el reporte completo.

Clave `facts`: ejecución + servicio + condición + alcance + lugar + recurso + problema normalizados. Usarla solo si servicio conocido, clasificación suficiente y problema literal no vacío; para persona/local-equipo se exige lugar o recurso identificable y para generalizado el problema debe explicitar el hecho general. Todos los campos, incluidos null, deben coincidir. Si los atributos son incompletos, no están respaldados literalmente o el modo es degradado: clave `text` con ejecución + texto normalizado completo. No cruzar modos para inferir equivalencia. Dos paráfrasis sin evidencia común suficiente se conservan separadas; el contrato favorece no ocultar hechos distintos.

La evidencia es apoyo para una comparación exacta, no una decisión libre del modelo sobre duplicados. No unir por servicio, por criticidad o por un problema genérico sin localización cuando el alcance es local. Criterio común en T07; T10 no inventa otro.

Buscar incidente de esa clave con `0 <= narrativeAt - firstNarrativeAt < 600000 ms`; si hay más de uno, elegir el de primer reporte más reciente que cumpla. Se toma el instante narrativo de admisión, no el de respuesta IA. Anclar al primer reporte: duplicados posteriores no prolongan ventana. A 9:59.999 une; a 10:00.000 o 10:00.001 crea otro. Conservar todos los reportes vinculados; no crear otra intención lógica para el mismo incidente/intento. Hechos distintos del mismo servicio tienen otra clave.

T03 serializa lock/búsqueda/creación por ejecución y clave en la transacción (por ejemplo bloqueo advisory transaccional de la representación canónica); T10 usa ese repositorio. Una colisión de hash solo debe serializar de más: comparar también partes completas. No usar bucket de diez minutos ni UNIQUE(service) como sustituto. Para respuestas IA fuera de orden, T14 invoca T10 en orden de `admissionSequence`, usando el prefijo listo descrito arriba; no salta un reporte anterior aún sin clasificación. Un reintento pending puede drenar clasificaciones ya guardadas sin llamar otra vez al modelo. Si el proceso anterior se interrumpe antes de guardarla, se aplica el límite de recuperación por reset de C14. Cada reporte guarda su principalKey, clave idempotente y correlación para completar el recibo correcto aunque otra petición drene el prefijo; no guarda la credencial. No tomar el instante de llegada IA como comienzo de ventana ni generar dos incidentes equivalentes. Este caso requiere prueba DB en T10/T14.

## C14 · Relojes, idempotencia y ejecución

- `operationalNow` proviene del servidor; plazos y expiración se comparan con él. `now >= deadlineAt` impide actuar aunque nadie haya consultado state. Al derivar, el nuevo candidato recibe 30 s completos desde su solicitud real, no desde el plazo antiguo. Relevo y acuse tienen intentos y plazos separados.
- Hora narrativa = `anchor.narrativeAt + (operationalNow - anchor.operationalAt)` a velocidad 1:1. Una escena fija nueva ancla con destino >= narrativa actual; elegir escena anterior o destino ya pasado devuelve `STATE_CONFLICT` y requiere reset para retroceder. No cambia timestamps/plazos operacionales. Cobertura efectiva se evalúa con hora narrativa dentro de `[window.startsAt, window.endsAt)` y aceptación válida; fin saliente no depende de confirmación entrante.
- Cambiar escena no equivale a aceptar/acuse y no crea resultados visuales ficticios. Canal abierto se persiste expresamente; reset vuelve a cerrado. Las anclas y fechas narrativas completas incluyen el cambio de día en America/Santiago, no solo HH:mm.
- Idempotencia: scope `(executionId, principalKey, operation, key)`. `principalKey` usa identidad interna de saliente/control/sesión/destinatario, nunca apodo, token crudo o actor representado sin permiso. Clave de 1–128 caracteres ASCII alfanuméricos, guion, punto o guion bajo. Fingerprint SHA-256 de JSON canónico con claves ordenadas recursivamente, método, ruta concreta, parámetros y cuerpo; excluir credenciales y la propia clave idempotente. Arrays conservan orden. Una clave reutilizada con contenido distinto devuelve 409.
- Guardar reserva pending antes del trabajo externo; ante concurrencia devuelve 409 sin repetir trabajo. Cuando finaliza, respuesta/status se guardan una vez. No conservar un fallo de autorización/formato como éxito repetible. Una reserva pendiente cuyo proceso se interrumpe no se reejecuta automáticamente en esta demo: queda visible como processing y puede recuperarse mediante reset protegido. No se añade worker/lease/scheduler; T14 debe mostrar esa limitación, no afirmar reporte completado.
- Tras comprobar credencial y ejecución, un replay coincidente devuelve el resultado original antes de validar otra vez la versión ya consumida. La credencial debe seguir dentro de TTL y scope. El replay no ejecuta una nueva transición ni reavisa. Petición distinta con candidato/versión antiguos se rechaza.
- Reset: se reserva contra ejecución anterior y versión esperada. Una sola transacción cambia puntero vigente, marca anterior retirada, inserta sucesora, fixtures e intención de preparar nota, y completa la respuesta idempotente. La preparación IA se ejecuta fuera de esa transacción. `replayReset` es la única lectura idempotente permitida sobre ejecución retirada: mismo principal/fingerprint/clave y solo si la sucesora guardada sigue vigente; de lo contrario `EXECUTION_STALE`.
- Cualquier resultado asíncrono conserva ejecución y versión de su entidad de trabajo; antes de guardarlo se comprueba la ejecución vigente y la versión de esa entidad. No invalidar una clasificación porque otro reporte cambió una revisión global no relacionada. Reset cancela señales cuando sea posible; la comprobación persistente sigue siendo obligatoria.

## C15 · Fixtures, ejemplos y alcance de verificación

`FixturePreparer` prepara y retira ejecuciones locales aisladas con guarda de destino; T03 lo implementa sin depender de API reset. `BASE_FIXTURE`, `ACCEPTED_FIXTURE`, `INCIDENT_FIXTURE` y `OUTGOING_ELIGIBLE_FIXTURE` proporcionan actores, cinco tickets, ventanas, relojes, plazos configurables y escenarios independientes. No ejecutan seed, IA ni push. Los IDs declarativos se remapean a IDs nuevos por preparación; no se comparte ejecución entre pruebas. La nota permanece `not_prepared` hasta que un doble explícito o proveedor real la produzca; un fixture no acredita generación.

`examples.ts` contiene una petición/respuesta por ruta y una vista por página, datos ficticios y expectativas a ambos lados del límite de diez minutos. `error-examples.ts` cubre cada código. `type-tests.ts` usa errores de compilación esperados para mezclas públicas/privadas, IDs de intentos, comandos incompletos, status HTTP y estados fuera de alcance. No son validadores ni pruebas runtime.

T01 ejecuta perfil Base e inspección de imports de cliente. Las pruebas de seguridad, cuotas concurrentes, transacciones, transporte físico y políticas quedan NO EJECUTADAS por T01. Su matriz de aceptación y responsabilidades está en la evidencia de la tarea; no marcar R/I/A/S como PASS por escribir tipos.
