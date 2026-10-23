# Relevo — instrucciones para agentes

Este repositorio conserva el alcance aprobado y una base técnica inicializada; no acredita el recorrido funcional. No crees funcionalidades para completar una recomendación genérica de una skill. Diego confirmó el 23-10-2026 la autorización para inicializar e incorporar estos materiales al entregable.

## Fuentes de verdad

| Pregunta | Fuente |
|---|---|
| Producto, audiencia y alcance | [PRODUCT.md](PRODUCT.md) |
| Comportamiento, estados, seguridad y límites técnicos | [docs/CONTRACTS.md](docs/CONTRACTS.md) |
| Identidad visual y componentes | [DESIGN.md](DESIGN.md) |
| Terminología y mensajes | [docs/LANGUAGE.md](docs/LANGUAGE.md) |
| Operación del pitch | [docs/DEMO.md](docs/DEMO.md) |
| Verificación y evidencia | [docs/QA.md](docs/QA.md) |
| Entrada breve para el jurado | [README.md](README.md) |

Lee PRODUCT y CONTRACTS antes de implementar; los demás documentos según tarea. No cargues todo en cada sesión. Una decisión actual explícita del usuario prevalece. Si fuentes vigentes se contradicen en comportamiento, pregunta con una recomendación; no alteres reglas de negocio para resolver copy o estética. El master plan externo es el origen del paquete y conserva logística/estimación; no debe convertirse en una segunda copia de contratos que evolucione por separado.

## Comandos y entorno

Inicialización autorizada por Diego el 23-10-2026: solo base técnica, con Prisma. Existe Next.js App Router con TypeScript, Tailwind y configuración de shadcn; no hay recorrido operativo, modelos de negocio, migraciones ni seed. No ampliar esa base por una recomendación genérica.

Entorno: Node 24 (`.nvmrc`), pnpm 12 (`packageManager`). Comandos reales:

- Instalar: `pnpm install --frozen-lockfile`.
- Desarrollo: `pnpm dev` (127.0.0.1:3000; admite `--port`).
- Lint: `pnpm lint`. Tipos: `pnpm typecheck` después de `pnpm db:generate`.
- Build: `pnpm build`. Producción local: `pnpm start`.
- E2E: `pnpm exec playwright install chromium`, `pnpm build`, `pnpm test:e2e` (puerto 34137).
- Prisma sin acceso a DB: `pnpm db:validate`, `pnpm db:generate`.
- Conexión/transacción de solo lectura: `pnpm db:check`; requiere `DATABASE_URL` privada en `.env`. No acredita conectividad hasta ejecutarlo contra el entorno elegido.

No hay suite unitaria de reglas todavía. No hay comandos de migración/seed/reset porque no existen modelos acordados. No usar `db push` ni reset de Prisma para completar la inicialización. Resultados y límites en `docs/SETUP.md`.

Playwright requiere su librería y navegador en el entorno elegido. Comprueba el helper de webapp-testing con `--help` antes de usarlo. No esperes `networkidle` en una app que consulta estado continuamente: espera elementos/estados. Las skills no instalan por sí solas sus dependencias.

## Trabajo paralelo

- Integrador: acuerda contratos, combina ramas y valida punta a punta. No trabajar todos directamente en main.
- WT-A: canal, proyector y registro visual. No duplicar el motor de estados.
- WT-B: DB, reglas, transiciones, plazos, elegibilidad, notificaciones y seguridad. Un único responsable de schema/migraciones; no aplicar desde varios worktrees a la misma DB.
- WT-C: cierre, receptor, control, escenas y reset, consumiendo contratos comunes.
- Verificador independiente: comprueba trabajo ajeno con spec, URL y evidencia; no hace falta un cuarto agente simultáneo.
- Cada encargo fija archivos propios, contratos, exclusiones, skills y evidencia. Acordar nombres de tablas/tipos/DTO antes de abrir cambios dependientes. El aislamiento Git no aísla el servidor PostgreSQL, Neon, ntfy ni otros efectos externos. Un servidor local aloja una base por worktree y otra de integración, con permisos y conexión privados por entorno. No levantar una pila por agente ni compartir las tablas de pruebas. Misma fuente de migraciones/seed; se integran archivos por Git, no datos. Reset destructivo de pruebas rechaza Neon/demo; reset escénico autorizado solo cambia ejecución. Push real desactivado por defecto fuera de integración/demo.

## Skills por tarea

| Tarea | Skills y momento |
|---|---|
| UI nueva o modificada | `impeccable`: shape solo ante una decisión de UX pendiente, critique al integrar, adapt para teléfono/proyector, harden para estados, polish al final. Modo Operate, conservar DESIGN. `vercel-react-best-practices` al escribir/revisar componentes, efectos, carga de datos y polling. |
| Cualquier contenido humano | `relevo-lenguaje-claro` antes de escribir/revisar UI, notificaciones, notas IA, documentos o pitch. LANGUAGE manda en vocabulario del proyecto; no copia divergente del glosario global. |
| Reglas, estados y bugs | `test-driven-development`: RED → GREEN → REFACTOR por comportamiento, sin escribir toda la implementación antes de verificar fallos. |
| Schema, SQL, transacciones o RLS | `supabase-postgres-best-practices` antes de escribir y al verificar concurrencia. Sus reglas PostgreSQL siguen siendo útiles sin usar la plataforma Supabase. |
| Primer recorrido integrado y regresión | `webapp-testing`; después `dogfood` para exploración y reproducción de bugs. |
| UI integrada y cierre | `web-design-guidelines`: teclado, foco, semántica, formularios, accesibilidad y movimiento reducido. |
| Duda móvil concreta | `apple-design`, opcional y focalizada; no segunda autoridad estética ni apariencia iOS impuesta a la web. |
| Explicación incomprensible | `como-asi`, solo si el usuario la invoca. No modifica archivos por sí sola. |

Claude Code puede invocar `/nombre`; Codex `$nombre`. Usa la variante instalada y las herramientas realmente disponibles. No añadas hooks, servicios ni permisos por cargar una skill. Si faltan, informa el requisito; no afirmes que se usaron. No cargar todas en cada tarea.

## Invariantes de implementación y revisión

- Enviar relevo no confirma cobertura; aceptar anticipadamente no activa antes de la ventana.
- Aceptar relevo, tomar incidente y resolverlo son acciones diferentes.
- Sin relevo: respaldo y aviso a jefatura; nunca extensión automática del turno saliente.
- La elegibilidad es por ventana/rol, no por excluir el nombre Rodrigo.
- Transiciones atómicas, idempotentes, con candidato/versión/ejecución vigentes. No mezclar respuestas tras reset.
- No cachear estado operativo de forma que oculte cambios; limpiar listeners/intervalos al desmontar.
- Toda mutación autorizada; GET de enlace no acepta ni acusa. No exponer tokens, claves de proveedor o tópicos privados en repo/estado público.
- Solo datos ficticios; no importar contactos, teléfonos, tickets ni salud reales.
- No añadir resolución de jefatura, integraciones laborales reales o scheduler autónomo sin acuerdo.

## Terminar una tarea

Ejecuta los tests/build aplicables con comandos reales; muestra resultado y límites. Verifica UI renderizada si cambió. Reproduce cada bug corregido. Separa propuesta, implementación y prueba; no declarar QA aprobado por generar tests. Documenta cambios de contrato en CONTRACTS y lenguaje en LANGUAGE. No hacer commit, publicar ni aplicar migraciones externas si no está autorizado por el encargo. La entrega final requiere comprobar commit, deploy, URL y acceso público; no basta un mensaje de éxito del proveedor.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
