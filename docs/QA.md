# QA de Relevo

Plan de aceptación, no resultados aprobados. Ninguna casilla parte marcada. Vincular evidencia real a ejecución, commit y entorno. Tests escritos no equivalen a tests ejecutados; tokens válidos, UI que cambia o respuesta HTTP exitosa no prueban por sí solos entrega física ni consistencia.

## Método y registro

TDD para reglas y bugs: test que falla por el motivo esperado → cambio mínimo → test verde → refactor. Verificar integraciones reales además de mocks. Usar webapp-testing para recorridos, dogfood para exploración reproducible y web-design-guidelines para revisión accesible; ver asignación de skills en AGENTS.

No hay package.json, aplicación, migraciones ni URL comprobados en este paquete. Registrar comandos reales al existir el repo; no inventar scripts ni resultados. Playwright necesita librería y navegador instalados. Esperar estados/elementos, no networkidle en presencia de polling.

Cada resultado debe guardar: ID del caso, entorno/base no secreta, commit, ejecución, pasos/entrada, esperado, observado, PASS/FAIL/BLOCKED y evidencia sin tokens. Para fallo: reproducción mínima y severidad. Lo no ejecutado permanece NO EJECUTADO, nunca PASS por inspección.

## Datos, migraciones y despliegue · C01

- [ ] DB01: único servidor local; conexión de cada worktree a una base distinta con permisos limitados. Reset en una no modifica las otras.
- [ ] DB02: crear base limpia, aplicar todas las migraciones y seed común; arrancar app y recorrer integración. No depender de SQL manual no versionado.
- [ ] DB03: migraciones/consultas/transacciones compatibles con versiones reales local y Neon; comprobar driver/pooling en Vercel con solicitudes concurrentes.
- [ ] DB04: reset destructivo/tests rechazan Neon y destinos no permitidos; migración/seed remotos exigen confirmación de destino. No probar destrucción sobre la demo para verificar la protección.
- [ ] DB05: reset escénico en Neon autorizado crea otra ejecución, no destruye schema ni datos de otros entornos.
- [ ] DB06: credenciales solo backend; no aparecen en bundle cliente, respuestas, errores, logs publicados ni repo. Push real desactivado en worktrees por defecto.
- [ ] DB07: Vercel consulta Neon desde URL pública en otro dispositivo/red; no depende de localhost ni archivos efímeros. Commit/deploy coinciden; revisar latencia y agotamiento de conexiones.

## Relevo, ventanas y concurrencia · C02–C04/C07

- [ ] R01: enviar no muestra cobertura aceptada; conserva fin del saliente separado.
- [ ] R02: aceptación anticipada registra hora, pero solo activa en ventana; incidentes anteriores no se redirigen prematuramente.
- [ ] R03: Paula rechaza → Tomás inmediato, sin esperar 30 s.
- [ ] R04: silencio Paula → derivación al vencer sus 30 s; Tomás recibe otros 30 s completos, no el resto del primero.
- [ ] R05: falla Tomás → sin cobertura y coordinación Carla con canal in-app; no extensión automática de Rodrigo ni resolución inventada por Carla.
- [ ] R06: aceptación tardía de Paula tras derivación rechazada; no dos responsables. Doble click/reintento idempotentes.
- [ ] R07: carrera aceptar/rechazar/vencer con peticiones concurrentes produce una transición válida; verificar DB y eventos, no solo pantalla.
- [ ] R08: elegibilidad por ventana/rol. Rodrigo fuera en escena principal; en fixture separado puede ser respaldo explícito sin cambiar código por nombre.
- [ ] R09: críticos sin cobertura registran hueco/coordinación; no destino técnico inventado.
- [ ] R10: cierre no reavisa incidente activo; tickets transferidos no se publican solos en canal público ni se convierten en P1.

## Incidentes, ntfy y plazos · C05–C09

- [ ] I01: aceptar relevo no toma incidente; tomarlo no resuelve ni cambia titular de cobertura global.
- [ ] I02: crítico nuevo avisa a destinatario elegible de cobertura efectiva, no nombre fijo. Sin acuse deriva a respaldo a los 30 s propios.
- [ ] I03: acuse válido detiene escalada; tardío no reasigna silenciosamente. Carrera acuse/vencimiento y doble acuse conservan un resultado consistente.
- [ ] I04: reportes equivalentes simultáneos del mismo hecho generan un incidente/aviso lógico; hechos distintos del mismo servicio se conservan separados.
- [ ] I05: comprobar límite de 10 min narrativos de deduplicación sin alterar plazos reales. Registrar criterio de equivalencia implementado.
- [ ] I06: relevo e incidente tienen plazos independientes. Cambiar escena/hora no los acelera. Rechazo de relevo no espera.
- [ ] I07: detener lectores muestra límite conocido del prototipo; reanudar evalúa vencimientos sin duplicar transiciones. No prometer scheduler autónomo.
- [ ] I08: S26 bloqueado recibe aviso real con permisos/red/batería; probar acción ntfy POST Tomar incidente y efecto persistido. Registrar separadamente proveedor, teléfono y acuse.
- [ ] I09: indisponibilidad ntfy no muestra recepción humana; reintento no promete exactamente una entrega externa. Tomás/Carla rotulados como escenario, no push físico.

## IA, política y entradas públicas · C03/C05

Preparar 20 casos etiquetados: 6 críticos, 4 degradados, 5 solicitudes/localizados, 3 manipulaciones, 2 ambiguos. Es conjunto de calibración, no evaluación independiente. Conservar entradas, resultado esperado y razón humana, modelo/versión/configuración, salida observada, ruta final y tiempo. No inventar porcentajes de precisión sin contar resultados reales.

