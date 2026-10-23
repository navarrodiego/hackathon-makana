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

Solo T00 está implementada. Los carriles son responsabilidades previstas, no agentes asignados ni ramas activas. Las rutas de evidencia pendientes aún no existen.

| Tarea | Rama prevista | Dependencias integradas necesarias | Responsable | Estado | Evidencia |
|---|---|---|---|---|---|
| T00 | `codex/t00-base-integracion` | — | Integrador T00 (Codex) | Implementada; cierre Git en entrega | [T00](evidence/T00.md) |
| T01 | `codex/t01-contratos` | T00 | Integrador; asignación pendiente | PENDIENTE | `docs/evidence/T01.md` (no creada) |
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
| Interfaces, directorios y archivos funcionales | T01 fija organización exacta | No congelar DTO ni crear módulos en T00 |
| `docs/evidence/TXX.md` | Responsable de TXX | Cada tarea informa pruebas y límites; integrador revisa antes de integrar |

## Recursos existentes y reservas

Entorno observado en T00: macOS; Node 24.19.0, pnpm 12.10.1, Playwright 1.64.1 y Google Chrome instalado. PostgreSQL/psql 17.10 (Homebrew) están instalados. Se observó un proceso PostgreSQL en loopback 5432, pero `pg_isready -h 127.0.0.1 -p 5432` respondió `no response` desde este entorno. No se infiere la causa ni conectividad de aplicación.

| Puesto reutilizable | Desarrollo / E2E reservados | Nombre no secreto de base propuesto | Estado |
|---|---|---|---|
| A | 34140 / 34141 | `relevo_ui` | Puertos libres al comprobar; base no creada ni verificada |
| B | 34142 / 34143 | `relevo_backend` | Puertos libres al comprobar; base no creada ni verificada |
| C | 34144 / 34145 | `relevo_escenario` | Puertos libres al comprobar; base no creada ni verificada |
| Integración | 34146 / 34147 | `relevo_integracion` | Puerto E2E usado por T00; base no creada ni verificada |

Las reservas no crean procesos ni bases. Los puestos se asignan a tareas al lanzarlas, sin exigir que el carril determine siempre el puesto. Verificar puertos y destino nuevamente antes de usarlos. 3000, 3001, 3002 y 3100 estaban ocupados en la inspección inicial; no cerrar procesos ajenos. T00 solo utiliza su servidor temporal de Playwright en 34147.

Cada entorno requiere su propia conexión privada y permisos limitados a su base. No copiar `.env` entre worktrees. Un único servidor PostgreSQL local es el objetivo; T00 no instala ni arranca otra pila. No hay `DATABASE_URL` elegida para T00: `db:check` queda BLOCKED. No se han comprobado bases, roles, Neon, Vercel, OpenRouter, ntfy ni S26. Los avisos reales continúan desactivados por defecto.

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

T00 comprueba Base y smoke de la pantalla técnica estática; esto no acredita el recorrido funcional. El detalle está en [evidencia T00](evidence/T00.md). La puerta de distribución exige comprobar el contenido del commit final en un worktree nuevo. T01 todavía debe fijar contratos y propiedad funcional antes del desarrollo paralelo.
