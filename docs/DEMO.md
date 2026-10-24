# Demo de Relevo

Guion operativo aprobado de cinco minutos, no evidencia de ejecución. La demo termina con un incidente tomado, no necesariamente resuelto. PRODUCT define alcance; CONTRACTS define reglas y LANGUAGE el texto. Probar este recorrido completo antes de presentarlo.

## Preparación

### Aplicación y datos

- Deploy Vercel con base Neon; verificar acceso público desde otro dispositivo/red, commit correcto y secretos solo servidor. Localhost no sirve como backend de la demo pública.
- Semilla ficticia: Rodrigo saliente 22:10; Paula entrante y push físico; Tomás respaldo; Carla coordinación in-app. Rodrigo no es respaldo elegible en esta ventana.
- Cargar tres pendientes de CONTRACTS C03 en reset; la nota parte del resumen de traspaso fijo (sin IA) y es editable. No introducir tickets/contactos/salud reales.
- Reset escénico protegido, nueva ejecución y tokens vigentes. Comprobar que el canal comienza cerrado y no queda un incidente de ensayos anteriores.
- Mantener proyector consultando cada segundo: esas peticiones evalúan vencimientos. Mostrar estado de conexión. No afirmar autonomía si no hay lector.
- Plazos reales de 30 s por candidato, separados para relevo e incidente. Las escenas horarias no aceleran ese tiempo.

### Teléfono, pantalla y respaldo

- S26 con ntfy y permisos de notificación/batería probados; tópico secreto de demo, no el de pruebas. Verificar recepción con teléfono bloqueado, acción POST y redes disponibles.
- Paula revisa/acepta relevo en web; después llega otro aviso por incidente. Son dos acciones distintas.
- Tomás/Carla solo in-app con canal/origen visible; no prometer otro teléfono.
- Abrir proyector y control protegido en superficies separadas. No proyectar tokens, contraseñas, consola ni botones de control público.
- Probar QR a URL real de producción, zoom, resolución, adaptadores y lectura a distancia. No depender de audio.
- Al abrir el canal, el proyector muestra el QR a pantalla completa con quién está a cargo y los avisos a Rodrigo; vuelve solo al panel a los 30 s o con el primer incidente, lo que ocurra antes. Esos 30 s son la misma espera común de los teléfonos: cuentan desde que control abre el canal (hora guardada en el servidor), así que recargar el proyector no la reinicia y todos los teléfonos pasan al formulario cuando el QR grande cede. Desde control (sección «QR en el proyector», con su cuenta regresiva) se puede **Sumar 30 s al QR** si la gente no alcanzó a entrar (durante la espera también la alarga para todos) y, pasado el QR, **Mostrar QR otra vez** por 30 s para quien llegó tarde, sin volver a bloquear los envíos (decisión de Diego del 24-10-2026).
- El panel muestra «Reportes de la sala»: los últimos 6 reportes con el nombre y el texto que escribió cada persona (recortados a 40 y 100 caracteres) y qué pasó con cada uno. Se proyectan tal cual, sin moderación: riesgo asumido por el equipo.
- Contexto de la empresa (decisión de Diego del 23-10-2026): Rodrigo trabaja en Despensa Sur, cadena ficticia de 30 supermercados del Biobío; dos locales abren toda la noche. La política que se cuenta a la sala: un local que no puede cobrar → aviso a la guardia; algo de la oficina central → en cola. En la rama `claude/empresa-contexto-jev-clasificacion-46eea2` el proyector nombra la empresa en la cabecera y muestra esa política junto al QR, y `/canal` presenta la empresa y la política completa; esas pantallas aún no están integradas en main.
- El proyector es para la sala y la única pantalla que mira durante el pitch: antes del envío, el cierre de Rodrigo (solo conteos); después, quién está a cargo, el incidente en curso con su plazo, Avisos a Rodrigo y un relato breve de lo que pasó; en la escena de mañana, con el relevo enviado, cambia a un resumen de la noche: Avisos a Rodrigo como titular, quién quedó a cargo, cada incidente con quién lo tomó y cuántos reportes envió la sala (decisión de Diego del 24-10-2026). No muestra el nombre de las escenas, ejecuciones ni resultados por ntfy/in-app; para mostrarlos al jurado técnico, usar el registro reciente de /control sin proyectar sus botones ni credenciales.
- Video local de un ensayo real y red alternativa probados. No existe un video acreditado por este documento.

### Red mala y público en el canal

