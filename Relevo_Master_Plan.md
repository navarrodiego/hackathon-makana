# Relevo · Master plan para la Hackatón Señales

**Caso 02 · Rodrigo** · Diego Navarro (equipo de 1) · Folio SEN-2026-7436
Viernes 23 y sábado 24 de octubre de 2026 · Fray Luis de León 12334, Las Condes

> Actualización de ejecución · 23-10-2026: Diego autorizó incorporar estos materiales y pidió solo la base técnica. Se eligió Prisma; contratos actuales en [CONTRACTS](docs/CONTRACTS.md) y evidencia en [SETUP](docs/SETUP.md). El recorrido funcional sigue pendiente.

> Documento de producto y ejecución; no acredita implementación. El repositorio se crea en el evento. La regla «todo el trabajo debe hacerse durante el evento» requiere confirmar con la organización el alcance permitido de la preparación previa y del trabajo nocturno fuera de sede.

## 0. En una página

- **Producto:** una web app para soporte TI que hace explícito quién recibe el turno y quién responde a un incidente. La cobertura y el registro son continuos, 24/7; no significa disponibilidad permanente de una persona.
- **Intervención:** Rodrigo prepara el cierre, revisa los pendientes y envía un relevo. La persona entrante debe aceptarlo. Las 22:10 son el ejemplo de un fin de turno compatible, no una hora universal para sus semanas de día, tarde y noche.
- **Demo principal acordada:** Paula acepta el relevo; el jurado entra por QR al canal de reportes. Una caída crítica hace sonar el S26 de Paula. Ella no acusa el incidente; a los 30 segundos escala a Tomás, que lo toma desde el control del escenario. Rodrigo está fuera de los respaldos elegibles en esta ventana.
- **Fallo de relevo:** Paula puede aceptar o indicar «No puedo cubrir». Rechazo deriva inmediatamente a Tomás; silencio deriva al vencer 30 segundos. Si Tomás tampoco acepta, avisar a Carla y mostrar **«Sin cobertura confirmada»**. La resolución de jefatura no se construye en esta demo.
- **Dos procesos diferentes:** aceptar la cobertura no es tomar un incidente; tomarlo no es resolverlo. Transferir pendientes no dispara una alarma urgente por cada ticket.
- **IA:** Jev por OpenRouter clasifica reportes; una política visible decide. Un modelo de chat redacta la nota de traspaso. Rodrigo revisa y puede corregir las sugerencias.
- **Stack:** Next.js + PostgreSQL local + Neon para la demo en Vercel, Tailwind + shadcn/ui, ntfy en el teléfono de Paula. Un servidor PostgreSQL local, una base por worktree y otra de integración; sin stack Supabase.
- **Qué se comprueba:** envío y aceptación del relevo, cobertura efectiva, avisos, acuses y escaladas. No se mide sueño ni se promete una mejora clínica demostrada.
- **Esfuerzo:** el alcance cambió. Las estimaciones anteriores no validan el esfuerzo de esta versión; ver sección 9.

## 1. Reglas y horario

Fuentes: https://hack.makana.cl/bases.html y https://hack.makana.cl/evento. Las bases online v1.5 del 19 de octubre actualizan el PDF v1.2.

| Cuándo | Qué |
|---|---|
| Vie 08:30 | Acreditación y café |
| Vie 09:00 | Bienvenida y armado de equipos |
| Vie 09:45 | Construcción |
| Vie 12:00–12:30 | Checkpoint 1; duración de 30 min reservada por este plan |
| Vie 13:00–14:00 | Almuerzo |
| Vie 17:15–17:45 | Checkpoint 2; duración de 30 min reservada por este plan |
| Vie 18:30 | Cierra la sede |
| Sáb 09:00 | Abre la sede |
| **Sáb 13:00** | **Entrega: se registra el último commit de la rama principal** |
| Sáb 13:00–13:45 | Almuerzo y prueba de proyector |
| Sáb 13:45 | Sorteo del orden |
| Sáb 14:00 | Pitches: 5 minutos con demo en vivo + 3 de preguntas |
| Sáb 17:00 / 17:30 | Deliberación / premiación |

Repo nuevo y público; README de una página; cada integrante con su cuenta de GitHub. Entrega en /evento. Sin datos personales reales, tampoco propios: equipo ficticio, apodos inventados, sin números telefónicos. Considerar derivación profesional cuando corresponda.

Tres criterios con el mismo peso: **problema, solución y convicción**. Lo que corre en vivo importa más que una lista de funciones. La pregunta de cierre no suma puntos; sirve a la deliberación sobre empates por caso.

## 2. El caso: hechos, hipótesis y foco

### Hechos
- Rodrigo tiene 41 años, vive en Concepción con su pareja e hijo de 6 años; soporte TI con turnos semanales de día, tarde y noche, además de guardia por WhatsApp.
- Duerme 5 h en semanas de noche y 6 h en semanas de día desde hace 14 meses; lo normaliza.
- Martes: cerró 23:58 y durmió 4 h 20. Viernes: cerró 22:10 y durmió 6 h 40. Son dos observaciones: coincidencia, no causalidad probada.
- Tercer café el lunes a las **19:20**; delivery el jueves a las 22:40; el domingo dice «ando cansado».
- «Yo duermo poco nomás, siempre he sido así». «Si no reviso los tickets antes de acostarme, igual no me duermo». «Sin café no funciono».
- Probó melatonina, dejar el celular fuera y un reloj que dejó de cargar. Su teléfono es despertador, guardia y distracción. El grupo suena a cualquier hora; teme que algo se caiga.
- Irritabilidad, un ticket mal cerrado a las 3 a. m., ronquido fuerte según su pareja y un amigo que ofrece pastillas.
- Éxito del caso: que duerma una hora más.

### Diagnóstico y elección de intervención
El problema es multifactorial: horarios, cafeína, creencias, disponibilidad laboral y una señal de salud por evaluar. No sabemos cuánto pesa cada factor ni afirmamos que la guardia sea el principal. Elegimos una barrera explícita y abordable: su dificultad para dejar de revisar tickets por temor a que nadie responda.

Los intentos individuales no le dieron una forma confirmada de transferir responsabilidad. Es una interpretación del caso, no prueba de que expliquemos todas sus dificultades.

Relevo no añade un módulo de cafeína ni un plan de sueño. Sugiere consultar por el ronquido, sin diagnosticar ni recomendar medicación y sin esperar a que funcione la intervención laboral. El cierre y el registro podrían ayudar a cuestionar la disponibilidad permanente; no prueban cambiar su identidad ni dormir más.

### Hipótesis declaradas
- H1: hay personas y respaldos que pueden cubrirlo con acuerdo de la empresa; no sabemos cómo está organizada hoy su guardia.
- H2: para la demo, retail del Biobío con unos 30 locales y facturación crítica.
- H3: Rodrigo, Paula, Tomás y Carla son el equipo ficticio. No están en la ficha.
- No sabemos presencialidad, ticketera, permisos, acuerdo o pago de guardia. La app no crea recursos humanos ni acredita cumplimiento legal.

