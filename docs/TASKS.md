# Relevo · Tareas para implementar en worktrees

Documento de ejecución preparado el 23-10-2026. Cada tarea corresponde a un worktree y un prompt nuevo. Las tareas están **PENDIENTES**: esta descomposición no acredita implementación, pruebas ni disponibilidad de servicios.

## 1. Punto de partida y fuentes

Existe Next.js App Router con TypeScript, Tailwind, configuración de shadcn, Prisma 7 y Playwright. No hay modelos de negocio, migraciones, seed ni recorrido operativo. [SETUP](SETUP.md) registra lo comprobado y sus límites; la conectividad PostgreSQL, OpenRouter, Neon/Vercel, ntfy y S26 requiere evidencia propia.

Al preparar este documento, los materiales y la base técnica aparecen sin seguimiento en Git, sobre un commit inicial. Un worktree creado desde ese commit no los recibe. T00 debe establecer una base versionada antes de distribuir encargos. La autorización para crear este documento no autoriza ejecutar los encargos.

Fuentes de verdad, en este orden por materia:

- [AGENTS](../AGENTS.md): instrucciones, permisos, skills y forma de trabajo.
- [PRODUCT](../PRODUCT.md): propósito, audiencia, alcance y exclusiones.
- [CONTRACTS](CONTRACTS.md): comportamiento y límites técnicos; C01–C09 son referencias usadas abajo.
- [DESIGN](../DESIGN.md) y [LANGUAGE](LANGUAGE.md): identidad, componentes y contenido humano.
- [QA](QA.md) y [DEMO](DEMO.md): aceptación, evidencia y operación del pitch.
- [Master plan](../Relevo_Master_Plan.md): estrategia, prioridades, recortes y logística. No copiar aquí sus reglas como un segundo contrato.

La frase histórica de QA «No hay package.json, aplicación…» quedó superada por la inicialización registrada al final de QA y en SETUP. No invalida sus casos funcionales pendientes. Las rutas antiguas a `Relevo_Documentacion/` del master son antecedentes del paquete: usar los documentos presentes. Una contradicción vigente de comportamiento requiere consulta con recomendación; una referencia histórica no requiere reabrir decisiones cerradas.

## 2. Cómo lanzar, integrar y verificar encargos

### Worktrees y propiedad

El integrador mantiene una rama de integración y registra el SHA base, dependencias integradas, responsable, puerto, nombre no secreto de base, estado y evidencia de cada tarea. T00 crea `docs/INTEGRATION.md` para ese registro. No se trabaja en paralelo directamente sobre main.

Cada rama se llama `codex/tXX-descripcion`, según el mapa. Crear su worktree desde un SHA de integración que ya contenga todas las dependencias. El integrador verifica el diff y las pruebas antes de integrar; los agentes no hacen commit, merge ni push sin autorización del encargo concreto. La falta de esa autorización permite entregar cambios revisables, pero bloquea distribuirlos como una base Git integrada.

Máximo tres worktrees de tareas activos a la vez; no hay que ocuparlos siempre. Carriles de responsabilidad:

| Carril | Responsabilidad | Tareas habituales |
|---|---|---|
| A | Canal, proyector y registro visual | T04, T14, T15 |
| B | Persistencia, reglas, autorización y avisos | T01, T03, T05–T08, T10 |
| C | IA de nota, cierre, receptor y operación | T02, T09, T11–T13, T16–T17 |
| Verificación | Revisar trabajo ajeno con fuentes y evidencia | T18–T22; reutilizar un agente que terminó |

Los carriles no son ramas permanentes ni obligan a conservar un mismo agente. El responsable de schema/migraciones es único durante todo el trabajo, aunque cierre T03. Ningún otro encargo altera `prisma/` sin coordinar una modificación con él.

Las rutas de archivos nuevas indicadas abajo son asignaciones propuestas; T01 fija la organización exacta en INTEGRATION antes del paralelo. Si el código integrado usa otro nombre, el integrador actualiza el registro antes de lanzar la tarea. No crear implementaciones alternativas por una diferencia de nombres.

Archivos compartidos (`package.json`, lockfile, `.env.example`, contratos, lenguaje y configuración) tienen un solo escritor a la vez. Cada tarea puede proponer el cambio necesario; el integrador lo incorpora antes de lanzar dependientes. Cada agente escribe evidencia en `docs/evidence/TXX.md`; el integrador consolida QA, CONTRACTS y LANGUAGE. Los contratos nuevos de T01 se documentan directamente en CONTRACTS y código, no en TASKS.

### Entornos y efectos externos

Un único servidor PostgreSQL local, con una base y credenciales limitadas por worktree y otra de integración. Registrar también puertos de desarrollo y E2E distintos. No copiar `.env` entre worktrees ni publicar conexiones. Integrar migraciones y seed por Git, nunca datos de otra base.

Push real desactivado por defecto. Toda prueba externa identifica destino, ejecución y autorización; no basta aislar Git o DB. Migración/seed remotos, publicación y envíos físicos requieren autorización explícita del encargo y destino comprobado. Preparar primero lo comprobable localmente. Si falta acceso, registrar BLOCKED en esa prueba y continuar lo independiente; no presentar un mock como integración aprobada.

### Comandos y evidencia comunes

Los prompts de abajo son copiables por separado y remiten a esta sección como parte obligatoria del encargo. En cada sesión se leen AGENTS, PRODUCT y CONTRACTS; después solo las fuentes específicas indicadas. Antes de escribir código Next, leer la guía pertinente en `node_modules/next/dist/docs/`.

Comandos existentes al preparar este documento:

| Perfil | Comandos y condición |
|---|---|
| Preparación | Node 24 y pnpm 12; `pnpm install --frozen-lockfile` si faltan dependencias |
| Base | `pnpm db:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm build` |
| Prisma | `pnpm db:validate`, `pnpm db:generate`; `pnpm db:check` solo con base privada elegida |
| Navegador | `pnpm build`, `pnpm test:e2e`; `E2E_PORT` único. Preparar Chromium o canal Chrome comprobado según SETUP |
| Desarrollo | `pnpm dev --port <puerto-asignado>`; producción local con `pnpm start` y puerto configurado |

No existe todavía comando unitario, de migración o seed. T03 debe introducir y documentar los comandos reales de pruebas de dominio/integración y preparación local; las tareas posteriores usan lo que encuentre en el manifest integrado. No inventar nombres de scripts ni usar `db push` o reset de Prisma como atajo. No ejecutar operaciones destructivas sin comprobar la protección de destino.

