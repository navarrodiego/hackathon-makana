# Relevo

**Entrega el turno. Recupera la noche.**

Proyecto para el caso Rodrigo de la Hackatón Señales: un relevo explícito para terminar el trabajo sabiendo quién sigue.

> Estado: base técnica inicializada con autorización de Diego. Incluye una pantalla inicial; el recorrido de relevo, reportes, avisos y cobertura aún no está implementado. No hay deploy ni URL pública verificados.

## Qué problema elegimos y por qué

Rodrigo trabaja en soporte TI con turnos rotativos y duerme poco. No deja de revisar tickets por temor a que algo quede sin atender. Su situación es multifactorial: horarios, café tardío, normalización y ronquido merecen atención; no afirmamos que la guardia sea el factor principal.

Elegimos conectar su cierre con cobertura aceptada, avisos y respaldo. Dos observaciones de su ficha relacionan cierre temprano y más sueño, pero no prueban causalidad. El ronquido requiere considerar consulta profesional, no una solución clínica de esta app.

## Qué busca mostrar la demo

Rodrigo revisa y envía pendientes. Paula acepta el relevo. El público reporta por QR: lo diferible va a cola y un crítico avisa al S26 de Paula. Sin acuse, escala a Tomás, que toma el incidente desde el control del escenario. Rodrigo no es respaldo elegible en esa ventana.

Aceptar relevo, tomar incidente y resolverlo son estados diferentes. La rama sin aceptación deriva al respaldo y, si falla, avisa a jefatura sin prolongar automáticamente al saliente. El registro es continuo, no solo nocturno.

## Qué queda fuera

Integraciones reales con WhatsApp/ticketera, gestión completa de turnos, resolución del hueco por jefatura, scheduler autónomo, medición de sueño y validación legal/clínica. Un relevo aceptado no demuestra dormir una hora más. El canal y los datos son de demostración; solo se prevé push físico a Paula.

## Ejecución y acceso

Next.js App Router, React, TypeScript, Tailwind, configuración de shadcn/ui y Prisma con adaptador PostgreSQL. PostgreSQL local para desarrollo; Neon y Vercel previstos para la demo. OpenRouter y ntfy aún sin implementación.

Requisitos: Node 24 (ver `.nvmrc`) y pnpm 12. La pantalla inicial funciona sin secretos.

```sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm dev
```

Abre `http://127.0.0.1:3000`. Para preparar conexión privada, copia `.env.example` a `.env` y configura `DATABASE_URL` de tu base local. No hay modelos de negocio, migraciones ni seed.

Verificación: `pnpm lint`, `pnpm typecheck`, `pnpm db:validate`, `pnpm build`. Para navegador: `pnpm exec playwright install chromium` y `pnpm test:e2e` tras el build. Instalación, versiones, conexión y resultados: [SETUP](docs/SETUP.md).

## Documentación

[Producto](PRODUCT.md) · [Contratos](docs/CONTRACTS.md) · [Diseño](DESIGN.md) · [Lenguaje](docs/LANGUAGE.md) · [Demo](docs/DEMO.md) · [QA](docs/QA.md) · [Instrucciones para agentes](AGENTS.md)

Todos los datos operacionales de la demo son ficticios. No se cargan contactos, tickets, teléfonos ni datos de salud de personas reales. No publicar secretos. Repositorio y README de una página requeridos por las [bases oficiales](https://hack.makana.cl/bases.html).