## 3. Decisiones de producto

**Entrega el turno. Recupera la noche.**

### 3.1 Pendientes no son alarmas
La IA propone **«Puede esperar» / «Transferir a la guardia entrante»**, con razón breve. Rodrigo puede corregirlo. Transferir significa dar contexto y seguimiento; no declarar automáticamente una urgencia.

- Crear una cuenta para el lunes: cola de atención posterior.
- Verificar el respaldo de las 02:00: seguimiento para quien entra, sin alarma inmediata al cerrar.
- Facturación caída ahora: incidente activo que requiere aviso y acuse por separado.

Cerrar no vuelve a notificar un incidente ya avisado. Todos los pendientes quedan accesibles en el relevo/cola; no se publican automáticamente como mensajes del chat público.

### 3.2 Cerrar, aceptar y hacerse efectivo
1. Preparar y enviar el relevo antes del término de turno cuando sea posible.
2. El entrante revisa el paquete y pulsa **«Aceptar relevo»** o **«No puedo cubrir»**.
3. Una aceptación anticipada confirma quién recibirá, pero solo se hace efectiva desde el inicio de su ventana. Hasta entonces no se cambia prematuramente el destino de los incidentes.
4. Registrar separadamente hora de envío, aceptación, comienzo de cobertura y fin de turno saliente.
5. No mostrar cobertura activa solo porque Rodrigo pulsó Enviar.

**Aceptar cobertura ≠ tomar un incidente ≠ resolverlo.** Aceptar no garantiza atención permanente a pantalla ni elimina los avisos de incidentes críticos nuevos.

### 3.3 Relevo no aceptado: decisión acordada
- Plazo de respuesta de **30 segundos por candidato en la demo**. Es tiempo real transcurrido, no el reloj narrativo de las escenas ni una recomendación operativa universal.
- Un aviso de relevo por candidato, no una alarma urgente por cada pendiente del paquete.
- Paula rechaza: derivar inmediatamente a Tomás. Paula guarda silencio: derivar al vencer su plazo.
- Tomás puede aceptar/rechazar y tiene su propio plazo de 30 segundos.
- Si tampoco acepta: registrar aviso a Carla y mostrar **«Sin cobertura confirmada · Jefatura avisada»**. No implementar que Carla asuma ni asigne reemplazos en esta demo.
- No avisar a todo el equipo simultáneamente ni prolongar automáticamente el turno de Rodrigo. Terminar su turno y confirmar cobertura son estados distintos.
- Una aceptación tardía del candidato anterior no cambia la asignación: se informa que el relevo ya fue derivado. No crear dos responsables.
- Sin cobertura no inventar un responsable técnico. Los críticos nuevos se registran y se elevan a Carla como coordinación pendiente, sin afirmar atención técnica ni reincorporar automáticamente a Rodrigo. El procedimiento empresarial para ese hueco queda fuera de la demo.

### 3.4 Mensajes e incidentes después del relevo
- No urgente: registro y cola para la próxima ventana de atención definida por la política, sin push inmediato. Las 08:00 son un ejemplo de la escena nocturna, no una regla universal.
- Requiere atención: incidente, aviso al responsable elegible y plazo de acuse.
- Sin acuse a los **30 segundos de la demo**: escalar al siguiente respaldo elegible. Tomar un incidente detiene esa escalada, pero no lo resuelve.
- La falta de acuse de un incidente no cambia por sí sola al titular de toda la cobertura. La responsabilidad de ese incidente y la del turno se conservan separadas.

### 3.5 Rodrigo y la elegibilidad
El producto no excluye a Rodrigo por nombre. Puede recibir avisos si tiene una ventana y un rol de respaldo explícitamente acordados y elegibles. No queda como último recurso permanente por defecto.

**En la demo principal Rodrigo termina y NO es respaldo elegible.** La cobertura es Paula y el respaldo Tomás. Fuera de esa lista no recibe alertas de Relevo. No afirmamos silenciar su WhatsApp real.

### 3.6 Registro continuo
Un registro de eventos 24/7 contiene: envío, aceptación, rechazo, vencimiento y derivación del relevo; comienzo/fin de cobertura; reporte, clasificación y decisión; intento de notificación y resultado del proveedor; acuse, escalada y resolución únicamente si se registra expresamente.

«Envío aceptado por ntfy» no equivale a entrega visible al dispositivo ni a acuse humano. No contar «despertares» como medición: usar avisos enviados a cada destinatario y acuses observados.

La mañana de las 07:00 y la vista de jefatura de las 09:00 son vistas del mismo registro, no un sistema exclusivo de noche. La cobertura 24/7 del sistema no equivale a una persona trabajando 24/7.

### Alcance honesto
| En la demo: objetivo de implementación, no acreditación de construido | Fuera de esta demo |
|---|---|
| Cierre, nota IA editable, aceptación/rechazo del relevo | Integraciones reales con WhatsApp y ticketera |
| Relevo Paula → Tomás; aviso a Carla y hueco visible | Resolución de jefatura: asumir/asignar reemplazo |
| Clasificación, política y QR público | Editor de políticas, solver, preferencias e intercambios |
| ntfy real en el S26 de Paula; acuse de incidente | App móvil propia y telefonía real de Tomás/Carla |
| Escalada de incidentes y registro continuo | Validación/adaptación legal y medición de sueño |
| Resúmenes y tarjeta de consulta por ronquido | Premios, rachas, gamificación y tratamiento clínico |

El botón wa.me sigue siendo un extra recortable para compartir un borrador. No confirma envío, aceptación ni cobertura. No usar la columna «Dejamos diseñado»: una intención no es trabajo realizado.

## 4. Datos y política ficticios

### Equipo y ventanas
- Rodrigo: saliente, término 22:10 en esta escena; después no es respaldo.
- Paula: entrante desde 22:10; S26 con ntfy y una vista web para revisar el relevo.
- Tomás: respaldo elegible; sus acciones se ejecutan desde el control protegido y se muestran en proyector, sin segundo push físico prometido.
- Carla: jefatura, avisos visibles en proyector. No se acredita entrega a un teléfono suyo ni se construye resolución de huecos.
- Ventanas y destinatarios se fijan en datos semilla; no se construye un editor/calendario de turnos.

### Servicios para el clasificador
`facturacion`, `red_locales`, `correo`, `vpn`, `impresora`, `cuentas`, `otro`. Facturación/red son críticos en la política de ejemplo; correo si es generalizado. No asumir que cualquier impresora es no crítica: considerar si bloquea boletas/cajas. Desconocido no equivale a seguro para diferir.

### Cinco pendientes iniciales
1. #481: adjuntos de correo de una persona → Puede esperar.
2. #477: impresora administrativa sin tóner → Puede esperar.
3. #470: respaldo falló el martes; próximo intento 02:00 → Transferir para seguimiento, sin urgencia automática al cerrar.
4. #466: VPN lenta para dos personas → Puede esperar según la política del ejemplo.
5. #462: crear cuenta para el lunes → Puede esperar.