Para reglas y bugs: RED → GREEN → REFACTOR por comportamiento. Mocks verifican límites controlados; carreras y persistencia requieren PostgreSQL real. Cambios de UI requieren inspección renderizada. Playwright espera estados/elementos, nunca `networkidle` con polling; revisar `--help` del helper de webapp-testing si se utiliza y comprobar sus dependencias.

Cada entrega incluye diff/archivos, interfaces producidas, comandos y resultado real, casos QA cubiertos, entorno/base no secreta, SHA base y SHA final si existe, ID de ejecución, pasos/esperado/observado, capturas o logs saneados y pendientes. Usar PASS, FAIL, BLOCKED o NO EJECUTADO. No volcar tokens ni credenciales. Tests creados no significan tests ejecutados.

Condición común de parada: dependencia no integrada, conflicto de comportamiento, necesidad de tocar archivos ajenos o efecto externo no autorizado. Delimitar el bloqueo, proponer solución y continuar únicamente el trabajo independiente. No ampliar alcance, instalar servicios/hooks ni habilitar permisos por recomendación genérica de una skill.

## 3. Mapa de tareas y paralelo

Una dependencia significa **cambios integrados y contrato utilizable**. Una subprueba física bloqueada se registra aparte: permite integrar código comprobado localmente si el integrador acepta ese límite, pero no satisface las puertas externas.

| ID / sufijo de rama | Resultado | Depende de | Paralelo permitido / puerta |
|---|---|---|---|
| T00 `base-integracion` | Base versionada y registro | — | Primero; habilita worktrees con contenido real |
| T01 `contratos` | Interfaces y decisiones técnicas compartidas | T00 | Serial; habilita desarrollo dependiente |
| T02 `openrouter` | Adaptador y comprobación de proveedor | T01 | Con T03/T04; prueba externa diferenciada |
| T03 `persistencia` | Schema, migraciones, seed y pruebas locales | T01 | Con T02/T04; único escritor Prisma |
| T04 `componentes` | Componentes compartidos y estructura visual | T01 | Con T02/T03; congela componentes antes de pantallas |
| T05 `seguridad-eventos` | Autorización, validación y eventos | T03 | Tras persistencia; habilita motores |
| T06 `relevo` | Motor de relevo y cobertura | T05 | Con T07–T09 si no comparten archivos |
| T07 `clasificacion` | Clasificación y política | T02, T05 | Con T06/T08/T09; sin rutas públicas aún |
| T08 `avisos` | Transporte ntfy/in-app y prueba S26 | T05 | Con T06/T07/T09; no decide asignación |
| T09 `nota` | Propuestas y nota editable | T02, T05 | Con motores; no modifica adaptador de T02 |
| T10 `incidentes` | Acuse, escalada y deduplicación | T06, T07, T08 | Con T09; termina motores operativos |
| T11 `ejecucion` | Escenas, reset, estado y plazos | T06, T09, T10 | Serial para ensamblado; conecta avisos de relevo |
| T12 `cierre` | Cierre y envío de Rodrigo | T04, T06, T09, T11 | Con T13/T14/T15; máximo tres activos |
| T13 `receptor` | Revisión del destinatario | T04, T06, T11 | Con otras superficies, archivos separados |
| T14 `canal` | API pública, límites y canal | T04, T07, T10, T11 | Con otras superficies |
| T15 `proyector` | Estado, QR y registro visual | T04, T11 | Con otras superficies |
| T16 `control` | Control protegido y atajos | T04, T11 | Con T12–T15, sin editar sus archivos |
| T17 `resumen` | Resumen, mañana y consulta | T12, T15 | Después de ambos; reserva `/rodrigo` |
| T18 `regresion` | Verificación integrada y correcciones bloqueantes | T12–T17 | Verificador ajeno a lo revisado; sin cambios paralelos |
| T19 `accesibilidad` | Accesibilidad y robustez visual | T18 | Serial; una pasada acotada |
| T20 `despliegue` | Neon/Vercel y acceso público | T19 | Acciones remotas solo autorizadas |
| T21 `ensayo` | Regresión desplegada, S26 y video | T20 | Congelar mientras se ensaya |
| T22 `entrega` | Evidencia, README y entrega | T21 | Cierre; verificar artefactos exactos |

Orden sugerido con tres puestos: T00 → T01 → (T02/T03/T04). Cuando termina T03, T05 puede ocupar su puesto sin esperar tareas independientes. Después, priorizar T06/T07/T08; T09 ocupa el primer puesto libre y puede coincidir con T10. Tras T11, lanzar T12/T13/T14; al liberar puestos, T15/T16. T17 espera T12 y T15. Finalmente T18 → T19 → T20 → T21 → T22. No abrir todos los worktrees por adelantado ni sustituir dependencias por mocks en integración.

## 4. Encargos listos para copiar

### T00 · Base para distribuir el trabajo

```text
Implementa T00 de docs/TASKS.md en codex/t00-base-integracion; aplica su sección 2.
Objetivo: establecer una base Git que contenga los materiales y la inicialización, y un registro operativo sin secretos.
Lee AGENTS, PRODUCT, CONTRACTS C01, SETUP y el master §8.3; usa relevo-lenguaje-claro para documentación.
Dependencias: ninguna. Antes de crear el worktree, inspecciona el checkout actual: los archivos sin seguimiento no viajarán con Git.
Propiedad: docs/INTEGRATION.md y docs/evidence/T00.md. Inventaría los archivos existentes; no implementes funciones ni reescribas la base.
Registra rama integradora, SHA, tareas, escritores de archivos comunes, puertos y nombres no secretos de bases. Comprueba herramientas, servidor PostgreSQL y navegador disponibles; no cierres procesos ajenos ni instales otra pila.
Solicita autorización concreta para incorporar/versionar los archivos si no existe ya en el encargo. Sin ella entrega inventario y diff revisables; no declares lista la distribución por worktrees. Tras autorización, excluye secretos y artefactos antes del commit de base.
Aceptación: un worktree desde el SHA aprobado recibe fuentes, lockfile y base técnica; no contiene .env ni claves. Registro distingue recursos existentes de propuestos.
Pruebas: perfil Base y smoke Navegador cuando esté disponible; inspección Git de archivos incluidos. No dar DB por conectada sin db:check contra destino elegido.
Entrega inventario, SHA realmente obtenido, comandos, evidencia y bloqueos. Detente antes de commit/publicación no autorizados o colisiones de recursos.
```

### T01 · Contratos que permiten paralelizar

