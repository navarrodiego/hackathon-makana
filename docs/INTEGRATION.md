# Registro de integración de Relevo

Registro operativo del 23-10-2026, zona America/Santiago. Fuentes: [TASKS §2](TASKS.md), [CONTRACTS C01](CONTRACTS.md), [SETUP](SETUP.md) y [master §8.3](../Relevo_Master_Plan.md). Conserva asignaciones y evidencia; no duplica contratos funcionales.

## Base y autorización

- Rama integradora inicial: `codex/t00-base-integracion`. Responsable actual: integrador T00 (Codex), con Diego como responsable de decisiones y recursos privados.
- SHA de entrada aprobado: `ce7294e7c557fdd169f96076a12a9b87721e5c79`. Contiene 33 archivos de materiales e inicialización; checkout `main` limpio al iniciar T00. El inventario está abajo.
- Autorización: Diego aprobó el plan y un commit local con este registro y `docs/evidence/T00.md`. No autoriza merge, push, publicación, migraciones, creación de bases ni envíos físicos.
- Las únicas adiciones de T00 son esos dos documentos. El código, lockfile y configuración se conservan.
- El SHA final exacto y la comprobación del worktree desde ese SHA se comunican en la entrega posterior al commit. No usar una rama móvil como sustituto de un SHA comprobado.
- T01 parte del SHA final de T00 comunicado en la entrega. Las demás tareas parten del SHA de integración que ya contenga sus dependencias comprobadas. T00 no autoriza ejecutar T01 ni lanzar agentes.

## Tareas y responsables

T00 está versionada. T01 está versionada e integrada en la rama base; cierre local y SHA comprobados abajo. Los demás carriles son responsabilidades previstas, no agentes asignados ni ramas activas. Las rutas de evidencia pendientes aún no existen.

| Tarea | Rama prevista | Dependencias integradas necesarias | Responsable | Estado | Evidencia |
|---|---|---|---|---|---|
| T00 | `codex/t00-base-integracion` | — | Integrador T00 (Codex) | Implementada; cierre Git en entrega | [T00](evidence/T00.md) |
| T01 | `codex/t01-contratos` | T00, SHA `afa61247727c76413717c86a0cb8804fc72999e8` | Integrador T01 (Codex) | INTEGRADA localmente; lint/tipos/Webpack PASS; Turbopack bloqueado por entorno | [T01](evidence/T01.md) |
| T02 | `codex/t02-openrouter` | T01 | C; pendiente | PENDIENTE | `docs/evidence/T02.md` (no creada) |
| T03 | `codex/t03-persistencia` | T01 | B; responsable único pendiente | PENDIENTE | `docs/evidence/T03.md` (no creada) |
| T04 | `codex/t04-componentes` | T01 | A; pendiente | PENDIENTE | `docs/evidence/T04.md` (no creada) |
| T05 | `codex/t05-seguridad-eventos` | T03 | B; pendiente | PENDIENTE | `docs/evidence/T05.md` (no creada) |
| T06 | `codex/t06-relevo` | T05 | B; pendiente | PENDIENTE | `docs/evidence/T06.md` (no creada) |
| T07 | `codex/t07-clasificacion` | T02, T05 | B; pendiente | PENDIENTE | `docs/evidence/T07.md` (no creada) |
| T08 | `codex/t08-avisos` | T05 | B; pendiente | PENDIENTE | `docs/evidence/T08.md` (no creada) |
| T09 | `codex/t09-nota` | T02, T05 | C; pendiente | PENDIENTE | `docs/evidence/T09.md` (no creada) |
| T10 | `codex/t10-incidentes` | T06, T07, T08 | B; pendiente | PENDIENTE | `docs/evidence/T10.md` (no creada) |
| T11 | `codex/t11-ejecucion` | T06, T09, T10 | C; pendiente | PENDIENTE | `docs/evidence/T11.md` (no creada) |
| T12 | `codex/t12-cierre` | T04, T06, T09, T11 | C; pendiente | PENDIENTE | `docs/evidence/T12.md` (no creada) |
| T13 | `codex/t13-receptor` | T04, T06, T11 | C; pendiente | PENDIENTE | `docs/evidence/T13.md` (no creada) |
| T14 | `codex/t14-canal` | T04, T07, T10, T11 | A; pendiente | PENDIENTE | `docs/evidence/T14.md` (no creada) |
| T15 | `codex/t15-proyector` | T04, T11 | A; pendiente | PENDIENTE | `docs/evidence/T15.md` (no creada) |
| T16 | `codex/t16-control` | T04, T11 | C; pendiente | PENDIENTE | `docs/evidence/T16.md` (no creada) |
| T17 | `codex/t17-resumen` | T12, T15 | C; pendiente | PENDIENTE | `docs/evidence/T17.md` (no creada) |
| T18 | `codex/t18-regresion` | T12–T17 | Verificador ajeno; pendiente | PENDIENTE | `docs/evidence/T18.md` (no creada) |
| T19 | `codex/t19-accesibilidad` | T18 | Verificador; pendiente | PENDIENTE | `docs/evidence/T19.md` (no creada) |
| T20 | `codex/t20-despliegue` | T19 | Integrador; pendiente | PENDIENTE | `docs/evidence/T20.md` (no creada) |
| T21 | `codex/t21-ensayo` | T20 | Diego y verificador; pendiente | PENDIENTE | `docs/evidence/T21.md` (no creada) |
| T22 | `codex/t22-entrega` | T21 | Integrador; pendiente | PENDIENTE | `docs/evidence/T22.md` (no creada) |

