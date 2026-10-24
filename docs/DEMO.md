# Demo de Relevo

Guion operativo aprobado de cinco minutos, no evidencia de ejecución. La demo termina con un incidente tomado, no necesariamente resuelto. PRODUCT define alcance; CONTRACTS define reglas y LANGUAGE el texto. Probar este recorrido completo antes de presentarlo.

## Preparación

### Aplicación y datos

- Deploy Vercel con base Neon; verificar acceso público desde otro dispositivo/red, commit correcto y secretos solo servidor. Localhost no sirve como backend de la demo pública.
- Semilla ficticia: Rodrigo saliente 22:10; Paula entrante y push físico; Tomás respaldo; Carla coordinación in-app. Rodrigo no es respaldo elegible en esta ventana.
- Cargar cinco pendientes de CONTRACTS C03 y nota guardada en reset, marcada como borrador. No introducir tickets/contactos/salud reales.
- Reset escénico protegido, nueva ejecución y tokens vigentes. Comprobar que el canal comienza cerrado y no queda un incidente de ensayos anteriores.
- Mantener proyector consultando cada segundo: esas peticiones evalúan vencimientos. Mostrar estado de conexión. No afirmar autonomía si no hay lector.
- Plazos reales de 30 s por candidato, separados para relevo e incidente. Las escenas horarias no aceleran ese tiempo.

### Teléfono, pantalla y respaldo

- S26 con ntfy y permisos de notificación/batería probados; tópico secreto de demo, no el de pruebas. Verificar recepción con teléfono bloqueado, acción POST y redes disponibles.
- Paula revisa/acepta relevo en web; después llega otro aviso por incidente. Son dos acciones distintas.
- Tomás/Carla solo in-app con canal/origen visible; no prometer otro teléfono.
- Abrir proyector y control protegido en superficies separadas. No proyectar tokens, contraseñas, consola ni botones de control público.
- Probar QR a URL real de producción, zoom, resolución, adaptadores y lectura a distancia. No depender de audio.
- Al abrir el canal, el proyector muestra el QR a pantalla completa con quién está a cargo y los avisos a Rodrigo; vuelve solo al panel a los 30 s o con el primer incidente, lo que ocurra antes. Esos 30 s son la misma espera común de los teléfonos: cuentan desde que control abre el canal (hora guardada en el servidor), así que recargar el proyector no la reinicia y todos los teléfonos pasan al formulario cuando el QR grande cede. El QR pequeño sigue en el pie.
- El proyector es para la sala: quién está a cargo, el incidente en curso con su plazo, Avisos a Rodrigo y un relato breve de lo que pasó. No muestra escenas, ejecuciones ni resultados por ntfy/in-app; para mostrarlos al jurado técnico, usar /control (registro completo y resultados de aviso) sin proyectar sus botones ni credenciales.
- Video local de un ensayo real y red alternativa probados. No existe un video acreditado por este documento.

## Recorrido principal: cinco minutos

| Tiempo | Acción y relato |
|---|---|
| 0:00–0:15 | Abrir con el cierre 23:58 de Rodrigo; QR pequeño disponible. Audio breve opcional. |
| 0:15–0:45 | Contrastar dos observaciones: cierre 23:58/4 h 20 de sueño y 22:10/6 h 40. Coincidencia, no causalidad probada. |
| 0:45–1:15 | Situación multifactorial: turnos, café 19:20, normalización y ronquido. Elegimos la dificultad para terminar el trabajo, sin declararla causa principal. |
| 1:15–1:55 | Mostrar pendientes con #470 destacado para seguimiento y la nota opcional; enviar relevo en un paso. Paula lo acepta desde S26 antes de su plazo. Mostrar aceptación/ventana efectiva y que Rodrigo no es respaldo. |
| 1:55–3:25 | Abrir canal y QR grande: «Intenten despertar a Rodrigo». Durante 30 s el público solo escribe su nombre y espera; al ceder el QR, todos pueden enviar. Diferible queda en cola. Facturación caída avisa a Paula. Pedir que no pulse Tomar incidente. Esperar 30 s reales; escala a Tomás y el presentador registra su acuse desde control. Origen escenario visible. |
| 3:25–3:50 | Control pasa a la escena de mañana; `/rodrigo` muestra el resumen de la noche: avisos a Rodrigo, cobertura e «El incidente tiene responsable». No afirmar resolución. El relato queda en el proyector; el registro completo, en /control. |
| 3:50–4:20 | Mecanismo de continuidad: menos revisión, receptor confirmado y evidencia de responsabilidad. No afirmar más sueño medido ni adopción real. |
| 4:20–4:45 | Mostrar En la demo / Fuera de esta demo: canal simulado, solo un teléfono físico y condiciones empresariales hipotéticas. |
| 4:45–5:00 | «Para dormir, primero necesita poder dejar de trabajar». Relevo · Entrega el turno. Recupera la noche. |