```text
Implementa T01 en codex/t01-contratos; aplica docs/TASKS.md §2 y verifica T00 integrada.
Lee AGENTS, PRODUCT, CONTRACTS completo y QA R/I/A/S; master §5 solo como contexto. Usa relevo-lenguaje-claro; supabase-postgres-best-practices para diseño persistente y TDD si incorporas validadores ejecutables.
Propiedad: src/lib/contracts/, docs/CONTRACTS.md, registro de propiedad en docs/INTEGRATION.md y evidencia T01. No implementes motores ni Prisma.
Congela nombres de entidades y DTO, entradas/salidas de rutas C08, errores/status, identidad de ejecución, versión/candidato, idempotencia y reloj operacional/narrativo. Define interfaces entre autorización, eventos, relevo, clasificación, incidentes, avisos y escenas.
Fija expiración/alcance de tokens, autorización de Rodrigo/control, sesión pública y protección de origen/CSRF. Fija límite global de reportes y mecanismo que impida eludir cuotas solo cambiando apodo. Especifica equivalencia del mismo hecho y borde de 10 min sin colapsar todo un servicio. Registra las decisiones en CONTRACTS; consulta contradicciones de producto, sin reabrir lo ya aprobado.
Incluye DTO públicos separados de vistas privadas de actor: el estado saneado no expone paquetes privados, tokens o tópicos. Define interfaces de repositorio y preparación de fixtures para probar motores antes de T11.
Reserva en INTEGRATION los directorios indicados en TASKS y los archivos comunes; cada componente/API debe tener dueño. Una firma de avisos admite implementación de pruebas hasta integrar transporte real.
Aceptación: ejemplos tipados de cada ruta y error; contratos consumibles por T02/T03/T04 sin decisiones incompatibles pendientes. Compilación sin imports de servidor en DTO cliente.
Pruebas: perfil Base; pruebas de validadores si existen. Entrega decisiones, ejemplos, propiedad y límites. Detente si una decisión cambia alcance o no puede resolverse con las fuentes vigentes.
```

### T02 · OpenRouter verificable

```text
Implementa T02 en codex/t02-openrouter; aplica docs/TASKS.md §2 y verifica T01 integrada.
Lee AGENTS, PRODUCT, CONTRACTS C03/C05/C09, LANGUAGE y QA A05–A07. Usa TDD para fallos y relevo-lenguaje-claro para prompts/mensajes; consulta documentación oficial actual del proveedor.
Propiedad: src/lib/server/providers/openrouter/, tests/providers/openrouter/ y evidencia T02. Cambios de variables/manifest se coordinan con integrador. No escribas política, nota de negocio ni Prisma.
Produce el adaptador servidor de salida estructurada acordado en T01, con timeout/cancelación, validación y errores explícitos. T07 y T09 consumirán este adaptador sin modificarlo en paralelo.
Comprueba disponibilidad y contrato de typesafe/jev-1.14 por Decisions API; si no es viable, verifica chat estructurado y registra modelo/configuración reales. No cambies umbrales ni destinatarios por capacidad del modelo.
Aceptación: respuesta válida, timeout, salida inválida y fallo de proveedor distinguibles. Ningún secreto cliente/log. Una respuesta tardía lleva contexto de ejecución para descartarla.
Pruebas: tests controlados del adaptador y perfil Base; llamada real solo con credenciales/destino autorizados, guardando salida saneada y latencia. Sin acceso, marca comprobación externa BLOCKED, no inventes resultados.
Entrega interfaz, selección justificada, evidencia y requisitos privados pendientes. Detente ante gasto/uso externo no autorizado; continúa pruebas locales.
```

### T03 · Persistencia y preparación local

```text
Implementa T03 en codex/t03-persistencia; aplica docs/TASKS.md §2 y verifica T01 integrada.
Lee AGENTS, PRODUCT, CONTRACTS C01–C09, SETUP y QA DB01–DB06. Usa supabase-postgres-best-practices antes de schema/transacciones, TDD para protecciones y relevo-lenguaje-claro para docs.
Eres el único responsable de prisma/, migraciones y seed. Propiedad: prisma/, migraciones, seed, src/lib/server/repositories/, tests/db/, tests/helpers/db/, scripts de preparación/pruebas locales y evidencia T03. Coordina package.json, lockfile, prisma.config.ts, cliente DB y SETUP con integrador.
Materializa las entidades/constraints de T01, índices para transiciones y deduplicación, eventos e intenciones de aviso. Crea seed ficticio C02/C03 y fixtures de ejecución que permitan probar T06–T10 sin API de reset. No implementes reglas de negocio ni dupliques repositorios en otros módulos.
Añade comandos reales de tests de dominio/integración, migración y seed local; documenta su uso. Protege toda limpieza destructiva con destino local permitido: rechaza Neon/demo y destinos desconocidos antes de modificar datos. No uses db push/reset como atajo.
Aceptación: migrar desde base limpia, seed reproducible, repositorios parametrizados y aislamiento entre bases. db:check prueba una transacción real; Prisma generate no cuenta como conectividad.
Pruebas: perfiles Prisma/Base, migraciones y tests en PostgreSQL local; rechazo de destino remoto probado sin destruir una base remota. Registra versión del servidor y compatibilidad pendiente con Neon.
Entrega migraciones, contratos de repositorio, comandos exactos y evidencia. No apliques migraciones externas; coordina cualquier futura modificación de schema como responsable único.
```

### T04 · Componentes y estructura visual

```text
Implementa T04 en codex/t04-componentes; aplica docs/TASKS.md §2 y verifica T01 integrada.
Lee AGENTS, PRODUCT, CONTRACTS C08, DESIGN, LANGUAGE y QA U01–U05. Usa impeccable en Operate, vercel-react-best-practices y relevo-lenguaje-claro; shape solo si queda una decisión UX real.
Propiedad: src/components/ui/, src/components/relevo/, globals.css y layout.tsx. Puedes crear estructura mínima en las cinco rutas antes de que otros agentes sean sus dueños; registra el traspaso al integrar. No implementes pantallas operativas ni endpoints.
Consolida tokens existentes y primitives necesarias: acciones, campos, estado con texto, error, carga, continuidad y registro. Conserva Public Sans/petróleo/ocre y navegación web convencional. Define variantes móvil/proyector consumibles sin editar estilos globales por pantalla.
Aceptación: foco, teclado, texto largo/zoom, 48 px táctiles y movimiento reducido; ningún componente convierte envío en cobertura. Estructura mínima rotulada como pendiente, sin datos que aparenten operación real.
Pruebas: perfil Base y Navegador; inspecciona render móvil/escritorio y estados. No escribas tests que solo copien CSS. Ejecuta impeccable document sobre componentes reales según DESIGN.
Entrega capturas, API de componentes y límites. Detente antes de rediseñar marca o cambiar reglas por estética.
```

