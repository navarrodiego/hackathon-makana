# Relevo

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Decisión aprobada: Next.js App Router, Tailwind + shadcn/ui, PostgreSQL local, Neon para la demo y Vercel. OpenRouter para la clasificación del canal (el cierre no usa IA desde el 24-10-2026); ntfy para el S26 que representa a Paula. Jev previsto `typesafe/jev-1.14` por Decisions API alfa; disponibilidad, salida y calidad en chileno deben comprobarse. Alternativa acordada: modelo de chat con salida estructurada, misma política. Inicialización técnica autorizada el 23-10-2026: Next.js con Prisma ORM y adaptador PostgreSQL, sin modelos ni recorrido operativo. El alcance funcional que sigue es objetivo; no hay despliegue comprobado. Un único servidor PostgreSQL local aloja bases separadas por worktree y una de integración. Neon conserva los datos compartidos de la demo pública; mismas migraciones/seed, conexión solo backend, sin servicios ni SDK de Supabase.

## Users

Persona principal: Rodrigo, 41 años, soporte TI en Concepción, turnos rotativos y guardia por WhatsApp. Vive con su pareja e hijo de 6 años. Personas secundarias del escenario: entrante Paula, respaldo Tomás y jefatura Carla. El jurado representa reportantes mediante un canal web por QR.

Rodrigo es un personaje publicado del caso; Paula, Tomás, Carla y el retail usado para el escenario son construcciones de la demo, no hechos de su ficha.

## Product Purpose

**Entrega el turno. Recupera la noche.**

Hacer explícito quién recibe la cobertura y quién atiende un incidente, para que Rodrigo pueda terminar el trabajo sin tener que perseguir personalmente un reemplazo ni seguir revisando por miedo a que algo quede sin atender.

Éxito del caso: que duerma una hora más. Lo que la demo verifica es un mecanismo previo: relevo aceptado, cobertura efectiva, avisos y atención asumida por otra persona. No mide sueño, no prueba mejora clínica ni uso sostenido.

## Positioning

La apuesta del proyecto es conectar el cierre individual con un respaldo operativo visible. No afirmamos haber inventado turnos, triage o escalamiento, ya disponibles en herramientas como PagerDuty. No se ha demostrado diferenciación comercial exclusiva ni validación con usuarios reales.

## Operating Context

### Hechos de la ficha

- Cinco horas de sueño en semanas de noche y seis en semanas de día desde hace catorce meses; lo da por normal.
- Cerró el notebook a las 23:58 y durmió 4 h 20; otro día cerró a las 22:10 y durmió 6 h 40. Son dos observaciones, no prueba causal.
- Tercer café a las 19:20, celular con funciones de despertador/guardia/distracción, grupo que suena a cualquier hora y temor a que algo se caiga.
- Intentos: melatonina, sacar el celular de la pieza y reloj abandonado. Dice que si no revisa tickets no se duerme.
- Irritabilidad, un ticket mal cerrado de madrugada, ronquido fuerte según su pareja y un amigo que ofrece pastillas.

El problema es multifactorial. Elegimos una barrera explícita y abordable, no el factor principal demostrado. La app no sustituye evaluar ronquido fuerte ni recomienda medicación; la consulta no depende de que Relevo funcione. No se añade un módulo por cada factor.

### Condiciones e hipótesis del escenario

Empresa ficticia: retail del Biobío con unos 30 locales; facturación considerada crítica. Hay una ventana de cobertura acordada, persona entrante y respaldo. La ficha no confirma esa organización, ticketera, modalidad contractual, permisos o pagos.

El registro y la cobertura del sistema son continuos, 24/7. No implica disponibilidad continua de una persona. La demo usa 22:10 como fin de turno compatible, no como cierre universal de semanas nocturnas. La mañana es una vista del registro, no una base de datos exclusiva de noche.

## Capabilities and Constraints

### Alcance objetivo, no construido acreditado

