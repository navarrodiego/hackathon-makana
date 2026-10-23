# Base técnica de Relevo

Inicialización del 23-10-2026. Diego autorizó incorporar los materiales al entregable y limitó este encargo a la base técnica. Eligió Prisma por familiaridad; no se implementa el recorrido ni se congelan entidades/DTO en este paso.

## Entorno y dependencias

Node comprobado: 24.19.0. pnpm comprobado y fijado: 12.10.1. Las versiones directas están fijadas en `package.json`; `pnpm-lock.yaml` conserva las transitivas. pnpm valida peers estrictamente y permite scripts de instalación solo para los paquetes enumerados en `pnpm-workspace.yaml`.

| Componente | Versión instalada |
|---|---|
| Next.js / eslint-config-next | 16.4.2 |
| React / React DOM | 19.3.1 |
| Tailwind / plugin PostCSS | 4.3.3 |
| Prisma CLI / Client / adapter-pg | 7.10.1 |
| pg | 8.23.1 |
| TypeScript | 6.0.3 |
| ESLint | 9.39.5 |
| shadcn CLI | 4.22.1 |
| Playwright | 1.64.1 |

Se consultó npm al instalar. Excepciones deliberadas a `latest`: Prisma CLI apunta a 8.0.0-rc.27; se mantiene la última estable 7.10.1 junto a cliente/adaptador. TypeScript 7.0.2 excede el rango `<6.1.0` de typescript-eslint; ESLint 10.13.0 excede los peers de los plugins React/import/jsx-a11y usados por Next. Node/pnpm se fijan a las versiones del entorno comprobado, sin actualizar herramientas globales.

Prisma usa el generador `prisma-client`, salida local ignorada por Git y adaptador `pg`, según la [documentación de Prisma 7](https://docs.prisma.io/docs/orm/v7/core-concepts/supported-databases/database-drivers). Tailwind usa el [plugin oficial de PostCSS](https://tailwindcss.com/docs/installation/framework-guides/nextjs). shadcn queda configurado en `components.json` y `src/lib/utils.ts`; no hay catálogo de componentes importado sin necesidad.

## Instalación y ejecución

```sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm dev
```

Desarrollo: 127.0.0.1:3000. Otro worktree necesita su propio puerto: `pnpm dev --port 3001`. Build: `pnpm build`; servirlo: `pnpm start`. No hay acceso remoto ni publicación automática.

La página inicial es un Server Component estático: sin polling, llamadas a proveedores ni conexión a DB. Public Sans se sirve desde la app mediante Fontsource. Los tokens de la pantalla viven en `src/app/globals.css`; respetan DESIGN.md. No existe todavía una biblioteca visual completa ni un estado operativo.

## Variables privadas

Copia `.env.example` a `.env` y configura solo los servicios que vayas a comprobar. `.env` está ignorado. No usar prefijos `NEXT_PUBLIC_` para secretos ni volcar las URLs privadas en evidencia.

| Variable | Uso previsto |
|---|---|
| `DATABASE_URL` | Conexión de aplicación privada; PostgreSQL local o pooled Neon |
| `DIRECT_URL` | Conexión directa para futuras migraciones; config Prisma prefiere esta si existe |
| `OPENROUTER_API_KEY` | Integración IA pendiente |
| `NTFY_ENABLED` | `false` por defecto; integración pendiente |
| `NTFY_BASE_URL`, `NTFY_TOPIC` | Proveedor y tópico privado; aún sin envíos |
| `CONTROL_SECRET` | Reserva para autorización pendiente; no hay control implementado |

`src/lib/server/db.ts` solo puede importarse en servidor. Crea el cliente bajo demanda, comparte un pool por proceso y limita conexiones a 3 por instancia; Vercel puede crear varias instancias. Usar la conexión pooled de Neon cuando se configure la demo, comprobar presupuesto global de conexiones y no desactivar validación TLS.

No se crea un segundo servidor PostgreSQL ni se modifican bases existentes. Cada entorno debe tener base/rol privados. `pnpm db:check` usa la URL explícita de aplicación y ejecuta `SELECT 1` dentro de una transacción, sin cambiar datos. El comando no muestra credenciales. No se ofrecen migraciones, seed ni reset hasta acordar el schema. Las migraciones remotas siguen requiriendo acción explícita y destino verificado.

## Verificación

- `pnpm db:validate`: valida schema sin conectar a DB.
- `pnpm db:generate`: genera cliente sin conectar a DB.
- `pnpm lint`: ESLint, cero advertencias admitidas.
- `pnpm typecheck`: genera tipos de rutas y ejecuta TypeScript. Requiere cliente Prisma generado.
- `pnpm build`: genera Prisma y compila producción.
- `pnpm exec playwright install chromium`: prepara el navegador. Alternativa si ya tienes Chrome: `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e`. La configuración admite `E2E_PORT` (por defecto 34137) para evitar conflictos con otros servidores.
- `pnpm test:e2e`: usa el build de producción en puerto 34137 y comprueba móvil/escritorio, HTTP, contenido honesto, errores de página, idioma y ausencia de desborde horizontal. Capturas en `.impeccable/review/`.

No hay tests de dominio porque no hay lógica de negocio implementada. La prueba de arranque no acredita cobertura, IA, seguridad de acciones, avisos físicos ni conformidad WCAG. No hay deploy, commit nuevo ni migraciones externas en este encargo.

### Resultado comprobado

- Instalación `pnpm install --frozen-lockfile`: pasó con versiones exactas y validación estricta de peers.
- `pnpm db:validate` y `pnpm db:generate`: pasaron con Prisma 7.10.1, sin credenciales.
- `pnpm lint`, `pnpm typecheck` y `pnpm build`: pasaron. Build de `/` estático.
- `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e`: **2 pruebas aprobadas**, escritorio y móvil, contra build de producción. Capturas revisadas visualmente; detector Impeccable sin hallazgos en página/CSS.
- La descarga de Chromium se interrumpió por lentitud; se reutilizó Google Chrome instalado. No se afirma que `playwright install chromium` haya terminado.
- El primer intento E2E se detuvo porque 3100 estaba ocupado; se cambió el puerto de pruebas a 34137 sin cerrar procesos ajenos.
- PostgreSQL en `127.0.0.1:5432` no respondió. No se ejecutó `db:check` contra una base real ni se crearon roles/bases. Pool y transacciones quedan preparados, sin acreditarse su funcionamiento en local/Neon.
- Neon, Vercel, IA, ntfy y S26: sin conexión ni verificación en esta tarea.
- `pnpm dev --port 34138`: arrancó y respondió HTTP 200; servidor detenido tras la comprobación.
- `pnpm exec shadcn info`: reconoce Next App Router, RSC, TypeScript, Tailwind v4 y aliases. Sin componentes instalados, según alcance.
- Revisión independiente Impeccable: `ship` para esta pantalla técnica estática, sin hallazgos materiales; no acredita producto completo. DESIGN.md se conserva como dirección aprobada; no se fabrica una biblioteca/sidecar sin componentes.