### T05 · Autorización y eventos comunes

```text
Implementa T05 en codex/t05-seguridad-eventos; aplica docs/TASKS.md §2 y verifica T03 integrada, incluido T01.
Lee AGENTS, PRODUCT, CONTRACTS C07–C09 y QA S01–S06/DB06. Usa TDD, supabase-postgres-best-practices para persistencia y relevo-lenguaje-claro para errores.
Propiedad: src/lib/server/auth/, src/lib/server/events/, src/lib/server/http/ y tests/security/. Consume contratos T01 y repositorios T03; no cambies Prisma ni implementes transiciones.
Implementa autorización de Rodrigo/control/destinatario, tokens limitados y expiración conforme a T01, validación común, errores HTTP, protección de origen aplicable y contexto de ejecución. Implementa registro de eventos/intenciones usando transacciones de los consumidores, sin eventos de éxito previos al commit.
Aceptación: rechazar token ausente, vencido, cruzado entre actor/entidad/ejecución; GET de enlace no muta. No filtrar secretos por errores/logs/serialización. Evento incluye actor, entidad, ejecución, timestamp, origen/canal y resultado observado.
Pruebas: suite real introducida en T03, PostgreSQL para atomicidad y perfil Base; fixtures separados de autenticación empresarial real.
Entrega helpers, pruebas y evidencia S/DB. Detente si falta contrato de permisos; no improvises controles públicos de roles.
```

### T06 · Relevo y cobertura

```text
Implementa T06 en codex/t06-relevo; aplica docs/TASKS.md §2 y verifica T05 integrada.
Lee AGENTS, PRODUCT, CONTRACTS C02–C04/C07–C09, LANGUAGE y QA R01–R10. Usa TDD, supabase-postgres-best-practices y relevo-lenguaje-claro.
Propiedad: src/lib/server/handoff/, POST /api/handoff, POST /api/handoff/[id]/accept y /reject, y tests/handoff/. No edites suggest, transporte, scene/reset/state ni Prisma.
Consume auth/eventos/repositorios. Implementa borrador/envío, correcciones humanas del paquete según T01, aceptación programada/efectiva, rechazo inmediato, vencimiento por candidato y hueco con coordinación. Expón evaluador invocable por T11 con reloj inyectable en tests.
Registra intenciones de aviso usando la interfaz T01; T11 conectará T08 cuando ambos estén integrados. No simules entrega física para completar esta tarea.
Aceptación: envío no activa cobertura; aceptación anticipada respeta ventana; plazos propios de 30 s; acción tardía no reasigna; hueco no prolonga Rodrigo. Elegibilidad por ventana/rol, incluido fixture donde Rodrigo sí es respaldo. Enviar no reavisa un incidente ni publica tickets en canal.
Pruebas: TDD por comportamiento, carreras aceptar/rechazar/vencer y reintentos con PostgreSQL; perfil Base. Verifica estado y eventos, no solo HTTP.
Entrega contratos de motor/evaluador, evidencia R01–R10 y límite de avisos aún sin conectar. Detente ante necesidad de schema no coordinada o política de cobertura contradictoria.
```

### T07 · Clasificación y política

```text
Implementa T07 en codex/t07-clasificacion; aplica docs/TASKS.md §2 y verifica T02/T05 integradas.
Lee AGENTS, PRODUCT, CONTRACTS C05, LANGUAGE y QA A01–A06. Usa TDD y relevo-lenguaje-claro; supabase-postgres-best-practices si escribes persistencia/SQL.
Propiedad: src/lib/server/classification/, src/lib/server/policy/, tests/classification/ y conjunto de calibración en tests/fixtures/classification/. Consume adaptador T02; no lo edites ni crees /api/messages.
Valida salida estructurada y separa extracción del modelo de política determinista. Implementa rutas de aviso, revisión y diferible con umbrales C05, prioridad generalizada y modo degradado conservador. No modifiques destinatarios por texto del público.
Prepara los 20 casos etiquetados de QA: 6 críticos, 4 degradados, 5 solicitudes/localizados, 3 manipulaciones y 2 ambiguos. Conserva razón humana; es calibración, no evaluación independiente.
Aceptación: límites 0,40/0,70 sin solapamiento, impresora que bloquea boletas, correo generalizado, incertidumbre, manipulación mezclada con incidente real y fallo de proveedor. Nunca diferir por ausencia de palabras clave.
Pruebas: suite determinista, perfil Base y calibración real solo autorizada; registra modelo, salida, ruta y latencia sin inventar precisión.
Entrega servicio consumible por T10/T14 y evidencia A. Detente ante contrato insuficiente que altere política; no ocultes la falta de prueba externa.
```

### T08 · Transporte de avisos

```text
Implementa T08 en codex/t08-avisos; aplica docs/TASKS.md §2 y verifica T05 integrada.
Lee AGENTS, PRODUCT, CONTRACTS C07–C09, LANGUAGE, DEMO preparación y QA I08/I09/S03. Usa TDD, relevo-lenguaje-claro y supabase-postgres-best-practices al persistir resultados.
Propiedad: src/lib/server/notifications/, tests/notifications/ y evidencia T08. Consume intenciones/eventos/auth T01/T05. No implementes candidatos, plazos, ACK ni motores de asignación.
Implementa ntfy para Paula e in-app para Tomás/Carla, con transporte real desactivado por defecto. Distingue intención, respuesta del proveedor y recepción física. Evita duplicación lógica al reintentar y documenta el límite de entrega exactamente una vez por HTTP.
Produce enlace de revisión para relevo y acción HTTP POST Tomar incidente con token limitado, según contrato; no hagas aceptar/acuse en GET. Descarta trabajo viejo tras cambio de ejecución conforme al contrato común.
Aceptación: no secretos en vistas públicas/logs; errores no se presentan como recepción. Probar formato y transporte en S26 bloqueado solo con tópico/destino autorizados. Antes de T10/T13, la prueba física es de transporte/formato; el efecto funcional del POST queda pendiente hasta integrar esos consumidores.
Pruebas: transporte controlado, persistencia real de resultados y perfil Base. Guarda evidencia física separada o BLOCKED, sin fingirla con HTTP 200.
Entrega adaptador, resultado ntfy/S26 y pendientes para T18/T21. Detente ante envío físico no autorizado; continúa comprobaciones locales.
```