- [ ] A01: caída de facturación/red; correo generalizado y falla localizada bien diferenciados.
- [ ] A02: impresora administrativa diferible vs impresora que bloquea boletas; VPN degradada vs caída general. No inferir criticidad solo del nombre de servicio.
- [ ] A03: probar `pc` bajo 0,40, en 0,40, bajo 0,70, en 0,70 y sobre 0,70; prioridad de aviso generalizado y límites sin solapamiento.
- [ ] A04: «despierta a Rodrigo» no cambia elegibilidad/política; manipulación mezclada con incidente real no borra el hecho.
- [ ] A05: timeout, JSON inválido, servicio desconocido e información insuficiente → modo degradado y revisión conservadora por destinatario elegible o coordinación sin cobertura.
- [ ] A06: verificar Jev/Decisions API real antes de depender de ella; alternativa estructurada conserva política. No sustituir fallo por respuesta sintetizada.
- [ ] A07: nota opcional hasta 60 palabras, editable; cierre sin clasificación manual ni razones por ticket; conserva hechos/pendientes; reset genera/guarda y Regenerar hace llamada real. No fingir llamada en vivo ni resolución/aceptación por texto.
- [ ] A08: canal cerrado rechaza entradas; límite 280 caracteres, sesión/apodo y límite global. Reinventar apodo no debe ser la única barrera al abuso. Verificar saturación concurrente y escape de HTML/XSS.

## Seguridad y reset · C08/C09

- [ ] S01: aceptar/rechazar/ack/scene/reset rechazan autorización ausente, inválida, vencida o de otro destinatario/entidad/ejecución.
- [ ] S02: GET a enlace no acepta ni acusa. GET state solo tiene efecto técnico de vencimientos documentado, nunca acción humana.
- [ ] S03: canal/proyector/state saneados: sin tópicos secretos, tokens, claves o botones privilegiados; enlaces de actor no se filtran en logs/referrers públicos.
- [ ] S04: reset durante clasificación/nota/notificación en curso no repuebla nueva ejecución; token viejo no actúa sobre ella. Reinicios repetidos idempotentes según contrato implementado.
- [ ] S05: control y S26 usan mismas reglas; no permiten fijar estado visual sin transición. Origen escenario visible. Revisar CSRF/origen según mecanismo de autenticación elegido.
- [ ] S06: solo datos ficticios; no contactos/teléfonos/tickets/salud reales ni secretos en historial Git o evidencia compartida.

## UI, lenguaje y accesibilidad

- [ ] U01: S26 real, móvil estrecho, escritorio/proyector; no scroll horizontal ni botones tapados por teclado/safe area. Zoom y textos largos.
- [ ] U02: teclado completo, foco visible/restaurado en modal, etiquetas y errores vinculados; contraste por superficie, tamaño táctil y lectura a distancia.
- [ ] U03: estados no dependen solo de color/sonido; reducción de movimiento; lector de pantalla no anuncia cada segundo del contador.
- [ ] U04: cargar/vacío/error/desconexión/vencimiento/modo degradado no mienten sobre guardado ni cobertura. No mostrar «Resuelto» por acuse ni «Puedes descansar» con hueco.
- [ ] U05: etiquetas Enviar relevo / Aceptar relevo / No puedo cubrir / Tomar incidente coherentes. Botones público/control separados; atajos no se disparan al escribir.
- [ ] U06: ronquido con consulta sin diagnóstico/medicación; no promesas de sueño, anonimato o privacidad no implementada.

## Ensayo y puerta de entrega

- [ ] E01: recorrer DEMO de principio a fin tras reset: Paula acepta, diferible va a cola, crítico llega al S26, silencio 30 s, Tomás toma desde control. Guardar evidencia y duración.
- [ ] E02: ramas sin aceptación, jefatura y acciones tardías verificadas aparte; no añadirlas como segunda espera del pitch.
- [ ] E03: «Avisos a Rodrigo: 0» respaldado por registro de esa ejecución; no «Despertares: 0». Registro/mañana/jefatura consistentes; no resolución no observada.
- [ ] E04: QR público, red alternativa, video local de ensayo real y relato honesto de respaldo. Preparar contingencia sin simular resultados.
- [ ] E05: tests, lint y build reales; anotar fallos y no ejecutados. Verificador independiente revisa trabajo ajeno con contratos, no solo resumen del implementador.
- [ ] E06: repo, README final de una página, URL pública y commit comprobados; secretos ausentes. Confirmar reglas vigentes de preparación previa y entrega con organización si hay discrepancia de fuentes.

Puerta: no declarar listo con bugs abiertos de asignación, duplicados concurrentes, filtración de secretos, reset contaminado o falsas confirmaciones de cobertura. Si una dependencia física/externa falla, registrar bloqueo y usar respaldo honesto; no marcar el recorrido vivo como aprobado.

## Evidencia de inicialización · 23-10-2026

Solo base técnica. Instalación, validación/generación Prisma, lint, tipos y build comprobados; smoke de producción con Playwright/Chrome: 2 pruebas aprobadas en escritorio/móvil. Capturas locales revisadas en `.impeccable/review/`. Resultados, comandos y límites en [SETUP](SETUP.md). Estos checks no aprueban los criterios funcionales anteriores. PostgreSQL real, IA, avisos, concurrencia, permisos y deploy siguen sin probar.