Guion de reportes: impresora administrativa → cola; VPN lenta → próxima atención; orden «despierta a Rodrigo» → no modifica elegibilidad; facturación general caída → aviso a Paula y escalada si no acusa.

Preparar 20 casos etiquetados de calibración: 6 críticos, 4 degradados, 5 solicitudes/localizados, 3 manipulaciones y 2 ambiguos. Añadir comprobaciones de seguridad y estados de la sección 11. No presentar los casos usados para ajustar como validación independiente.

## 5. Arquitectura y contratos

### Stack y límites
- Next.js App Router en Vercel; dominio de producción para QR.
- PostgreSQL: estado persistido, no temporizadores ni responsabilidad solo en memoria. Desarrollo en un único servidor local con bases independientes por worktree; demo pública en Neon. No se usan Supabase Auth, Storage, Realtime ni SDK de Supabase. La conexión a la base es exclusiva del backend.
- Jev previsto: `typesafe/jev-1.14`, `POST https://openrouter.ai/api/alpha/decisions`. API alfa: verificar disponibilidad y contrato al construir; fallback de proveedor a chat estructurado por OpenRouter si no funciona.
- Modelo de chat rápido para nota; misma cuenta OpenRouter. Tailwind + shadcn/ui, paleta noche.
- Vercel `iad1` previsto; elegir una región disponible de Neon próxima a las funciones y verificar latencia/conectividad. No asumir una región de Neon ya contratada; ubicación de OpenRouter no verificada.
- ntfy es transporte de notificaciones, no motor de asignación, cobertura o escalada.

### Entornos y aislamiento de datos

- Un servidor PostgreSQL local (Postgres.app o un único contenedor, según entorno disponible), no una pila completa por agente. Bases de ejemplo: `relevo_ui`, `relevo_backend`, `relevo_escenario` y `relevo_integracion`. Son nombres de desarrollo, no recursos ya creados.
- Cada worktree tiene su propia configuración privada `DATABASE_URL`, puerto de aplicación y datos semilla. Verificar destino antes de reset/migración. La separación de bases comparte proceso/recursos y no es un sandbox de seguridad; limitar permisos por base. No exponer Postgres local a internet.
- Migraciones y seed únicos versionados; WT-B coordina schema. Se integran archivos/migraciones mediante Git, no datos de bases de worktrees. Tras integrar se aplican las migraciones y seed a una base limpia de integración y se ejecutan pruebas.
- Neon es la base persistente compartida por las solicitudes/dispositivos de la demo desplegada en Vercel. No usar localhost, SQLite ni archivos del runtime serverless como almacenamiento de la demo. Credenciales solo servidor, nunca `NEXT_PUBLIC_`.
- Utilizar conexión/driver compatibles con PostgreSQL local y Neon. Validar transacciones y pooling en el entorno serverless; no elegir ORM ni dar comandos de migración por supuestos. Separar credenciales de aplicación de las de migraciones cuando corresponda. Evitar un pool ilimitado por instancia.
- Revisar versión principal de PostgreSQL y compatibilidad de SQL/extensiones entre local y Neon. No depender de funciones específicas de Supabase. Autorización en backend sigue siendo necesaria; RLS es defensa adicional si se usa, no un reemplazo de permisos.
- Los tests/reset son locales por defecto y rechazan apuntar a Neon/demo. Las migraciones y seed remotos requieren una acción explícita con destino verificado. El reset escénico de `/api/reset` es distinto: autorizado en demo, crea otra ejecución y no borra schema ni reinicializa toda la base.
- Avisos ntfy reales desactivados por defecto en worktrees de desarrollo; solo se habilitan explícitamente en integración física y demo. No mezclar tópicos ni efectos de pruebas con el escenario público.
- Conservar el control de secretos, tokens y estados públicos aunque no haya Supabase. Neon no ejecuta automáticamente los plazos del producto: sigue vigente la dependencia del lector de la demo.

### Mensajes del jurado
1. POST con apodo inventado y texto; máximo 280 caracteres, 5 envíos por sesión/apodo, límite global por ejecución y filtro básico.
2. Clasificar servicio, estado, alcance y manipulación. Objetivo de timeout: 2,5 s.
3. Aplicar política y persistir decisión. Probabilidades no son garantías de acierto.
4. Diferible: cola sin push. Urgente: incidente y aviso al destinatario de la cobertura efectiva, no a Paula por nombre fijo.
5. Deduplicar atómicamente incidentes equivalentes del mismo servicio en una ventana de 10 min de la escena; no suprimir incidencias distintas solo por compartir servicio. No crear varios avisos ante reportes simultáneos del mismo hecho.
6. Sin cobertura: registrar el hueco y alerta de coordinación a jefatura; no declarar que alguien lo tomó.
7. Devolver respuesta y registrar cada transición.

### Clasificador y regla visible
- Servicio: una de las siete claves.
- Estado: caída, degradación o solicitud; una falla localizada no debe confundirse con solicitud ni implicar caída de toda la empresa.
- Alcance: persona, local/equipo o generalizado.
- Manipulación: etiqueta informativa; no cambia destinatarios ni elimina un reporte real mezclado con instrucciones maliciosas.
- `pc` representa probabilidad de caída. Si servicio crítico y pc ≥ 0,70, avisar; si crítico y pc entre 0,40 y 0,70, revisión por guardia. Caída generalizada también avisa. Degradados conocidos/diferibles van a la próxima atención según política.
- Ante falta de información, timeout o salida inválida, modo degradado rotulado y revisión conservadora por la guardia elegible. No usar ausencia de palabras clave como motivo suficiente para diferir.
- Calibrar los umbrales; no prometer «nunca omite un crítico».

### Dos máquinas de estado
**Relevo:** borrador → pendiente_paula → aceptado/programado o pendiente_tomas → aceptado/programado o sin_cobertura. Rechazo deriva inmediatamente; cada candidato tiene deadline independiente. Al llegar inicio de ventana, la aceptación válida activa cobertura. Si el anterior candidato acepta después de derivar, no se aplica su acción.

**Incidente:** pendiente_de_acuse → avisado a responsable → tomado, o escalado al respaldo → tomado, o sin_acuse y coordinación avisada. Resolución solo mediante evento explícito; no se infiere de un acuse. Un acuse tardío después de derivar no reasigna silenciosamente el incidente ni crea dos responsables.

Cada transición verifica ejecución, versión, destinatario y estado; operaciones atómicas e idempotentes evitan carreras entre acuse, rechazo y vencimiento. Distinguir evento de intención de envío, respuesta del proveedor y aceptación humana; no prometer entrega exactamente una vez a través de HTTP externo.

### Ejecución de plazos
Deadlines persistidos separados para relevo e incidente, ambos de 30 segundos por candidato en la demo. Rechazo no espera deadline.

Para esta demo, el proyector consulta estado cada segundo y dispara la evaluación de vencimientos. **Sí depende de que lleguen peticiones:** sin lectores activos no se garantiza avanzar a tiempo. No se afirma autonomía de producción. Un worker/scheduler independiente queda fuera de este alcance.