### T09 · Propuestas y nota de relevo

```text
Implementa T09 en codex/t09-nota; aplica docs/TASKS.md §2 y verifica T02/T05 integradas.
Lee AGENTS, PRODUCT, CONTRACTS C03/C09, LANGUAGE y QA A07/R10/S04. Usa TDD, relevo-lenguaje-claro y supabase-postgres-best-practices para escritura transaccional.
Propiedad: src/lib/server/handoff-note/, POST /api/handoff/suggest y tests/handoff-note/. Consume adaptador T02, tickets/repositorios y auth/eventos; no edites motor T06 ni proveedor compartido.
Genera propuestas puede_esperar/transferir con razones y nota de hasta 60 palabras. Persiste borrador y correcciones según T01. Expón generación para reset T11; Regenerar debe llamar realmente al proveedor.
Aceptación: cinco pendientes C03 conservados, #470 transferido sin urgencia automática; nota editable sin causas/compromisos inventados. Fallo visible y borrador previo conservado según contrato, sin éxito ficticio. Resultado de ejecución vieja no se guarda en la nueva.
Pruebas: respuestas válidas/largas/inválidas, edición, error y reset concurrente mediante fixture; suite integrada y perfil Base. Prueba real solo autorizada; no uses una plantilla como generación exitosa.
Entrega servicio, endpoint, evidencia A07/R10/S04 y límites. Detente si falta definición de edición/persistencia en T01; coordina el contrato sin duplicar endpoints.
```

### T10 · Incidentes, acuse y escalada

```text
Implementa T10 en codex/t10-incidentes; aplica docs/TASKS.md §2 y verifica T06/T07/T08 integradas.
Lee AGENTS, PRODUCT, CONTRACTS C04–C09 y QA I01–I07/R08/R09/S01. Usa TDD, supabase-postgres-best-practices y relevo-lenguaje-claro.
Propiedad: src/lib/server/incidents/, POST /api/ack/[id] y tests/incidents/. Consume cobertura/elegibilidad T06, decisiones T07, transporte T08 y repositorios comunes. No crees /api/messages ni UI/control ni otro evaluador global.
Implementa ingreso de reporte clasificado, cola diferible, creación/deduplicación atómica por mismo hecho, aviso lógico, acuse y escalada. Expón evaluador de vencimientos para T11. Distingue responsable de incidente y titular de cobertura; sin cobertura deriva coordinación sin inventar técnico.
Aceptación: Tomar incidente detiene escalada pero no resuelve ni cambia cobertura. Cada candidato recibe 30 s propios; acción tardía no reasigna. Reportes equivalentes simultáneos generan un incidente/aviso lógico; hechos distintos del mismo servicio se conservan. Borde narrativo de 10 min comprobado sin acelerar plazo real.
Pruebas: carreras acuse/vencimiento/doble acuse y deduplicación con PostgreSQL; idempotencia, fallo ntfy, elegibilidad alternativa y perfil Base. Endpoint ACK utiliza autorización T05.
Entrega servicio/evaluador, evidencia I/R/S y trazas saneadas. Detente antes de cambiar equivalencia o schema sin coordinación.
```

### T11 · Ejecución, escenas, reset y estado

```text
Implementa T11 en codex/t11-ejecucion; aplica docs/TASKS.md §2 y verifica T06/T09/T10 integradas, incluido transporte T08.
Lee AGENTS, PRODUCT, CONTRACTS C02/C07–C09, DEMO y QA I06/I07/S02–S05. Usa TDD, supabase-postgres-best-practices y relevo-lenguaje-claro.
Propiedad: src/lib/server/execution/, src/lib/server/state/, GET /api/state, POST /api/scene, POST /api/reset y tests/execution/. Consume motores sin copiar transiciones. Puedes añadir el ensamblado de avisos de relevo en este módulo; cualquier cambio interno T06 se coordina con su dueño.
Compón evaluadores de relevo/incidente para peticiones de estado, activa cobertura según reloj acordado y despacha intenciones vigentes mediante T08. Cambiar escena no fabrica resultados ni adelanta plazos reales.
Reset crea ejecución nueva, canal cerrado, fixtures y generación/guardado de nota mediante T09. Invalida tokens/trabajo pendiente viejo, incluida IA/notificación; no destruye schema. Define respuesta coherente ante generación fallida según contratos existentes.
Entrega estado público saneado y lecturas privadas autorizadas acordadas en T01 para cierre/receptor. No caches cambios operativos; no expongas secretos por serializar modelos completos.
Aceptación: polling concurrente no duplica vencimientos; parar lectores y retomarlos evidencia el límite conocido. Reset repetido y durante IA/avisos/acciones no contamina ejecución nueva. Lectura privada denegada no filtra paquete.
Pruebas: PostgreSQL, reloj controlable, retrasos y concurrencia; perfiles Base/Prisma aplicables. No añadas scheduler autónomo.
Entrega APIs ensambladas y evidencia I/S. Detente si una transición requiere editar otro motor sin acuerdo; no fijes estados visuales para pasar la prueba.
```

### T12 · Cierre de Rodrigo

```text
Implementa T12 en codex/t12-cierre; aplica docs/TASKS.md §2 y verifica T04/T06/T09/T11 integradas.
Lee AGENTS, PRODUCT, CONTRACTS C03/C04/C08, DESIGN, LANGUAGE y QA R01/R02/R10/U01–U05. Usa impeccable Operate (adapt/harden), vercel-react-best-practices, relevo-lenguaje-claro y TDD para comportamiento nuevo.
Propiedad: src/app/rodrigo/, src/components/rodrigo/ y tests/e2e/cierre.spec.ts. No edites componentes compartidos, APIs ni resumen de mañana reservado a T17.
Consume lecturas privadas autorizadas, sugerencias y envío existentes. Permite revisar cinco pendientes, corregir propuestas, editar nota y Regenerar; mostrar guardado/error antes de Enviar relevo. Preserva distinción envío/aceptación/inicio/fin del saliente y ambos relojes.
Aceptación: continuidad visual honesta, nota realmente editable, reintentos según idempotencia, estados pendiente/programado/activo/derivado/sin cobertura sin promesas falsas. No reavisar incidentes al cerrar.
Pruebas: perfil Base/Navegador contra backend real local; inspección móvil, teclado y textos largos; no networkidle. Captura envío pendiente y aceptación programada.
Entrega evidencia R/U y consumo de API. Detente ante falta de contrato o componente; pide ajuste al dueño sin introducir motor cliente.
```

### T13 · Receptor del relevo