Máximo tres worktrees de tareas activos. No abrirlos todos por adelantado. El worktree detached preexistente de otra herramienta queda fuera de T00 y no se toca; no se ha comprobado que corresponda a una tarea del mapa. Antes de lanzar encargos, revisar también ese consumo de recursos.

## Propiedad de archivos

| Archivos o área | Escritor exclusivo | Regla |
|---|---|---|
| `docs/INTEGRATION.md` | Integrador; T01 actualiza propiedad coordinadamente | Registrar SHA integrado, responsable, puesto, puerto, base y evidencia antes de lanzar cada tarea |
| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.env.example`, `.gitignore`, `.nvmrc`, configuración raíz, cliente DB compartido | Integrador | Un escritor a la vez; las tareas proponen cambios y el integrador los incorpora antes de dependientes |
| AGENTS, PRODUCT, DESIGN, README, master, CONTRACTS, LANGUAGE, QA, DEMO y SETUP | Integrador | T00 no los modifica; T01 escribe CONTRACTS en su encargo serial; cambios posteriores se consolidan coordinadamente |
| `prisma/`, futuras migraciones y seed | Único responsable de T03, aún sin asignar | Conserva propiedad después de T03; ningún otro encargo los altera por su cuenta |
| `src/lib/contracts/` | Integrador T01; después integrador con consumidores | Organización y reservas exactas abajo; cambios coordinados antes de dependientes |
| `docs/evidence/TXX.md` | Responsable de TXX | Cada tarea informa pruebas y límites; integrador revisa antes de integrar |

## Recursos existentes y reservas

Actualización posterior a T00, autorizada por Diego el 23-10-2026: `relevo_integracion` ya existe en el servidor local y `pnpm db:check` pasó desde este worktree fuera del sandbox. Rol de aplicación: `relevo_integracion_app`, sin privilegios administrativos, límite de 3 conexiones, CONNECT y USAGE de public; sin CREATE de base/schema. Base vacía. `.env` privado, ignorado y con permisos 0600; no se copia a otros worktrees. Las observaciones iniciales que siguen son históricas y quedan superadas para la conexión de integración.

Entorno observado en T00: macOS; Node 24.19.0, pnpm 12.10.1, Playwright 1.64.1 y Google Chrome instalado. PostgreSQL/psql 17.10 (Homebrew) están instalados. Se observó un proceso PostgreSQL en loopback 5432, pero `pg_isready -h 127.0.0.1 -p 5432` respondió `no response` desde este entorno. No se infiere la causa ni conectividad de aplicación.

| Puesto reutilizable | Desarrollo / E2E reservados | Nombre no secreto de base propuesto | Estado |
|---|---|---|---|
| A | 34140 / 34141 | `relevo_ui` | Puertos libres al comprobar; base no creada ni verificada |
| B | 34142 / 34143 | `relevo_backend` | Puertos libres al comprobar; base no creada ni verificada |
| C | 34144 / 34145 | `relevo_escenario` | Puertos libres al comprobar; base no creada ni verificada |
| Integración | 34146 / 34147 | `relevo_integracion` | Puerto E2E usado por T00; base creada y conexión/transacción comprobadas posteriormente |

Las reservas no crean procesos ni bases. Los puestos se asignan a tareas al lanzarlas, sin exigir que el carril determine siempre el puesto. Verificar puertos y destino nuevamente antes de usarlos. 3000, 3001, 3002 y 3100 estaban ocupados en la inspección inicial; no cerrar procesos ajenos. T00 solo utiliza su servidor temporal de Playwright en 34147.

Cada entorno requiere su propia conexión privada y permisos limitados a su base. No copiar `.env` entre worktrees. Un único servidor PostgreSQL local es el objetivo; T00 no instala ni arranca otra pila. Durante T00 no había `DATABASE_URL` elegida y `db:check` quedó BLOCKED; la actualización posterior de arriba acredita solo la base local de integración. Neon, Vercel, OpenRouter, ntfy y S26 siguen sin comprobarse. Los avisos reales continúan desactivados por defecto.

## Inventario de entrada

Los siguientes 33 archivos ya estaban versionados en el SHA aprobado. La afirmación histórica de TASKS sobre materiales sin seguimiento quedó superada por los commits de base; se conserva el documento original.

```text
.env.example
.gitignore
.nvmrc
AGENTS.md
DESIGN.md
PRODUCT.md
README.md
Relevo_Master_Plan.md
components.json
docs/CONTRACTS.md
docs/DEMO.md
docs/LANGUAGE.md
docs/QA.md
docs/SETUP.md
docs/TASKS.md
eslint.config.mjs
next-env.d.ts
next.config.ts
package.json
playwright.config.ts
pnpm-lock.yaml
pnpm-workspace.yaml
postcss.config.mjs
prisma.config.ts
prisma/schema.prisma
scripts/check-db.ts
src/app/globals.css
src/app/layout.tsx
src/app/page.tsx
src/lib/server/db.ts
src/lib/utils.ts
tests/e2e/bootstrap.spec.ts
tsconfig.json
```

`.env.example` contiene variables vacías, `NTFY_ENABLED=false` y la URL pública del proveedor; no contiene credenciales. `.gitignore` excluye `.env*` salvo el ejemplo, `node_modules/`, `.next/`, `out/`, cliente generado, `*.tsbuildinfo`, informes Playwright, resultados y capturas de revisión. T00 no copia esos recursos desde el checkout original.

## Integración y cierre

Antes de integrar cada encargo: revisar diff, propiedad, dependencia y evidencia; ejecutar comandos reales de TASKS §2. No integrar datos entre bases. Las migraciones/seed comunes viajan por Git y su aplicación requiere destino y autorización acordados. Las pruebas externas bloqueadas se declaran por separado.

T00 comprueba Base y smoke de la pantalla técnica estática; esto no acredita el recorrido funcional. El detalle está en [evidencia T00](evidence/T00.md). La puerta de distribución exige comprobar el contenido del commit final en un worktree nuevo. T01 fija contratos y propiedad funcional; su commit exacto está integrado localmente según el cierre siguiente. No se han lanzado tareas dependientes.


## T01 · Base, asignación y reservas congeladas

Diego autorizó implementar el plan T01 el 23-10-2026, sin commit, merge, push ni efectos externos. Base exacta: `afa61247727c76413717c86a0cb8804fc72999e8`, que contiene los 35 archivos de T00 y su actualización documental de DB local. El checkout actual estaba limpio y detached en `51cc409`; se reutilizó tras crear `codex/t01-contratos` directamente desde la base acordada. No se abrió otro worktree ni se cambió el worktree T00 o el detached de otra herramienta. Esta asignación usa el puesto B como reserva lógica; T01 no arranca servidor ni DB y no ocupa sus puertos 34142/34143. Base propuesta `relevo_backend` sin crear; no se copia `.env` de integración.

El integrador T01 es el único escritor de contratos y documentos de su encargo. Los responsables que siguen son dueños por tarea, no personas/agentes ya lanzados. Antes de cada encargo, registrar el responsable concreto, SHA integrado, puesto, puerto y base elegidos. Máximo tres worktrees de tareas activos, contando recursos existentes al asignar.

### Módulos, pruebas y rutas

Las rutas de API se refieren al `route.ts` bajo `src/app/api/`. Reservar un directorio padre no permite editar subrutas con otro dueño.

| Dueño | Módulos y archivos exclusivos | Pruebas / evidencia |
|---|---|---|
| T01 / integrador | `src/lib/contracts/`, CONTRACTS y este registro | Ejemplos estáticos dentro de contracts; `docs/evidence/T01.md` |
| T02 | `src/lib/server/providers/openrouter/` | `tests/providers/openrouter/` |
| T03, responsable único permanente | `prisma/` (schema, migraciones, seed), `src/lib/server/repositories/`, `scripts/db/` (preparación y pruebas locales) | `tests/db/`, `tests/helpers/db/` (implementación de FixturePreparer) |
| T04 | `src/components/ui/`, `src/components/relevo/`, `src/app/globals.css`, `src/app/layout.tsx` | Smoke existente solo si necesita ajuste coordinado; sin propiedad general de E2E |
| T05 | `src/lib/server/auth/`, `src/lib/server/events/`, `src/lib/server/http/` | `tests/security/` |
| T06 | `src/lib/server/handoff/`; API `handoff/route.ts`, `handoff/[id]/accept/route.ts`, `handoff/[id]/reject/route.ts` | `tests/handoff/` |
| T07 | `src/lib/server/classification/`, `src/lib/server/policy/` | `tests/classification/`, `tests/fixtures/classification/` |
| T08 | `src/lib/server/notifications/` | `tests/notifications/` |
| T09 | `src/lib/server/handoff-note/`; API `handoff/suggest/route.ts` | `tests/handoff-note/` |
| T10 | `src/lib/server/incidents/`; API `ack/[id]/route.ts` | `tests/incidents/` |
| T11 | `src/lib/server/execution/`, `src/lib/server/state/` (ReadService y ensamblador); API `state/route.ts`, `scene/route.ts`, `reset/route.ts` | `tests/execution/` |
| T12 | `src/app/rodrigo/`, `src/components/rodrigo/` hasta traspaso a T17 | `tests/e2e/cierre.spec.ts` |
| T13 | `src/app/relevo/[id]/`, `src/components/receptor/` | `tests/e2e/receptor.spec.ts` |
| T14 | `src/app/canal/`, `src/components/canal/`, `src/lib/server/messages/`; API `messages/route.ts` | `tests/messages/`, `tests/e2e/canal.spec.ts` |
| T15 | `src/app/proyector/`, `src/components/proyector/`, `src/components/registro/`, `src/lib/client/state/` | `tests/e2e/proyector.spec.ts` |
| T16 | `src/app/control/`, `src/components/control/` | `tests/e2e/control.spec.ts` |
| T17 | Tras integrar T12: `src/app/rodrigo/`, `src/components/rodrigo/`, incluido `resumen/` | `tests/e2e/resumen.spec.ts` |
| T18 | Reserva exclusiva temporal del archivo corregido; sin implementadores simultáneos en ese flujo | `tests/e2e/integracion/`, `tests/regression/` |
| T19 | Reserva exclusiva por archivo de UI/regresión afectado, acordada antes de editar | Evidencia y regresiones en archivo reservado |
| T20 | Configuración mínima de despliegue y SETUP, coordinados con integrador | Evidencia DB/S y smoke público |
| T21 | Ajustes justificados de DEMO, reserva de archivos afectados por bugs | `tests/e2e/ensayo/`, artefactos locales ignorados |
| T22 | README y consolidación QA/SETUP/DEMO/INTEGRATION, serial | Checks finales y evidencia |

Cada tarea conserva exclusivamente `docs/evidence/TXX.md`; esos archivos no se crean hasta su encargo. `FixturePreparer` pertenece a T03; T06–T10 lo consumen sin crear un reset alternativo. T07 es dueño de la clave de equivalencia determinista; T03 del repositorio atómico; T10 del registro/deduplicación. T05 autoriza; T11 proyecta lecturas privadas/públicas; las pantallas no cambian permisos ni motores. T08 acepta un transporte de prueba conforme a la firma antes de la comprobación física. T11 conecta avisos de relevo cuando estén integrados T06 y T08.

### Traspasos y archivos comunes

- T04 puede crear únicamente estructura rotulada como pendiente de las cinco páginas C08. Al integrar, transfiere los directorios a T12–T16 y deja de escribirlos; no conserva propiedad sobre las pantallas. En ausencia de estructura, sus dueños crean los directorios según estos nombres. El resumen completo de Rodrigo se transfiere a T17 después de T12, sin edición simultánea.
- T15 conserva registro visual y consumidor público para T16/T17. Esas tareas consumen sus exports; ajustes requieren coordinación, no copia de componentes/polling.
- Integrador, un escritor a la vez: `package.json`, lockfile, `pnpm-workspace.yaml`, `.env.example`, `.gitignore`, `.nvmrc`, `prisma.config.ts`, `next.config.ts`, `tsconfig.json`, `next-env.d.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `components.json`, `playwright.config.ts`, `scripts/check-db.ts`, `src/lib/server/db.ts`, `src/lib/utils.ts`, `src/app/page.tsx` y `tests/e2e/bootstrap.spec.ts`. T03 propone cambios de comandos/DB; T05 de variables privadas; el integrador incorpora antes de dependientes.
- AGENTS, PRODUCT, DESIGN, README, master, CONTRACTS, LANGUAGE, QA, DEMO y SETUP: integrador. Las reservas documentales de T20–T22 se ejecutan serialmente; ningún agente cambia fuentes comunes por su cuenta. T01 no modifica LANGUAGE porque conserva terminología y mensajes aprobados.
- Un componente nuevo fuera del directorio del dueño exige reserva concreta antes de crearlo. No hay escritor implícito de carpetas raíz ni autorización para editar Prisma desde motores.