1. Cierre en un paso: Rodrigo ve sus pendientes del retail y envía el relevo. No clasifica tickets ni escribe razones; los que necesitan seguimiento vienen destacados en el escenario, sin convertir nada en urgencia. Resumen de traspaso fijo, opcional y editable; sin IA. Decisiones de Diego del 23-10-2026 y 24-10-2026.
2. Envío y aceptación/rechazo del relevo. Aceptación anticipada efectiva desde la ventana.
3. Paula rechaza o no responde: Tomás; si también falla, aviso a Carla y Sin cobertura confirmada. No extensión automática de Rodrigo.
4. Canal público QR de reportes ficticios; política visible sobre clasificación IA.
5. Incidentes urgentes con aviso, acuse individual y escalada a respaldo. Tomar no es resolver ni aceptar todo el turno.
6. Registro continuo y resumen de la noche en `/rodrigo`. Decisión de Diego del 23-10-2026: la consulta por ronquido fuerte sale de la app y, por ahora, tampoco va en el pitch.
7. Control protegido, reinicio, guion de reportes y video de respaldo.

Plazos de demo: 30 s por candidato, independientes para relevo e incidente; rechazo de relevo deriva inmediatamente. Los detalles están en [CONTRACTS](docs/CONTRACTS.md).

### Recorrido principal cerrado

Paula acepta el relevo. Un reporte diferible queda en cola; un crítico genera push real al S26. Paula no pulsa Tomar incidente. Vence su plazo y escala a Tomás; el presentador ejecuta su acuse desde control, con origen de escenario visible. Rodrigo no es respaldo elegible en esa ventana. Las ramas de fallo del relevo se prueban aparte, no se añaden como otra espera al pitch.

### Límites explícitos

- No hay integración real con WhatsApp/ticketera ni bloqueo de su WhatsApp personal.
- Solo Paula tiene push físico previsto. Tomás/Carla se representan in-app; no fingir sus dispositivos.
- La jefatura recibe coordinación; asumir cobertura/asignar reemplazo queda fuera.
- Sin solver, preferencias/intercambios, editor de políticas, incentivos, gamificación, seguimiento de sueño o tratamiento clínico.
- Vencimientos evaluados cuando el proyector consulta: sin lector no hay garantía de ejecución puntual. Scheduler autónomo no incluido.
- wa.me es opcional y solo comparte un borrador; no crea cobertura ni confirma envío.
- Resolución solo como evento explícito si se implementa; el recorrido principal termina en incidente tomado, no resuelto.

## Brand Commitments

Nombre Relevo; eslogan aprobado. Tuteo chileno sobrio, sin modismos ni humor en alertas. Terminología canónica en [LANGUAGE](docs/LANGUAGE.md); identidad visual en [DESIGN](DESIGN.md). No rediseñar la marca ni aplicar aspecto Apple por defecto.

## Evidence on Hand

Existe un master plan de decisiones, un diseño visual previo y una skill editorial. Este paquete deriva de ellos. Se incorporó la base técnica; su evidencia de ejecución se registra en docs/SETUP.md. No se verificaron credenciales, API del modelo, entrega al S26 o URL de producción. No existen aquí entrevistas con Rodrigo, pruebas longitudinales, clientes, ROI ni resultados clínicos. Los cinco pendientes y los reportes de demo son sintéticos.

Fuentes del caso/reglas: https://hack.makana.cl/ y https://hack.makana.cl/bases.html . No se atribuye al organizador validación de esta solución.

## Product Principles

- Responsabilidad confirmada, no tranquilidad fingida.
- Menos revisión individual, no otra rutina de bienestar.
- Personas deciden y aceptan; IA propone y clasifica.
- Separar hechos, hipótesis, decisiones, implementación y evidencia.
- Recorrido completo antes que catálogo de funciones.

## Accessibility & Inclusion

Priorizar lectura bajo cansancio, contraste, interacción táctil, teclado, estados accesibles y movimiento reducido. Ningún significado solo por color/sonido. Las necesidades concretas de accesibilidad de Rodrigo no están especificadas; no se presume validación ni certificación. La demo no usa datos personales reales.