```text
Implementa T13 en codex/t13-receptor; aplica docs/TASKS.md §2 y verifica T04/T06/T11 integradas.
Lee AGENTS, PRODUCT, CONTRACTS C04/C08/C09, DESIGN, LANGUAGE y QA R02/R06/S01/S02/U. Usa impeccable Operate, vercel-react-best-practices, relevo-lenguaje-claro y TDD para acciones/bugs.
Propiedad: src/app/relevo/[id]/, src/components/receptor/ y tests/e2e/receptor.spec.ts. No edites endpoints de T06 ni transporte.
Consume paquete privado con token limitado; presenta Aceptar relevo / No puedo cubrir mediante POST explícitos. Abrir enlace no acepta. Mostrar candidato vigente, ventana y resultado persistido; expirado/derivado sin reasignación silenciosa.
Aceptación: aceptación anticipada explica inicio futuro; doble toque/reintento coherente; enlace de otro destinatario o ejecución no accede/actúa. No filtrar token por enlaces externos, referrers, logs o proyector.
Pruebas: perfiles Base/Navegador, contextos separados y acción tardía tras derivación; render móvil y S26 si disponible, distinguiendo emulación de dispositivo real.
Entrega capturas, evidencia y límites del ensayo físico. Detente si el backend permite una mutación no autorizada: reproduce y coordina corrección, no la ocultes deshabilitando solo el botón.
```

### T14 · Canal público y límites de ingreso

```text
Implementa T14 en codex/t14-canal; aplica docs/TASKS.md §2 y verifica T04/T07/T10/T11 integradas.
Lee AGENTS, PRODUCT, CONTRACTS C05/C08, DESIGN, LANGUAGE, DEMO participación y QA A08/S03/U. Usa TDD, supabase-postgres-best-practices para cuotas atómicas, impeccable Operate, vercel-react-best-practices y relevo-lenguaje-claro.
Propiedad: src/app/canal/, src/components/canal/, POST /api/messages, src/lib/server/messages/, tests/messages/ y tests/e2e/canal.spec.ts. No edites clasificación ni motor de incidentes.
Conecta validación/sesión/cuotas de T01 con clasificación T07 y registro/decisión T10. Respeta canal cerrado, 280 caracteres, cinco envíos y límite global fijado. El control T16 usa el mismo servicio con origen escenario y permisos explícitos, sin crear otra política.
Aceptación: cierre/cambio de ejecución impide ingreso indebido y respuestas viejas; cuotas concurrentes persistidas; cambiar apodo no elude toda barrera. Mostrar solo respuestas propias, cola/revisión/aviso observado y modo degradado; escapar contenido malicioso.
Pruebas: saturación concurrente y XSS, suite de dominio/PostgreSQL, perfiles Base/Navegador con roles separados. Diferible sin push y crítico deduplicado en integración.
Entrega evidencia A/S/U y ruta pública utilizable por QR. Detente si faltan límites acordados; no elijas una protección solo por nombre de apodo.
```

### T15 · Proyector, QR y registro

```text
Implementa T15 en codex/t15-proyector; aplica docs/TASKS.md §2 y verifica T04/T11 integradas.
Lee AGENTS, PRODUCT, CONTRACTS C07–C09, DESIGN, LANGUAGE, DEMO y QA I07/S03/U/E03. Usa impeccable Operate (adapt/harden), vercel-react-best-practices y relevo-lenguaje-claro.
Propiedad: src/app/proyector/, src/components/proyector/, src/components/registro/, src/lib/client/state/ y tests/e2e/proyector.spec.ts. Si se necesita dependencia QR, coordínala con integrador. No escribas control ni APIs.
Consulta estado saneado cada segundo; indica desconexión y última actualización. Limpia intervalos/listeners y descarta respuestas de ejecución anterior o fuera de orden. Publica un consumidor compartido para T16/T17, sin motor de plazos cliente.
Muestra escenas, cadena de responsabilidad, relojes, registro continuo y QR a /canal; datos sintéticos y conteos derivados del registro. Separa resultados ntfy, acuse y origen escenario. No expongas tokens ni botones privilegiados.
Aceptación: lectura a distancia, reconexión sin falsa cobertura, cambio de ejecución limpio. Avisos a Rodrigo: 0 solo cuando lo respalda el registro y su definición; no despertares ni resolución inferida.
Pruebas: perfiles Base/Navegador, montaje/desmontaje/reconexión/reset, capturas a resolución de proyección y revisión física pendiente si no hay pantalla disponible.
Entrega consumidor, capturas y evidencia I/S/U/E. Detente antes de fabricar métricas o adelantar plazos para una animación.
```

### T16 · Operación protegida

```text
Implementa T16 en codex/t16-control; aplica docs/TASKS.md §2 y verifica T04/T11 integradas.
Lee AGENTS, PRODUCT, CONTRACTS C08/C09, DESIGN, LANGUAGE, DEMO participación/atajos y QA S05/U05/E01. Usa impeccable Operate, vercel-react-best-practices, relevo-lenguaje-claro y TDD para acciones/atajos.
Propiedad: src/app/control/, src/components/control/ y tests/e2e/control.spec.ts. Consume APIs y contratos existentes; no modifica motores, /api/scene ni /api/reset.
Implementa acceso protegido, escenas, canal, reportes guionados, acción de Tomás y reset. Reserva los atajos de DEMO con limpieza y sin activarlos al escribir; RR exige la secuencia de confirmación acordada. Q controla QR; M solo audio de presentación si existe, de lo contrario indica no disponible sin añadir audio.
Para reportes usa el servicio común de T14 cuando esté integrado. Hasta entonces deja esa capacidad explícitamente pendiente; no dupliques /api/messages. T18 exige conexión final. T16 puede desarrollarse en paralelo con T14 sin depender de su rama.
Aceptación: actor/origen escenario persistido y visible; toda acción pasa por autorización y transiciones comunes. Cambiar escena no equivale a aceptar/acuse ni acelera 30 s. Control no aparece en proyector público.
Pruebas: perfil Base/Navegador, acceso indebido, atajos en input/textarea/contenido editable, doble acción y reset con respuestas pendientes.
Entrega evidencia S/U y pendientes de conexión. Detente ante API faltante; no reemplaces una mutación por estado local ficticio.
```

### T17 · Resumen, mañana y consulta

