# Relevo

**Entrega el turno. Recupera la noche.**

Hackatón Señales · Caso 02 · Rodrigo. Un traspaso de turno con responsable y respaldo, para que Rodrigo pueda cerrar el notebook sabiendo quién sigue.

- Demo: <https://relevo-dun.vercel.app/>. La portada `/` explica cómo probarla por tu cuenta.
- Hecho por Diego Navarro durante el evento, 23 y 24 de octubre de 2026.

## Qué problema decidimos atacar

Rodrigo tiene 41 años y trabaja en soporte TI en Concepción, con turnos que rotan cada semana y guardia por WhatsApp. Hace catorce meses que duerme cinco o seis horas y ya lo da por normal. Probó melatonina, sacar el celular de la pieza y un reloj. Dice que si no revisa los tickets antes de acostarse, igual no se duerme.

Atacamos una barrera concreta: **no logra dar por terminado el trabajo**, por miedo a que algo quede sin atender. Nuestra hipótesis es que revisa porque no sabe quién sigue. Un traspaso explícito, aceptado por otra persona y con un respaldo si esa persona no responde, puede darle una razón para dejar de revisar.

## Por qué ese y no otro

- **Dos noches de su ficha nos dieron la pista.** Cerró el notebook a las 23:58 y durmió 4 h 20; otro día lo cerró a las 22:10 y durmió 6 h 40. Cerrar antes coincidió con dormir más. Son dos observaciones, no una prueba de causa.
- **Sus intentos eran rutinas de sueño.** Ninguno le daba una forma de dejar de estar disponible. Relevo no le suma otra rutina: reemplaza la revisión nocturna de tickets.
- **Es un problema multifactorial y elegimos una parte.** Turnos rotativos, tercer café a las 19:20, ronquido fuerte y la idea de que «siempre ha sido así» también pesan. No afirmamos que el trabajo sea el factor principal. El ronquido fuerte merece una consulta profesional, que no depende de esta app.
- **Elegimos el caso 02 porque nos interesa el sueño.** De los seis casos, es el tema que más queríamos trabajar.

## Qué construimos

Una noche completa en Despensa Sur, una cadena ficticia de 30 supermercados del Biobío:

1. **Entregar.** Rodrigo envía el relevo en un paso desde `/rodrigo`. Paula lo acepta desde su teléfono. Enviar el relevo no confirma cobertura: la confirma la aceptación.
2. **Decidir.** El público reporta fallas por QR en `/canal`. La IA (OpenRouter) clasifica cada reporte; una política visible de la empresa, no el modelo, decide si avisa. Lo que puede esperar queda en cola; un local que no puede cobrar avisa a Paula por ntfy.
3. **Escalar.** Si Paula no toma el incidente en 30 s, el aviso pasa a Tomás, su respaldo. Rodrigo no es respaldo elegible en esa ventana.
4. **Revisar.** En la mañana, `/rodrigo` y el proyector muestran quién quedó a cargo y qué pasó. El incidente queda tomado, no necesariamente resuelto.

Si nadie acepta el relevo, se avisa a jefatura y queda «Sin cobertura confirmada». El turno de Rodrigo nunca se prolonga automáticamente. Aceptar el relevo, tomar un incidente y resolverlo son estados distintos.

## Qué dejamos fuera

- Integraciones reales con WhatsApp y ticketera. El canal de la demo es simulado.
- Gestión de turnos: rotación, preferencias e intercambios.
- Editor de políticas: la de Despensa Sur está fija en el código.
- Que jefatura resuelva el hueco de cobertura, y un scheduler autónomo: los plazos avanzan cuando el proyector consulta el estado.
- Medición del sueño y cualquier dato de salud.
- Validación legal laboral y clínica.

Solo Paula recibe avisos en un teléfono físico; Tomás y Carla (jefatura) se ven dentro de la app. Un relevo aceptado no demuestra que Rodrigo duerma una hora más: eso exigiría medirlo durante semanas.

## Ejecutar localmente

Next.js (App Router), React, TypeScript, Tailwind, shadcn/ui y Prisma sobre PostgreSQL. OpenRouter clasifica los reportes y ntfy envía el aviso a Paula. Requisitos: Node 24 (`.nvmrc`), pnpm 12 y un PostgreSQL local.

```sh
pnpm install --frozen-lockfile
cp .env.example .env   # DATABASE_URL, OPERATOR_SECRET, APP_ORIGIN
pnpm db:migrate:local && pnpm db:seed:local
pnpm dev
```

Abre `http://127.0.0.1:3000`. Pruebas: `pnpm test`; después de `pnpm build`, `pnpm test:e2e` y `pnpm test:e2e:flujos` (recorrido de la demo y ramas del relevo). Detalle de bases, variables y resultados en [SETUP](docs/SETUP.md).

## Documentación

[Producto](PRODUCT.md) · [Contratos](docs/CONTRACTS.md) · [Diseño](DESIGN.md) · [Lenguaje](docs/LANGUAGE.md) · [Demo](docs/DEMO.md) · [QA](docs/QA.md) · [Instrucciones para agentes](AGENTS.md)

Todos los datos son ficticios: Despensa Sur, Paula, Tomás, Carla, tickets y reportes. No se cargan contactos, teléfonos ni datos de salud de personas reales. README de una página según las [bases oficiales](https://hack.makana.cl/bases.html).