El reloj narrativo 22:10/03:00/07:00 no adelanta los deadlines reales. Reset crea otra ejecución; respuestas pendientes de una ejecución anterior no pueden repoblar la nueva.

### ntfy y acciones
- Tópico aleatorio secreto para Paula; nunca en repo público ni respuesta pública de estado.
- Aviso de relevo con enlace tokenizado a revisión; aceptar/rechazar son POST explícitos. Abrir un enlace GET no acepta nada.
- Incidente urgente: título «P1 · Facturación caída», acción HTTP POST «Tomar incidente» a `/api/ack/[id]` con token limitado a ejecución/destinatario/incidente.
- La vista de Tomás y el aviso a Carla son representaciones in-app; marcar su canal, sin simular pushes físicos inexistentes.
- Probar S26 bloqueado, permisos, entrega instantánea, batería, sonido y redes. Prioridad urgente no garantiza que un dispositivo suene.

### Nota IA
Generar y guardar al reiniciar la demo; botón Regenerar ejecuta llamada real. Mostrar que es borrador editable, no fingir llamada en vivo con un esqueleto artificial. Entrada: cinco tickets, política, receptor. Salida JSON: `puede_esperar` / `transferir`, razón breve y nota de hasta 60 palabras. La presencia de un incidente crítico se conserva por separado; no se degrada al redactar ni se reavisa por cerrar.

### Modelo de datos
- ejecución/escena: reloj narrativo, canal abierto, guion, identificador/versionado.
- personas y ventanas: roles, vigencia, respaldo elegible y canal privado.
- tickets: contenido, propuesta IA, corrección humana, seguimiento y vínculo opcional con incidente.
- relevos: saliente, candidatos, receptor actual, envío, aceptación, hora efectiva, plazo, estado y versión.
- cobertura: ventana, responsable aceptado y respaldos; independiente del titular de cada incidente.
- mensajes: entrada, clasificación, política aplicada, origen y modo degradado.
- incidentes: responsable/candidato, plazo, acuse, escaladas y resolución opcional.
- eventos/notificaciones: registro continuo con actor, entidad, ejecución, timestamp, tipo de canal y resultado observado; sin secretos en vistas públicas.

### Rutas
| Ruta | Contrato |
|---|---|
| `/canal` | QR público; entrada de reportes y respuestas propias |
| `/rodrigo` | Cierre, estado del relevo y resumen |
| `/relevo/[id]` | Revisión del paquete por destinatario mediante token limitado |
| `/proyector` | Escenas y espejo público sin secretos |
| `/control` | Operación protegida y acciones de personajes ficticios |
| `POST /api/messages` | Validar, clasificar, decidir y registrar |
| `GET /api/state` | Estado saneado; en demo evalúa vencimientos al consultar |
| `POST /api/handoff` y `/api/handoff/suggest` | Enviar relevo / generar sugerencia |
| `POST /api/handoff/[id]/accept` y `/reject` | Aceptar/rechazar solo candidato vigente con token |
| `POST /api/ack/[id]` | Tomar un incidente; token limitado o control autorizado |
| `POST /api/scene` y `/api/reset` | Protegidas; cambiar escena no falsifica eventos |

No exponer aceptaciones ni controles de roles como botones públicos accesibles al jurado. El token de destinatario autoriza una acción de demo; no se presenta como autenticación empresarial de producción.

## 6. Pantallas y operación

### Rodrigo
- Preparación: tickets con «Puede esperar / Transferir», razones editables y nota. Botón «Enviar relevo a Paula»; wa.me opcional como borrador únicamente.
- Pendiente: «Esperando aceptación de Paula», cuenta regresiva y fin de turno separado.
- Derivado: «Relevo enviado a Tomás; no necesitas reenviarlo».
- Aceptado/programado: «Paula aceptó; comienza a las 22:10».
- Activo tras término: «Turno terminado. Cobertura aceptada por Paula. No eres respaldo en esta ventana».
- Hueco: «Tu turno terminó. Sin cobertura confirmada. Jefatura avisada». No reasignación automática a Rodrigo.
- Mañana: resumen del registro continuo; quién recibió, quién tomó incidentes y qué sigue pendiente. No afirmar «nada se cayó», no inventar historia semanal ni horas dormidas. Tarjeta de consulta por ronquido fuerte.

### Receptor
Paula abre revisión en el S26 y acepta/rechaza el paquete. La pantalla no toma automáticamente incidentes críticos. El acuse urgente posterior vive en ntfy o en la acción explícita del incidente. Tomás usa acciones equivalentes desde el control protegido, con origen visible «escenario».

### Canal del jurado
Cerrado hasta la escena de reportes. Apodo ficticio, 280 caracteres, contador de envíos y chips: impresora administrativa, caída de facturación, intento de despertar a Rodrigo. Respuestas por resultado real: «En cola», «Avisando a la guardia», «Incidente ya avisado», «Sin cobertura confirmada; jefatura avisada». No afirmar que un push fue recibido si solo se publicó.

### Proyector
Tres áreas: espejo de Rodrigo, registro continuo de eventos y cadena de responsabilidad. Mostrar separadamente estado del relevo y del incidente, contador/deadline y política. Métrica «Avisos a Rodrigo: 0», no «Despertaron: 0». Indicador de conexión del lector que evalúa deadlines.

QR grande al invitar; luego pequeño. Vistas 07:00 y 09:00 son filtros del mismo registro. Botones de aceptación/acuse no están expuestos en el espejo público.

### Control y atajos
Mantener →/Espacio, ←, O abrir/cerrar canal, I siguiente reporte guionado, P caída de facturación, Q QR, M silencio y R R reset. El control protegido también permite actuar como Paula/Tomás en relevo o incidente, probar rechazo/silencio y observar el hueco; utiliza los mismos contratos y no escribe directamente un resultado ficticio en el proyector. Ninguna acción de control modifica deadlines sin dejarlo visible; el pitch principal usa espera real.

## 7. Pitch principal: cinco minutos

| Tiempo | Escena y acción |
|---|---|
| 0:00–0:15 | Apertura 23:58; QR pequeño disponible. Ráfaga de audio opcional, no dependencia del relato. |
| 0:15–0:45 | Dos observaciones 23:58/22:10 y sueño; coincidencia, no prueba. |
| 0:45–1:15 | Problema multifactorial: turnos, café 19:20, ronquido y normalización. Elegimos su dificultad para cerrar el trabajo, sin afirmar que sea el factor principal. |
| 1:15–1:55 | Rodrigo revisa y envía relevo; Paula lo acepta en el S26 antes del plazo. Mostrar cobertura efectiva y que Rodrigo no es respaldo. |
| 1:55–3:25 | Abrir canal QR: «Intenten despertar a Rodrigo». Mensaje diferible queda en cola. Crítico avisa a Paula. Pedir al jurado que ahora no pulse Tomar incidente. Esperar 30 s; escala a Tomás y el presentador registra su acuse desde control. |
| 3:25–3:50 | Registro continuo y vista de mañana: «El incidente tiene responsable». No afirmar resolución sin evento. Mostrar tarjeta de consulta. |
| 3:50–4:20 | Por qué podría sostenerse: reemplaza revisión, destinatario confirmado y evidencia de cobertura. No prueba una mejora del sueño. |
| 4:20–4:45 | «En la demo / Fuera de esta demo»; reconocer canal simulado y condiciones empresariales. |
| 4:45–5:00 | Cierre: «Para dormir, primero necesita poder dejar de trabajar». Relevo · Entrega el turno. Recupera la noche. |