```text
Implementa T17 en codex/t17-resumen; aplica docs/TASKS.md §2 y verifica T12/T15 integradas.
Lee AGENTS, PRODUCT, CONTRACTS C02/C07, DESIGN, LANGUAGE, DEMO 3:25–3:50 y QA E03/U06. Usa impeccable Operate, vercel-react-best-practices y relevo-lenguaje-claro; TDD para cálculos nuevos.
Propiedad: src/app/rodrigo/, src/components/rodrigo/resumen/ y tests/e2e/resumen.spec.ts. T12 ya terminó; no editar simultáneamente sus archivos. Consume registro compartido T15 y lecturas autorizadas T11 sin modificarlos.
Añade vista de mañana como filtro del registro continuo y resumen de hechos observados. Presenta consulta profesional por ronquido fuerte sin diagnóstico/medicación y sin condicionar la consulta al éxito de la app. No recojas salud/sueño reales.
Aceptación: incidente tomado no se presenta resuelto, cobertura y acuse diferenciados, conteos solo de ejecución vigente y datos reales del registro. Sin prometer sueño extra ni anonimato no comprobado; sin módulo separado de jefatura.
Pruebas: perfiles Base/Navegador, ejecución vacía/con eventos/reset, render móvil/proyector relevante y revisión editorial.
Entrega evidencia E03/U06 y capturas. Detente si el resumen necesita hechos no registrados; no los inventes para completar el pitch.
```

### T18 · Integración y regresión independiente

```text
Implementa T18 en codex/t18-regresion; aplica docs/TASKS.md §2 y verifica T12–T17 integradas y motores disponibles.
Lee AGENTS, PRODUCT, CONTRACTS, QA, DEMO y LANGUAGE. Usa webapp-testing y luego dogfood sobre la URL disponible; TDD para cada bug corregido y supabase-postgres-best-practices para revisar carreras. Revisa trabajo ajeno; declara qué partes implementaste tú.
Propiedad: tests/e2e/integracion/, tests/regression/ y docs/evidence/T18.md. Reserva temporalmente con integrador los archivos de cualquier corrección; no hay implementadores editando el mismo flujo en paralelo.
Integra conexión final de reportes guionados T16→T14 y avisos/acuse; migra y carga una base limpia de integración desde archivos versionados. Ejecuta recorrido principal y ramas separadas, carreras, cuotas, permisos, reset durante trabajo pendiente y aislamiento entre bases.
Aceptación: Paula acepta cobertura, diferible en cola, crítico avisado, silencio 30 s, Tomás toma desde control con origen visible. Verifica DB/eventos además de UI. Incluye ramas sin cobertura, acciones tardías y elegibilidad alternativa. No marques push físico PASS por transporte simulado.
Pruebas: suite dominio/integración real, perfiles Prisma/Base/Navegador; documenta primer recorrido integrado antes del pulido. Explora doble toque, texto largo, desconexión y reset; reproduce cada bug tras corregirlo. Revisión inicial web-design-guidelines de bloqueos de interacción.
Entrega matriz QA con PASS/FAIL/BLOCKED/NO EJECUTADO y evidencias. No avances puerta con asignación inconsistente, duplicados lógicos, secretos, reset contaminado o cobertura falsa. Si falta URL desplegada, dogfood local queda acotado y la exploración pública se completa en T21.
```

### T19 · Accesibilidad y robustez visual

```text
Implementa T19 en codex/t19-accesibilidad; aplica docs/TASKS.md §2 y verifica T18 integrada.
Lee AGENTS, PRODUCT, CONTRACTS, DESIGN, LANGUAGE y QA U01–U06. Usa web-design-guidelines, impeccable critique/adapt/harden y una pasada polish acotada, vercel-react-best-practices y relevo-lenguaje-claro. Apple-design solo ante duda móvil concreta.
Propiedad: reserva con integrador los archivos UI afectados y tests de regresión pertinentes; docs/evidence/T19.md. No rediseñes marca ni cambies API/reglas para resolver copy o estética.
Revisa teclado/foco, semántica, errores asociados, contraste por superficie, táctil, zoom, lector de pantalla, movimiento reducido y lectura a distancia. Incluye carga/vacío/error/desconexión/acción vencida/modo degradado sin anunciar contadores cada segundo.
Aceptación: flujos utilizables móvil/escritorio/proyector, sin desborde ni acción tapada por teclado/safe area. Correcciones conservan responsabilidad, plazos y evidencia. No declarar certificación ni prueba en S26 si solo hubo emulación.
Pruebas: perfiles Base/Navegador y revisión renderizada de todos los estados modificados; TDD para bugs funcionales. No amplíes una auditoría a mejoras sin relación con el recorrido.
Entrega hallazgos por ubicación, cambios, capturas y estado U01–U06. Detente ante cambio de comportamiento no acordado; conserva regresión funcional verde.
```

### T20 · Despliegue y acceso público

```text
Implementa T20 en codex/t20-despliegue; aplica docs/TASKS.md §2 y verifica T19 integrada.
Lee AGENTS, PRODUCT, CONTRACTS C01/C08/C09, SETUP, QA DB03–DB07 y DEMO preparación. Usa las skills pertinentes de Vercel para despliegue/env/CLI, supabase-postgres-best-practices al revisar migraciones y relevo-lenguaje-claro para docs. Neon no implica plataforma Supabase.
Propiedad: configuración mínima de despliegue, SETUP y docs/evidence/T20.md; schema permanece bajo responsable único. No cambies funciones para acomodar un deploy sin coordinarlo.
Prepara build y checklist concretos antes de pedir autorización remota. Verifica proyecto, cuenta, región disponible, base/destino y conexión privada; aplicación pooled y migraciones directas conforme a C01. No desactives TLS ni expongas credenciales.
Solo con autorización explícita del encargo aplica migraciones/seed remotos y publica. Mantén ntfy desactivado salvo ensayo autorizado. Comprueba pool/concurrencia y presupuesto de conexiones por instancias, latencia y estado persistido entre solicitudes/dispositivos.
Aceptación: URL pública correcta desde otro dispositivo/red, control protegido, sin secretos cliente/logs y deploy asociado al SHA exacto. No basta el mensaje de éxito del proveedor. Reset escénico no destruye schema.
Pruebas: Base y Prisma aplicables, conexión/transacción real, smoke público y revisión de rutas/permisos; no ejecutar limpiezas destructivas contra Neon para probar barreras.
Entrega SHA/deploy/URL/acceso comprobados y evidencia DB/S. Sin autorización o credenciales, deja preparación revisable y bloqueo concreto; no declares despliegue completado.
```

### T21 · Ensayo desplegado, teléfono y respaldo