### Puerta de salida T01

Revisar tipos, decisiones, ejemplos, límites y evidencia de Base. La autorización posterior de Diego y el merge local comprobado cierran la puerta Git de T01: T02/T03/T04 pueden partir del SHA final de integración comunicado en la entrega, no de una rama móvil ni de archivos sin seguimiento. Sus encargos siguen pendientes. La evidencia histórica T00 de conectividad pertenece a su entorno; T01 no repite conexión ni habilita avisos. Pruebas DB, proveedores y dispositivo siguen separadas de la aceptación estática de contratos.


## Cierre Git T01 · Integración local autorizada

Diego solicitó explícitamente «Haz merge con la rama de integración base y commit». Esta autorización posterior permite el merge y el commit documental locales; no autoriza push, deploy, migraciones ni efectos externos.

- T01 ya estaba versionada al iniciar esta solicitud: `7324f0addedf870d32ea5e86e4de4a872203d2a3`, con los 17 archivos del encargo. Ambos worktrees estaban limpios; no se duplicó ese commit.
- Destino: `codex/t00-base-integracion`, worktree `/Users/diegonavarro/.codex/worktrees/t00-base-integracion/hackathon-makana`, previamente en `afa61247727c76413717c86a0cb8804fc72999e8`.
- Merge local `--no-ff`: `c752f120433980dfdab7e8c56bce01eafce74b62`, sin conflictos. Sus padres son la base anterior y el commit T01; el árbol resultante coincide exactamente con T01.
- Antes del merge se repitieron `pnpm lint`, `pnpm typecheck` y `pnpm build --webpack`: PASS. El build normal Turbopack conserva el bloqueo de entorno documentado; no se cambió configuración. Se restauró únicamente `next-env.d.ts` generado por los checks antes de cerrar el worktree fuente.
- El commit posterior solo actualiza este registro y evidencia T01. Su SHA final se comunica tras obtenerlo, evitando autorreferencia. Se comprueba que el código integrado coincide con el commit T01 y ambos worktrees quedan limpios.

No se hizo push ni se inició T02/T03/T04. Usar el SHA final local comunicado para los siguientes encargos; no asumir que el remoto ya contiene esta integración.