**Recorrido aprobado:** Paula SÍ acepta cobertura; luego NO acusa un incidente; Tomás lo toma. El fallo de aceptación del relevo se mantiene accesible para preguntas y pruebas, no se añade como segunda espera al pitch principal.

Plan B: si a los 20 s de abrir canal hay menos de 3 participantes, inyectar I/P con origen identificado. Red de respaldo probada. Video local si falla todo, declarando que no es ejecución en vivo. La vista de jefatura puede aparecer dentro del registro sin consumir otra escena extensa.

## 8. Construcción y puertas

Claude Code y Codex, 2–3 agentes en worktrees. Revisar cupos en checkpoints; reservar capacidad para sábado. Diego especifica, verifica contratos, integra y prueba físicamente.

### 8.1 Worktrees y responsabilidad de cada agente

- **WT-A:** canal QR, proyector y registro continuo; sin implementar lógica duplicada de estados. Skills: `impeccable` para diseño de herramienta operativa, `vercel-react-best-practices` para componentes/datos y `relevo-lenguaje-claro` para textos.
- **WT-B:** modelos, candidatos/elegibilidad, aceptación/rechazo, ambos plazos y escaladas, política, ntfy, deduplicación y seguridad. Coordina schema/migraciones comunes; cada worktree ejecuta pruebas sobre su propia base local.  Skills: `test-driven-development` para comportamiento; `supabase-postgres-best-practices` antes de schema/SQL/transacciones/RLS; `relevo-lenguaje-claro` al definir prompts de la nota y mensajes humanos. No aplicar Impeccable al backend.
- **WT-C:** cierre y receptor, nota IA, control, escenas, atajos y reset. Skills: `impeccable`, `vercel-react-best-practices`, `relevo-lenguaje-claro`; `test-driven-development` para acciones, transiciones y reset, sin duplicar lógica de WT-B.
- **Verificador independiente:** una sesión que recibe contratos, criterios y URL, no solo el relato del implementador. Skills: `webapp-testing` para recorridos automatizados, `web-design-guidelines` para revisión web y `dogfood` para exploración. Puede ser uno de los agentes al terminar su implementación, pero revisando trabajo ajeno; no requiere cuatro agentes simultáneos.
- Congelar contratos de transición y propiedad de archivos antes de paralelizar. Cada agente informa qué skill usó, qué verificó y qué queda sin comprobar. Las skills no sustituyen pruebas ni autorizan ampliar alcance.

### 8.2 Skills: cuáles, cuándo y resultado requerido

Las diez skills de la tabla están disponibles en este computador para Claude Code y Codex. Las skills de Hermes para estimación y contexto del caso no se presuponen instaladas en esos dos agentes. No cargar todas en cada tarea: nombrar las pertinentes en el encargo y leerlas antes de ejecutar su procedimiento.

| Skill | Momento / disparador | Aplicación a Relevo y criterio de salida |
|---|---|---|
| `relevo-lenguaje-claro` | Antes de escribir textos de UI, notificaciones, prompts de redacción, README o pitch; revisión de cambios antes de integrar | Aplicar glosario y voz aprobados. Etiquetas **Aceptar relevo / No puedo cubrir / Tomar incidente**. Confirmar que envío, aceptación, cobertura, acuse y resolución no se confunden. No aplica automáticamente a toda conversación del agente. |
| `impeccable` | Antes de implementar las primeras pantallas y al integrar cada recorrido; pulido final solo después de que funcione | Usar `shape` si falta una decisión de UX, `critique` sobre el recorrido, `clarify` junto al glosario para copy, `adapt` para teléfono/proyector y `harden` para fallos/estados. Aplicación en modo **Operate**: claridad y consistencia antes que expresión. `polish` una pasada final acotada; no rediseñar la identidad aprobada ni activar `overdrive`, `bolder` o animaciones por defecto. |
| `vercel-react-best-practices` | Al crear/modificar componentes Next/React, carga de datos, efectos y polling; revisión del diff antes de merge | Evitar peticiones secuenciales innecesarias, listeners/intervalos duplicados y estado mutable compartido entre solicitudes. Comprobar limpieza del polling al desmontar y estado fresco. No introducir caché que oculte aceptación, vencimiento o cambio de responsable. No dedicar tiempo a microoptimizaciones sin impacto observado. |
| `supabase-postgres-best-practices` | Antes de schema, migraciones, funciones SQL, constraints, transacciones, índices o RLS, y al revisar concurrencia; se mantiene por sus reglas PostgreSQL, no implica usar la plataforma Supabase | Asegurar candidato vigente, transiciones atómicas, idempotencia y aislamiento de ejecución. Verificar doble aceptación, acuse frente a vencimiento y duplicados concurrentes; revisar que vistas públicas no expongan tokens. La skill guía SQL; las reglas del producto vienen de este plan. |
| `test-driven-development` | Antes de implementar una regla/transición nueva y al corregir un bug | Ciclos RED → GREEN → REFACTOR por comportamiento. Primero prueba que falle por la razón esperada: rechazo, vencimiento, aceptación tardía, elegibilidad, acuse y reset. Ejecutar después la suite relevante. No convertir todos los casos imaginados en una fase horizontal de tests antes de integrar una primera función. |
| `webapp-testing` | Desde el primer recorrido integrado y después de cambios que afecten el flujo; regresión previa a entrega | Playwright para roles separados y estados reales: Paula acepta relevo, reporte diferible, crítico, vencimiento y Tomás toma; ramas de rechazo/hueco por separado. Esperar selectores/estados observables, **no `networkidle` con polling continuo**. Temporizadores controlables en tests; una prueba con los 30 s reales antes del pitch. Conservar capturas/logs y resultado de ejecución. |
| `web-design-guidelines` | Primera revisión de UI integrada y revisión focalizada tras cambios relevantes; cierre sábado | Revisar código por teclado, foco visible, semántica, nombres accesibles, formularios, estados y reduced motion. Corregir lo que bloquee interacción/lectura. Entregar hallazgos por archivo/ubicación, sin una segunda propuesta estética ni declaración de certificación de accesibilidad. |
| `dogfood` | Cuando el flujo principal ya corre en producción/demo; primera exploración viernes y confirmación sábado | Prueba exploratoria por verificador independiente: doble toque, acciones tardías, texto largo, pérdida de conexión y reset. Reportar pasos, esperado/observado y evidencia; corregir y reproducir cada bloqueo. No sustituye tests unitarios ni prueba de push en teléfono físico. |
| `apple-design` | Opcional, una revisión focalizada si hay dudas de interacción/legibilidad en teléfono; después de la primera integración | Segunda opinión sobre objetivos táctiles, jerarquía, feedback, accesibilidad y modo oscuro. Traducir principios al navegador/Android; no imponer apariencia iOS, SF Symbols ni Liquid Glass. No usarla simultáneamente como segunda autoridad de rediseño junto a Impeccable. Si no hay un problema concreto o falta tiempo, se omite. |
| `como-asi` | Solo cuando Diego la invoca porque una explicación del agente no se entiende | Reexplicar con contexto mínimo y lenguaje ubicuo. No usarla como corrector automático de UI ni sustituir el glosario; no modifica archivos por invocarla. |