```text
Implementa T21 en codex/t21-ensayo; aplica docs/TASKS.md §2 y verifica T20 integrada con URL pública comprobada.
Lee AGENTS, PRODUCT, CONTRACTS, QA, DEMO y LANGUAGE. Usa webapp-testing, dogfood para exploración pública, web-design-guidelines focalizada y relevo-lenguaje-claro. TDD para bugs; reserva sus archivos antes de corregir.
Propiedad: tests/e2e/ensayo/, docs/evidence/T21.md y ajustes justificados a DEMO. Video/capturas locales sin secretos; registra ruta/artefacto compartible sin subirlo por defecto.
Ejecuta regresión desplegada y dos ensayos cronometrados tras reset. Paula acepta en S26; después recibe crítico con teléfono bloqueado, no pulsa Tomar incidente, vence plazo real y Tomás toma desde control. Prueba también acción POST ntfy válida en ejecución aparte, sin reemplazar la espera del pitch principal.
Distingue proveedor, recepción física y acción persistida. Comprueba QR desde otra red, proyector, permisos/batería/red alternativa y plan B. Prueba 10–15 teléfonos si se consiguen; si no, registra límite y carga automatizada separada.
Graba un ensayo real como respaldo, verifica reproducción local y declara grabación si se usa. No sustituyas fallo de push por una animación que aparente recepción.
Aceptación: E01–E05, ramas fuera del pitch y espera real de 30 s; conteos de ejecución correctos y duración registrada. Corrección posterior exige nueva regresión afectada y ensayo si cambia el flujo.
Pruebas: suite de regresión desplegada, smoke público, comprobación física S26 y reproducción local del video; conserva comandos y resultados reales.
Entrega video comprobado, evidencia física y matriz de resultados. Detente antes de aprobar recorrido vivo con dependencias físicas fallidas; deja respaldo honesto y bloqueo explícito.
```

### T22 · Cierre y entrega comprobada

```text
Implementa T22 en codex/t22-entrega; aplica docs/TASKS.md §2 y verifica T21 integrada.
Lee AGENTS, PRODUCT, CONTRACTS límites, QA puerta de entrega, DEMO y README. Usa relevo-lenguaje-claro; no abras refactors ni funciones nuevas.
Propiedad: README.md, consolidación de QA/SETUP/DEMO/INTEGRATION y docs/evidence/T22.md; coordinación editorial con integrador. No repliques contratos ni conviertas pendientes en resultados.
Prepara README breve con lo realmente construido, ejecución, URL, datos ficticios, hipótesis, canales físicos/in-app, IA/degradación y dependencia del lector para plazos. Consolidar fallos y no ejecutados; comprobar permisos/reglas de entrega vigentes sin asumir conformidad.
Ejecuta checks finales aplicables contra el árbol exacto. Con autorización explícita, crea commit/publicación/entrega; verifica SHA final, deploy correspondiente, URL y acceso público del repo/artefacto. Si el commit final modifica documentación respecto del deploy de T20, despliega ese SHA o identifica inequívocamente el artefacto exigido antes de afirmar coincidencia.
Aceptación: E06, evidencias referidas al commit/ejecución correctos, video disponible, secretos ausentes y ausencia de bloqueos críticos de QA. No prometer mejoras clínicas ni resolución de incidentes sin evento.
Pruebas: perfil Base, suite relevante y smoke público del artefacto final; repetir otras pruebas solo si hubo cambios que lo requieran. Revisa enlaces y reproducción del respaldo.
Entrega identificadores y enlaces comprobados, resultados y límites. Sin autorización para publicar/entregar, deja paquete concreto revisable y estado pendiente; no afirmes entrega por haber preparado README.
```

## 5. Cobertura y puertas de salida

### Cobertura de aceptación

| Grupo de QA / capacidad | Implementación responsable | Verificación que la cierra |
|---|---|---|
| DB01–DB06: aislamiento, migración, guardas y secretos | T00/T01/T03/T05/T11 | T18; DB03/DB05 remotos en T20 |
| DB07: Vercel/Neon público y conexiones | T20 | T20/T21/T22 |
| R01–R10: relevo, cobertura, elegibilidad y cierre | T06/T09/T12/T13 | T18; recorrido físico T21 |
| I01–I07: incidentes, carreras, duplicados y plazos | T10/T11 | T18 |
| I08–I09: ntfy, acción y resultados observados | T08/T10/T13 | Transporte temprano T08; efecto integrado T18/T21 |
| A01–A06: política, proveedor, calibración y degradación | T02/T07 | T07/T18/T21 según servicio real |
| A07: nota, edición y regeneración | T09/T11/T12 | T18 |
| A08: canal, límites y entradas maliciosas | T01/T14 | T18/T21 |
| S01–S06: permisos, vistas públicas, reset y datos ficticios | T01/T05/T11 y cada ruta propietaria | T18/T20/T21 |
| U01–U06: lectura, interacción, lenguaje y consulta | T04/T12–T17 | T19; dispositivo/proyección reales T21 |
| E01–E05: recorrido, ramas, registro, respaldo y revisión ajena | T15–T18 | T18/T21 |
| E06: README, commit, URL y entrega | T22 | T22 |

### Puertas

1. **Base distribuible — T00/T01:** archivos versionados con autorización, contratos y propiedad establecidos. No iniciar ramas dependientes desde el commit vacío de producto.
2. **Dependencias comprobables — T02/T03/T08:** base local real, proveedor elegido y transporte ensayado. Accesos externos bloqueados quedan visibles; no impiden toda programación local, pero siguen bloqueando declarar la demo lista.
3. **Primer recorrido integrado — T18:** motores, pantallas y control comparten contratos; recorrido principal y ramas comprobados con DB/eventos. No desplazar este primer armado hasta el pulido final.
4. **Recorrido utilizable — T19:** accesibilidad y estados revisados sobre UI real, conservando regresión funcional.
5. **Demo pública ensayada — T20/T21:** URL accesible, S26 y acción POST comprobados, espera real, dos ensayos y video reproducible. Registrar límites de carga o de equipos disponibles.
6. **Entrega comprobada — T22:** commit/deploy/URL/acceso y evidencias corresponden al artefacto final. No aprobar con asignación inconsistente, duplicados lógicos, secretos expuestos, reset contaminado o confirmaciones falsas de cobertura.

No se asignan horas sin recalcular esfuerzo; el número de agentes no divide automáticamente el tiempo humano. Audio, wa.me, vista independiente de jefatura y ornamentación no son tareas obligatorias. Cualquier recorte adicional sigue las prioridades del master y se acuerda explícitamente; no elimina aceptación real, seguridad, deduplicación, registro ni respaldo honesto.