- Proyector y control en un hotspot propio (teléfono del equipo), no en el wifi del lugar. 40 teléfonos en ese wifi compiten con el proyector.
- Al mostrar el QR: «Si el wifi falla, usa tus datos móviles». El canal funciona igual con datos.
- Vercel: `DATABASE_URL` con el host `-pooler` de Neon y región de funciones igual a la de Neon. Comprobar con `curl -H 'accept-encoding: gzip' -D - -o /dev/null <URL>/api/state` que la respuesta trae `content-encoding: gzip`.
- Si cambia el entorno, aplicar la migración `202610240001_report_quota` en Neon antes de la demo (requiere autorización explícita). Sin ella, el reporte 51 falla con almacenamiento no disponible.
- Calentar funciones abriendo `/canal`, `/proyector` y `/control` 2 minutos antes.
- Ensayo con red cortada: escribir en el canal, apagar el wifi 1 minuto y enviar. Comprobar el aviso «Sin conexión», que el texto sigue ahí y que reenviar al volver la red deja un solo reporte.
- Solo el jurado escanea el QR (decisión de Diego del 24-10-2026): la prueba de carga contra producción no pasó con 40 ni con 50 teléfonos (ver evidencia de robustez).

## Recorrido principal: cinco minutos

| Tiempo | Acción y relato |
|---|---|
| 0:00–0:15 | Abrir con el cierre 23:58 de Rodrigo; el QR aparece recién al abrir el canal. Audio breve opcional. |
| 0:15–0:45 | Contrastar dos observaciones: cierre 23:58/4 h 20 de sueño y 22:10/6 h 40. Coincidencia, no causalidad probada. |
| 0:45–1:15 | Situación multifactorial: turnos, café 19:20, normalización y ronquido. Elegimos la dificultad para terminar el trabajo, sin declararla causa principal. |
| 1:15–1:55 | La sala mira solo el proyector: «Rodrigo cierra su turno», cuántos pendientes deja y cuántos quedan para seguimiento. Rodrigo envía el relevo en un paso desde `/rodrigo` en su teléfono (pendientes con #470 destacado y nota opcional viven ahí); el proyector pasa solo a «Esperando aceptación de Paula». Paula lo acepta desde S26 antes de su plazo. Mostrar aceptación/ventana efectiva y que Rodrigo no es respaldo. |
| 1:55–3:25 | En control, «Empezar la noche y abrir el canal» (22:10): empieza la cobertura de Paula y el proyector muestra el QR grande: «Intenten despertar a Rodrigo». Durante 30 s el público solo escribe su nombre y espera; usar esa espera para el contexto, unos 10 s: «Rodrigo trabaja en Despensa Sur, 30 supermercados del Biobío. Dos abren toda la noche. Ustedes son esos locales: escriban lo que falla. Si un local no puede cobrar, Paula recibe un aviso. Si puede esperar, queda en cola». Al ceder el QR, todos pueden enviar. Diferible queda en cola. Facturación caída avisa a Paula. Pedir que no pulse Tomar incidente. Esperar 30 s reales; escala a Tomás y el presentador registra su acuse desde control. Origen escenario visible. |
| 3:25–3:50 | En control, «Pasar a la mañana» (07:00); el proyector cuenta la noche: avisos a Rodrigo, quién quedó a cargo y el incidente tomado. No afirmar resolución. `/rodrigo` muestra el mismo resumen en el teléfono si se quiere enseñar; el registro completo, en /control. |
| 3:50–4:15 | Justo después de la demo, mostrar En la demo / Fuera de esta demo: canal simulado, solo un teléfono físico, Despensa Sur y sus condiciones como hipótesis, y la política fija en el código. |
| 4:15–4:45 | Mecanismo de continuidad: menos revisión, receptor confirmado y evidencia de responsabilidad. Después, unos 10 s: «En Despensa Sur, urgente es que un local no pueda cobrar. En una empresa de transporte sería un camión detenido en ruta; en una planta, una línea parada. El relevo, el aviso y la escalada son los mismos. Lo que cambia es la política de cada empresa». Decir «podría adaptarse», no «se adapta»: no hay validación con otras empresas. No afirmar más sueño medido ni adopción real. Esta frase lleva al cierre. |
| 4:45–5:00 | «Para dormir, primero necesita poder dejar de trabajar». Relevo · Entrega el turno. Recupera la noche. |

Los dos contextos de Despensa Sur suman unos 20 s a un guion que ya dura cinco minutos. Ensayar con cronómetro y recortar del tramo 0:45–1:15 si se pasa; no recortar la espera real de 30 s.

**Secuencia que no se cambia:** Paula sí acepta cobertura; luego no acusa un incidente; Tomás lo toma. No añadir el fallo de aceptación como segunda espera durante el pitch.

## Participación y control

Canal: nombre de quien participa, 280 caracteres, cinco envíos por sesión y límite global de 150 reportes por ejecución. No solicitar datos personales reales. Chips/reportes guionados: impresora de la oficina central, VPN lenta de la oficina central, orden de despertar a Rodrigo y ningún local de Despensa Sur puede emitir boletas (textos de la rama de contexto; main conserva los anteriores hasta integrarla). Una orden no cambia la elegibilidad.

Qué ve el público en su recibo: primero la decisión («Urgente…», «No es urgente. Queda en cola; nadie recibe un aviso ahora», «No quedó claro si es urgente…») y debajo cómo entendió la IA el mensaje («La IA entendió: red de locales sin funcionar, afecta a un local o equipo.»). Un mensaje que claramente no es de TI («hola», «tengo hambre», «me caí fuerte») dice «No parece un problema de TI, así que no se avisó a nadie»: no llega a Paula ni al proyector como incidente. Si describe una emergencia física, el recibo orienta a 131/132/133 y a la jefatura. Pedidos vagos («ayuda tengo una urgencia») siguen yendo a revisión de la guardia, con aviso. Mensajes cortos que se reconocen bien: «se cayó el internet», «no pasa la tarjeta», «la caja no tira boletas».

Si a los 15 s de abrirse el envío (45 s desde abrir el canal) hay menos de tres reportes del público, inyectar reportes con I/P y origen identificado. No presentar entradas del control como aportes espontáneos del público. Deduplicar el mismo hecho para evitar una ráfaga de avisos.

| Atajo aprobado | Función |
|---|---|
| → / Espacio | Siguiente paso del guion: en el cierre, empezar la noche y abrir el canal; en la noche, pasar a la mañana |
| O | Abrir/cerrar canal |
| I | Siguiente reporte guionado |
| P | Caída de facturación |
| R R | Reset escénico protegido |

El guion tiene tres escenas: Cierre (22:09:50), Canal (22:10) y Registro de mañana (07:00). Las escenas no retroceden. El QR grande aparece al abrir el canal; control solo puede alargarlo o volver a mostrarlo con botones (sin atajo de teclado). La demo no usa audio: control no tiene atajos para audio ni escena anterior.

No ejecutar atajos al escribir en un input/textarea. Control invoca los mismos contratos que UI/ntfy; nunca pone un resultado ficticio solo en pantalla. Ningún atajo acorta deadlines sin hacerlo visible; el pitch principal usa espera real.

Si R R muestra «El estado cambió mientras actuabas», un reporte terminó de clasificarse justo antes del reinicio y no se reinició nada. Repetir R R. Decisión del 23-10-2026: el control no reintenta solo.

## Ramas para preguntas y QA, fuera del pitch principal

1. Paula rechaza: Tomás recibe solicitud inmediatamente. `/rodrigo` muestra «Paula no puede cubrir. El relevo pasó a Tomás; no necesitas reenviarlo.»
2. Paula guarda silencio: Tomás recibe solicitud al vencer 30 s; su propio plazo empieza al derivar. `/rodrigo` muestra «Paula no aceptó a tiempo. El relevo pasó a Tomás; no necesitas reenviarlo.» Decisión del 24-10-2026: estas ramas no entran al pitch; si Paula no acepta, Tomás pasa a ser el entrante y el incidente no tendría un segundo respaldo en esta ventana.
3. Tomás también falla: Sin cobertura confirmada; aviso a Carla in-app y fin del saliente independiente. No prolongar automáticamente Rodrigo.
4. Aceptación/acuse tardío: no reasignar; explicar derivación.
5. Crítico nuevo sin cobertura: registrar y elevar coordinación; no inventar responsable técnico ni ampliar turno.
6. Clasificador falla: modo degradado visible y revisión conservadora; no exhibir JSON ficticio como respuesta real.

## Plan B honesto

- **Poca participación:** reportes guionados identificados.
- **Fallo del modelo:** ruta de respaldo estructurada/mode degradado conforme a contratos; revelar el fallo, no fingir clasificación.
- **Push no observado:** verificar red/permisos/registro. «Envío aceptado por ntfy» no es recepción. Si se usa control para seguir, identificar acción de escenario y no afirmar push logrado.
- **Red principal falla:** cambiar a red alternativa previamente probada, sin asumir conectividad. Si el proyector muestra «Sin conexión», los plazos no avanzan hasta que vuelva una consulta: decirlo, no reiniciar. Al volver la red, el proyector retoma solo y los teléfonos guardan lo escrito.
- **Demo inviable:** reproducir video local del ensayo y declarar que es grabación, no ejecución en vivo. Evitar gastar el pitch depurando.

## Después del ensayo

Guardar evidencia de ejecución/commit/URL, duración real, recepción física, acuse de Tomás, conteo de avisos y fallos. Repetir tras reset y no trasladar métricas de una ejecución a otra. Ver QA antes de declarar listo. Preparar README final de una página y acceso público del repo/deploy según reglas confirmadas; los documentos no autorizan preparación prohibida por el evento.