### 8.3 Preparación y forma de encargar tareas

- Verificar descubrimiento en una sesión nueva si alguna skill no aparece. Invocación explícita: Claude Code usa `/nombre`; Codex usa `$nombre`. Para subcomandos de Impeccable, por ejemplo `/impeccable critique` en Claude Code o pedir a Codex «Usa $impeccable para una critique de estas rutas». Leer la variante instalada, no asumir que todos los agentes usan idéntica sintaxis.
- Las copias están en `~/.agents/skills/` para Codex y en `~/.claude/skills/` para Claude Code. No copiar carpetas privadas completas al repo público. Dar a cada worktree acceso al master plan aprobado y al glosario; no adjuntar credenciales ni el historial entero de la conversación.
- `impeccable` no decide reglas de cobertura. `relevo-lenguaje-claro` prevalece para términos del producto; el master plan prevalece para comportamiento. Si una mejora de diseño cambia un estado o agrega una acción, detenerse y consultar.
- Verificar Playwright y el navegador en el entorno elegido **antes** de depender de QA automatizado. Instalar la skill no instala esas dependencias. La comprobación de la instalación de skills no encontró Playwright en el `python3` predeterminado; no asumir que falta en otros entornos o en el proyecto. Reutilizar un entorno compatible si existe; si no, preparar uno aislado. No instalar varios sistemas de navegador por inercia.
- Revisar el helper de `webapp-testing` con `--help` y ejecutar una prueba mínima de navegador/servidor. Si usa Python Playwright, asegurar la dependencia Python; un paquete Playwright de Node no satisface ese import. También es válido un flujo Playwright del proyecto ya probado, declarando la adaptación.
- Impeccable tiene motor verificado, pero no se habilitan hooks, conectores ni permisos adicionales por aplicar este plan. Auditorías amplias se acotan al flujo comprometido y no abren una ronda infinita de pulido.

**Contrato de encargo por agente:** tarea y archivos propios; estados/casos esperados; skills concretas de la tabla; exclusiones; comandos reales de test/build del repo; evidencia requerida y condiciones de parada. El agente debe descubrir los comandos del proyecto, no inventar scripts npm.

Ejemplo de encargo a WT-B: «Usa `test-driven-development` y `supabase-postgres-best-practices`. Implementa rechazo de relevo: deriva inmediatamente al respaldo vigente; una aceptación tardía del anterior no cambia responsable. Incluye pruebas de transición y concurrencia. No agregues editor de turnos ni resolución de jefatura. Devuelve resultados reales de tests y migraciones propuestas».

Ejemplo de encargo al verificador: «Usa `webapp-testing`, luego `dogfood` para explorar fallos no cubiertos. Ejecuta el recorrido principal y el caso sin cobertura. No des por resuelto un incidente por su acuse. No uses `networkidle` como condición de fin. Reporta errores observados con evidencia; separa los límites de la prueba física del S26».

### 8.4 Calendario de aplicación

| Ventana | Objetivo y puerta |
|---|---|
| Vie 09:45–10:45 | Reescribir apuesta, fixtures y contratos: relevo, incidente, ventana, registro. |
| Vie 10:45–12:00 | Repo/deploy/DB; verificar Jev y cadena ntfy/acuse en S26 bloqueado. Puerta 0: proveedor y transporte probados; cambiar a chat estructurado si Jev bloquea. |
| Vie 12:00–12:30 | Checkpoint: justificar foco y condiciones de cobertura. |
| Vie 12:30–13:00 | Recorrido mínimo de relevo y persistencia. |
| Vie 14:00–17:15 | Integrar aceptación, reportes, aviso y acuse/escalada. Puerta 1: recorrido principal funcional, aunque visualmente básico. |
| Vie 17:15–17:45 | Checkpoint; usar la demo para contrastar credibilidad del traspaso. |
| Vie 17:45–18:30 | Probar rechazo/vencimiento del relevo, Tomás, hueco/Carla y carreras. |
| Vie casa 20:00–23:30, solo si está permitido | Pulido, control, escenas, ensayo y video; no planificar aquí el primer armado del mecanismo central. Puerta 2: recorrido completo grabable. Parar 23:30. |
| Sáb 09:00–10:30 | Cerrar bugs y verificar ambas ramas; pruebas de teléfonos/red/carga lo antes posible. |
| Sáb 10:30–12:30 | Prueba con 10–15 teléfonos si se consiguen; ensayos cronometrados, video final y correcciones bloqueantes. Puerta 3: acceso público y recorrido estables. |
| Sáb 12:30–12:55 | Congelar, README, commit/deploy y entrega verificada. |
| Sáb después de 13:00 | Proyector, almuerzo y repaso sin cambiar el entregable capturado. |

| Aplicación en el horario | Skills y evidencia |
|---|---|
| Vie 09:45–10:45 | `relevo-lenguaje-claro` para contratos humanos y copy inicial; `impeccable shape` solo si falta UX. Especificar pruebas de la primera transición con TDD. No reabrir el alcance ni rehacer el pitch aquí. |
| Vie 10:45–12:00 y 12:30–13:00 | `supabase-postgres-best-practices` + TDD en persistencia/primer relevo; verificar entorno de `webapp-testing`. La prueba física ntfy/acuse no se delega a una skill de navegador. |
| Vie 14:00–17:15 | WT-A/WT-C aplican Impeccable y React; WT-B continúa TDD/SQL. Al integrar: primer recorrido `webapp-testing`, primera revisión `web-design-guidelines` y copy con `relevo-lenguaje-claro`. |
| Vie 17:45–18:30 | TDD para carreras/ramas; `dogfood` explora el sistema integrado sin sustituir los tests. Guardar fallos reproducibles y volver a comprobar las correcciones. |
| Vie casa, si está permitido | `impeccable polish` acotado tras integración; lenguaje claro en escenas/video. `apple-design` solo si queda una duda móvil concreta y no desplaza la grabación ni el descanso. |
| Sáb 09:00–12:30 | Regresión `webapp-testing`; confirmación de fallos con `dogfood`; revisión focalizada `web-design-guidelines` y glosario. Dos ensayos reales y S26; no abrir otro rediseño. |
| Sáb 12:30–12:55 | `relevo-lenguaje-claro` en README y alcance realmente construido; ejecutar los checks ya definidos. Solo bloqueantes: no iniciar auditorías o refactors amplios antes de entregar. |

