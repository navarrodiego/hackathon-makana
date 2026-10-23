# Contratos de Relevo

Fuente técnica del paquete. Describe comportamiento aprobado, no implementación comprobada. PRODUCT define propósito/alcance; LANGUAGE define texto humano. Este documento no reemplaza los DTO ni migraciones del código: el integrador y WT-B deben fijar sus nombres, tipos y respuestas exactas antes de paralelizar tareas dependientes.

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

La IA propone `puede_esperar` / `transferir`, razón breve y nota de hasta 60 palabras. Rodrigo revisa y corrige; la nota es borrador editable. No inventar compromisos, causas o resolución. Generar y guardar al reiniciar; Regenerar hace llamada real. Si falla, no fingir generación. Cerrar no reavisa un incidente ya avisado, ni publica los tickets como mensajes del canal.

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

Canal cerrado hasta escena habilitada. Apodo ficticio, texto máximo 280 caracteres y 5 envíos por sesión/apodo; también límite global por ejecución y filtro básico. El valor global y el mecanismo de sesión/limitación quedan por fijar al implementar; apodo no es identidad confiable ni protección suficiente ante abuso.

Clasificador: servicio `facturacion`, `red_locales`, `correo`, `vpn`, `impresora`, `cuentas`, `otro`; estado caída/degradación/solicitud; alcance persona/local-equipo/generalizado; manipulación informativa. La salida exacta se valida contra schema. Un texto malicioso no modifica política, elegibilidad ni destinatarios y tampoco borra el incidente real que pueda contener.

Facturación/red son críticos; correo generalizado puede serlo. Impresora no es siempre diferible: puede bloquear cajas/boletas. Desconocido no equivale a seguro para diferir.

`pc` representa probabilidad de caída. Servicio crítico con `pc ≥ 0,70`: avisar; con `0,40 ≤ pc < 0,70`: revisión por guardia. Caída generalizada también avisa. La prioridad se evalúa antes de la ruta diferible; el límite 0,70 pertenece a aviso para evitar solapamiento. Calibrar, no prometer ausencia de falsos negativos.

Diferible: cola para próxima atención definida por política, sin push inmediato. 08:00 es ejemplo. Requiere atención: incidente al destinatario elegible de cobertura efectiva, no a Paula por nombre fijo. Sin cobertura se aplica C04.

Jev previsto `typesafe/jev-1.14`, Decisions API alfa de OpenRouter: verificar disponibilidad y contrato. Si no funciona, chat con salida estructurada y misma política. Objetivo de timeout 2,5 s; timeout/salida inválida/información insuficiente ⇒ modo degradado rotulado y revisión conservadora por guardia elegible, no diferir por ausencia de palabras clave. Sin guardia confirmada: coordinación pendiente, no inventar receptor.

Deduplicar atómicamente incidentes equivalentes del mismo hecho/servicio en ventana de 10 min de la escena. No colapsar hechos distintos solo por servicio. Fijar clave de equivalencia y cálculo del tiempo narrativo antes de implementación; pruebas deben cubrir ambos lados del límite. Registrar modo y razón de decisión sin exponer secretos.

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

No cachear estado operativo que oculte cambios; limpiar polling al desmontar. GET de enlace nunca acepta relevo ni acusa. Excepción explícita: el GET de estado evalúa plazos para la demo; no usarlo para acciones humanas. Evitar que enlaces tokenizados se filtren por vistas públicas, logs o referencias externas. El token de demo no equivale a autenticación empresarial. Considerar protección de origen/CSRF según la autorización finalmente elegida.

Falta congelar en código DTO, errores/status HTTP, tokens/expiración, límite global y mecanismo de idempotencia. No dar por implementado este contrato por existir una tabla de rutas.

## C09 · Avisos y reset

Paula: tópico ntfy aleatorio secreto, nunca en repo ni estado público. Relevo: enlace a revisión; aceptar/rechazar son POST. Incidente: «P1 · Facturación caída», acción POST «Tomar incidente» a `/api/ack/[id]` con token limitado a ejecución/destinatario/incidente. Probar soporte real de la acción en S26.

Tomás/Carla: representación in-app y canal visible; no fingir dispositivos físicos. Jefatura avisada requiere evento comprobable y canal; si solo hay intención, Aviso a jefatura pendiente. Publicación aceptada por ntfy no prueba que el teléfono recibió, sonó o que alguien actuó.

Reset escénico crea nueva ejecución; toda respuesta IA, acción tokenizada o petición anterior queda rechazada/descartada para no repoblarla. Cambiar hora narrativa no adelanta plazos. Control invoca contratos comunes, no escribe resultados visuales ficticios. La nota IA generada en reset se muestra como guardada, no como llamada en vivo.

## Fuera de alcance

Integración WhatsApp/ticketera real, solver/editor de turnos/políticas, resolución de hueco por Carla, telefonía de todos los personajes, scheduler autónomo, salud/sueño real y validación legal/clínica. wa.me opcional solo comparte borrador. No ampliar estos contratos por sugerencia de una skill.