**Secuencia que no se cambia:** Paula sí acepta cobertura; luego no acusa un incidente; Tomás lo toma. No añadir el fallo de aceptación como segunda espera durante el pitch.

## Participación y control

Canal: nombre de quien participa, 280 caracteres, cinco envíos por sesión y límite global configurado. No solicitar datos personales reales. Chips/reportes guionados: impresora administrativa, VPN lenta, orden de despertar a Rodrigo y caída general de facturación. Una orden no cambia la elegibilidad.

Si a los 15 s de abrirse el envío (45 s desde abrir el canal) hay menos de tres reportes del público, inyectar reportes con I/P y origen identificado. No presentar entradas del control como aportes espontáneos del público. Deduplicar el mismo hecho para evitar una ráfaga de avisos.

| Atajo aprobado | Función |
|---|---|
| → / Espacio | Siguiente escena |
| ← | Escena anterior |
| O | Abrir/cerrar canal |
| I | Siguiente reporte guionado |
| P | Caída de facturación |
| Q | QR |
| M | Silencio del audio de la presentación, no prueba de silencio del teléfono |
| R R | Reset escénico protegido |

No ejecutar atajos al escribir en un input/textarea. Control invoca los mismos contratos que UI/ntfy; nunca pone un resultado ficticio solo en pantalla. Ningún atajo acorta deadlines sin hacerlo visible; el pitch principal usa espera real.

Si R R muestra «El estado cambió mientras actuabas», un reporte terminó de clasificarse justo antes del reinicio y no se reinició nada. Repetir R R. Decisión del 23-10-2026: el control no reintenta solo.

## Ramas para preguntas y QA, fuera del pitch principal

1. Paula rechaza: Tomás recibe solicitud inmediatamente.
2. Paula guarda silencio: Tomás recibe solicitud al vencer 30 s; su propio plazo empieza al derivar.
3. Tomás también falla: Sin cobertura confirmada; aviso a Carla in-app y fin del saliente independiente. No prolongar automáticamente Rodrigo.
4. Aceptación/acuse tardío: no reasignar; explicar derivación.
5. Crítico nuevo sin cobertura: registrar y elevar coordinación; no inventar responsable técnico ni ampliar turno.
6. Clasificador falla: modo degradado visible y revisión conservadora; no exhibir JSON ficticio como respuesta real.

## Plan B honesto

- **Poca participación:** reportes guionados identificados.
- **Fallo del modelo:** ruta de respaldo estructurada/mode degradado conforme a contratos; revelar el fallo, no fingir clasificación.
- **Push no observado:** verificar red/permisos/registro. «Envío aceptado por ntfy» no es recepción. Si se usa control para seguir, identificar acción de escenario y no afirmar push logrado.
- **Red principal falla:** cambiar a red alternativa previamente probada, sin asumir conectividad.
- **Demo inviable:** reproducir video local del ensayo y declarar que es grabación, no ejecución en vivo. Evitar gastar el pitch depurando.

## Después del ensayo

Guardar evidencia de ejecución/commit/URL, duración real, recepción física, acuse de Tomás, conteo de avisos y fallos. Repetir tras reset y no trasladar métricas de una ejecución a otra. Ver QA antes de declarar listo. Preparar README final de una página y acceso público del repo/deploy según reglas confirmadas; los documentos no autorizan preparación prohibida por el evento.