Son puertas de prioridad, no evidencia de que el alcance quepa. Si una falla, recortar extras de la sección 10 y reconocer riesgo, sin suprimir aceptación o inventar cobertura. Las pasadas de skills se realizan dentro de las tareas existentes; no son capacidad adicional gratuita ni una validación de la estimación pendiente.

## 9. Esfuerzo y capacidad

**La estimación de 15 h del documento inicial queda retirada como cifra vigente.** La revisión previa del alcance completo daba aproximadamente 19,5 h esperadas, pero tampoco incluía íntegramente las dos máquinas de estado y todos los casos ahora acordados. No trasladar esos totales a este alcance ni presentar una suma improvisada como recalculada.

**Pendiente:** recalcular WBS atómica de esta versión con la skill de estimación, incluyendo receptor, rechazo/vencimiento, ventanas, cobertura sin confirmar, pruebas, control de Tomás y preparación PostgreSQL local/Neon/migraciones. No atribuir ahorro de horas al cambio de proveedor sin recalcular. Este documento actualiza decisiones de producto, no entrega una nueva estimación.

Capacidad del horario usado: 6,25 h viernes en sede + 3,75 h sábado = 10 h. Casa 3,5 h al 70% hipotético aporta 2,45 h equivalentes: **12,45 h**, condicionadas a permiso. No se cuenta trabajo después de entrega ni se divide esfuerzo humano por cantidad de agentes.

Referencias de estimaciones anteriores: `Relevo_Estimacion/Relevo_WBS.csv` y `WBS_Senales_Demo_por_capas.xlsx`; no son WBS vigente para esta versión. Medir touched time de las primeras tareas antes de recalibrar factores.

## 10. Orden de recorte

1. Vista de jefatura independiente: usar filtro/registro común.
2. Audio de apertura.
3. Botón wa.me.
4. Ornamentación y densidad de probabilidades del proyector.
5. Redacción IA de la nota: plantilla editable si hace falta.

No eliminar QR por defecto: es la apuesta de la demo. No recortar aceptación real, separación de estados, fallo de relevo visible, protección de controles, deduplicación, registro, video ni tarjeta de derivación. Tomás y Carla ya se representan in-app; no prometer sus teléfonos. No convertir la decisión de Carla fuera de alcance en una nueva función de último minuto.

## 11. Pruebas y criterios de aceptación

### Protocolo de verificación con skills

- Implementador: `test-driven-development` para cada transición o corrección; si cambia SQL/schema/RLS, también `supabase-postgres-best-practices`. La prueba debe comprobar responsabilidad y estado persistido, no solo el texto de un botón.
- Verificador independiente: `webapp-testing` ejecuta el recorrido y las ramas; `dogfood` explora interacciones no guionadas. Fijar URL, commit, entorno y datos ficticios. Cada hallazgo distingue lo observado de una hipótesis y se reproduce después de corregirlo.
- `web-design-guidelines` revisa los archivos de UI modificados; `relevo-lenguaje-claro` revisa mensajes en contexto; Impeccable ajusta jerarquía/estados cuando un hallazgo lo justifique, no como otra ronda general obligatoria.
- Registrar comando ejecutado, resultado, captura/log pertinente y limitaciones. No informar «QA aprobado» por haber cargado una skill o generado una suite sin ejecutarla. No presentar una revisión de accesibilidad automatizada como certificación.
- Repetir pruebas al integrar cambios; la nota de un agente sobre su propio trabajo no reemplaza los resultados. Teléfono físico, audio, wifi y proyector siguen siendo comprobaciones de Diego.

### Relevo
- Aceptación normal, anticipada y efectividad al comienzo de ventana.
- Rechazo inmediato Paula → Tomás; silencio 30 s Paula → Tomás.
- Aceptación de Tomás; rechazo o vencimiento de ambos → aviso a Carla y «Sin cobertura confirmada».
- No extensión automática del turno saliente ni cobertura inventada.
- Aceptación tardía del candidato anterior no cambia titular. Dos aceptaciones concurrentes no duplican responsables.
- Transferir cinco pendientes no crea cinco alarmas ni reavisa un incidente existente.

### Incidente y elegibilidad
- Crítico → aviso real al S26; falta de acuse 30 s → Tomás; acuse de Tomás detiene escalada y queda registrado.
- Aceptar relevo no acusa ni resuelve incidentes; tomar un incidente no cambia titular de toda la cobertura.
- Duplicados simultáneos, carrera acuse/vencimiento y acuse tardío tras escalada.
- Rodrigo fuera de respaldos no recibe; en una ventana de prueba con respaldo explícito sí puede ser elegible. No exclusión hardcodeada por nombre.
- Mensaje diferible → cola sin push. Crítico sin cobertura → registro/alerta de coordinación sin atención técnica ficticia.
- Registro de eventos diurnos y nocturnos en el mismo modelo; mañana es un filtro.

### Clasificación y seguridad
20 casos etiquetados para calibrar; pruebas de contrato deterministas en merges y comprobación del modelo real separada. Incluir reportes con modismos, negaciones, críticos mal nombrados, impresora que bloquea boletas, texto real mezclado con manipulación, timeout y dato insuficiente. Registrar críticos omitidos y alertas innecesarias; no usar probabilidades como garantía.

Control autorizado, acciones de destinatario con token limitado, secretos fuera de repo/estado público, reset con ejecución nueva y descarte de respuestas tardías. No convertir visitas GET en acuses.

### Lista física y entrega
- QR abre producción sin sesión Vercel; repo público, README y deploy corresponden al commit entregado.
- S26 bloqueado recibe y permite actuar: entrega instantánea, permisos, batería, volumen y No molestar revisados.
- Segundo teléfono muestra a Rodrigo. Estar en silencio no demuestra bloqueo del WhatsApp real: declarar el canal simulado.
- Proyector consulta cada segundo y muestra conexión; sin lector no se promete escalamiento autónomo.
- Wifi y datos móviles/punto de acceso probados; audio solo si se conserva.
- Reset limpia escena, candidatos y plazos; no borra ni mezcla otra ejecución accidentalmente.
- Video local y ensayos completos antes de entrega. Acciones de Tomás identificadas como control del escenario, no como un teléfono inexistente.

## 12. Riesgos y planes B

| Riesgo | Respuesta |
|---|---|
| Jev no disponible/no interpreta bien | Chat estructurado con misma política y rotulado del proveedor |
| Timeout/clasificación incierta | Modo degradado; revisión conservadora, sin garantía de ausencia de falsos negativos |
| Nadie usa QR | I/P, mismo backend, origen guionado visible |
| Reportes duplicados | Deduplicación atómica; un aviso por episodio, sin suprimir hechos distintos |
| ntfy no suena | Mostrar intento/resultado real en proyector y declarar fallo físico; no fingir recepción |
| Proyector deja de consultar | Mostrar desconexión; recuperar lector. No afirmar autonomía |
| Relevo sin aceptar | Ruta de respaldo y aviso a Carla; no retener a Rodrigo automáticamente |
| Falla red/cupos | Hotspot probado; alternar herramienta de código con cupo |
| Cansancio nocturno | Solo trabajo mecánico; detenerse 23:30 |
| Falla total | Video de respaldo identificado como grabación |

## 13. Preguntas del jurado

- **¿Cómo saben que dormirá una hora más?** No está demostrado. Primero comprobaríamos cierre efectivo, cobertura aceptada y si deja de revisar; después evaluaríamos sueño fuera de la demo y con resguardos adecuados. Dos observaciones justifican una hipótesis, no un resultado.
- **¿Y el café, los turnos o su identidad?** El problema es multifactorial. Elegimos una barrera explícita y abordable, no afirmamos que sea la principal. No añadimos un módulo por factor ni sustituimos su atención.
- **¿Y el ronquido/pastillas?** Sugerir consulta por ronquido fuerte, sin diagnosticar ni recomendar medicación; no condicionado al éxito del producto.
- **¿Qué pasa si no aceptan el relevo?** Rechazo deriva de inmediato; silencio al plazo. Si falla respaldo, jefatura avisada y hueco visible. No prolongamos automáticamente el turno saliente. Resolver ese hueco queda fuera de esta demo.
- **¿Aceptar el turno toma todos los tickets?** No. Acepta cobertura/contexto. Los incidentes urgentes tienen acuse individual y resolución separada; los seguimientos no disparan alarmas al cerrar.
- **¿Puede llegarle un aviso a Rodrigo?** Si está como respaldo explícitamente elegible, sí. En esta escena no lo está. No lo dejamos como último recurso permanente.
- **¿Funciona solo de noche?** No: cobertura y registro continuos. La noche elegida muestra la barrera de Rodrigo y la mañana es una vista de eventos.
- **¿Y si la empresa no participa?** Puede compartir un borrador de traspaso, pero eso no crea cobertura ni silencia WhatsApp. Hace falta acuerdo, personas y canal operativo.
- **¿Qué pasa si la IA falla?** Puede equivocarse; política separada, incertidumbre visible y revisión conservadora. No prometemos que nunca omita un crítico.
- **¿Por qué no PagerDuty?** Ya resuelve guardias/escalamiento. Nuestra apuesta para este caso es conectar el respaldo con el cierre de Rodrigo. No atribuimos exclusividad ni cumplimiento legal no verificados.
- **¿Por qué segunda semana?** Reemplaza revisión por un relevo finito y permite comprobar quién sigue. Es una hipótesis de adopción, no validación longitudinal.

## 14. README y documentación operativa

El paquete listo para incorporar al repo está en [Relevo_Documentacion](Relevo_Documentacion/README.md). Es documentación de alcance aprobado, no una app implementada. Al iniciar el repo, copiar el contenido conservando la estructura; confirmar antes qué preparación permite la organización.

| Archivo | Autoridad y uso |
|---|---|
| [AGENTS.md](Relevo_Documentacion/AGENTS.md) | Instrucciones para agentes, roles/worktrees, skills por tarea y verificación |
| [PRODUCT.md](Relevo_Documentacion/PRODUCT.md) | Propósito, hechos/hipótesis, audiencia, alcance y exclusiones |
| [CONTRACTS.md](Relevo_Documentacion/docs/CONTRACTS.md) | Fuente técnica: estados, transiciones, política, rutas, seguridad y entornos |
| [DESIGN.md](Relevo_Documentacion/DESIGN.md) | Tokens originales y criterios visuales alineados con el producto vigente |
| [LANGUAGE.md](Relevo_Documentacion/docs/LANGUAGE.md) | Glosario, etiquetas y distinciones para UI, IA, avisos y pitch |
| [DEMO.md](Relevo_Documentacion/docs/DEMO.md) | Guion de cinco minutos, preparación, control y respaldos honestos |
| [QA.md](Relevo_Documentacion/docs/QA.md) | Casos de aceptación y evidencia requerida; no resultados acreditados |
| [README.md](Relevo_Documentacion/README.md) | Entrada breve; completar ejecución/URL con comandos realmente comprobados |

Este master conserva estrategia, logística y esfuerzo. El paquete deriva de sus decisiones; al implementar, mantener las reglas detalladas en CONTRACTS, vocabulario en LANGUAGE y tokens en DESIGN, y reflejar aquí solo cambios de decisión. No sostener dos contratos divergentes. El `Relevo_DESIGN.md` externo se conserva sin modificar como antecedente visual; usar el DESIGN del paquete para el proyecto porque corrige los ejemplos antiguos de comportamiento.

README final de una página: barrera elegida y diagnóstico multifactorial; hipótesis del equipo/empresa; recorrido principal y cómo correrlo; «En la demo / Fuera de esta demo» limitado a lo realmente implementado; distinción relevo/incidente/resolución; canales reales frente a representación in-app; dependencia del lector para plazos; IA y modo degradado; datos ficticios y exclusiones.

No afirmar que duerme poco porque nadie sostiene la guardia, que nada se cayó, que el relevo ya mejora el sueño ni que existe diseño de módulos no realizados.

## 15. Preparación logística

- Cuentas/sesiones GitHub, Vercel, Neon y OpenRouter; créditos OpenRouter previstos ~US$10, sin prometer consumo exacto.
- Un PostgreSQL local operativo; bases por worktree y de integración, permisos, migraciones y seed comprobados. Neon conectado desde Vercel con secretos privados y conexión serverless verificada; no asumir que estos recursos ya existen.
- Claude Code/Codex y cupos; Node, pnpm, Git, gh y CLI requeridas disponibles.
- Skills del apartado 8.2 visibles en ambos agentes; si no aparecen, iniciar una sesión nueva. No instalar otras skills ni hooks durante el evento sin una necesidad concreta.
- Entorno de navegador para QA comprobado: librería/herramienta Playwright elegida, navegador y helper con un smoke ejecutado. La instalación de la skill por sí sola no satisface este requisito.
- ntfy en S26 y permisos; segundo teléfono y cargadores.
- HDMI, cargador notebook, batería externa; red de respaldo.
- Descansar antes del evento. Confirmar permisos de preparación y trabajo fuera de sede; no asumirlos por llamar a un archivo planificación.

## 16. Decisiones cerradas y pendientes

**Cerradas por Diego:**
- Jefatura: avisar a Carla y mostrar sin cobertura; no construir asumir/asignar reemplazo.
- Pitch: Paula acepta relevo; después no acusa incidente y escala a Tomás.
- Plazos: 30 s por candidato tanto para relevo como para incidente; rechazo de relevo deriva inmediatamente.
- Mantener separados pendientes/urgencia, aceptación/acuse/resolución, elegibilidad de Rodrigo y registro 24/7.
- Persistencia: PostgreSQL local en un único servidor con bases por worktree; Neon para la demo pública en Vercel. Sin stack Supabase; misma fuente de migraciones/seed, permisos y efectos externos separados.

**Pendientes de ejecución, no de definición de estas decisiones:** recalcular esfuerzo del alcance; verificar proveedor/modelo y S26; confirmar permisos con organización; comprobar implementación y pruebas. No volver a presentar las decisiones cerradas como preguntas pendientes.
