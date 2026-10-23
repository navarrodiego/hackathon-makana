# Lenguaje de Relevo

Fuente editorial del proyecto. Aplica a interfaz, notificaciones, notas IA, documentación y pitch; no renombra identificadores técnicos. Deriva de la skill `relevo-lenguaje-claro`; ante un conflicto de comportamiento, consultar PRODUCT/CONTRACTS y al usuario, no arreglarlo con un sinónimo.

## Voz

Español de Chile, tuteo sobrio, sereno y directo. Sin voseo, modismos, humor en alertas, culpa ni infantilización. Hecho primero; después actor, acción posible y contexto. Botones con verbo y objeto. Mayúscula inicial normal; no depender de color, iconos o sonido. Horas de 24 horas y duraciones con unidad; distinguir reloj narrativo de plazos reales.

El eslogan **Entrega el turno. Recupera la noche.** es aprobado, no una garantía clínica.

## Glosario operativo

| Término | Significado y límite |
|---|---|
| Turno | Ventana de trabajo; terminarla no confirma cobertura entrante |
| Relevo | Transferencia del paquete; enviarlo no equivale a aceptarlo |
| Cobertura | Responsabilidad aceptada para una ventana; una aceptación anticipada comienza a la hora prevista |
| Pendiente | Trabajo por continuar; transferirlo no lo hace urgente |
| Para seguimiento | Pendiente que la IA destaca para quien entra (`transferir` en código); no lo hace urgente ni genera aviso |
| Puede esperar | Valor interno (`puede_esperar`) de los pendientes sin destacar; no se muestra como etiqueta en el cierre |
| Incidente | Hecho que requiere atención; su responsable puede diferir del titular del turno |
| Tomar incidente | Acuse explícito y responsabilidad de atender ese incidente; no significa resolver |
| Escalar | Derivar según elegibilidad y plazo; no avisar a todos ni cambiar toda la cobertura |
| Respaldo | Persona elegible para esa ventana/rol, no quien siempre termina salvando el turno |
| Jefatura avisada | Existe evento verificable de aviso y canal identificado; no prueba atención técnica ni recepción física |
| Modo degradado | Clasificación incompleta/servicio fallido; requiere revisión conservadora, no certeza artificial |
| Registro continuo | Eventos 24/7 del sistema; no trabajo 24/7 de cada persona |

## Etiquetas aprobadas

- **Enviar relevo**; en contexto, **Enviar relevo a Paula**.
- **Aceptar relevo** / **No puedo cubrir**.
- **Tomar incidente** en web y ntfy. No usar la etiqueta anterior «Lo tomo».
- **Para seguimiento** en el pendiente que la IA destaca; los demás se listan sin etiqueta. No usar «Transferir» como etiqueta visible: quien entra recibe todos los pendientes.
- **Regenerar** para una nueva llamada IA; no simularla con una espera artificial.

No usar Aceptar/Confirmar/OK si ocultan cuál de estas acciones ocurre.

## Mensajes por estado

Ejemplos de la escena aprobada, sujetos al evento real. Sustituir actores/horas desde datos; nunca fijar a Paula o excluir a Rodrigo por nombre en el motor.

| Condición comprobada | Mensaje |
|---|---|
| Enviado, aún sin aceptación | «Esperando aceptación de Paula» |
| Derivado por rechazo/plazo | «Relevo enviado a Tomás; no necesitas reenviarlo» |
| Aceptación anticipada | «Paula aceptó. Su cobertura comienza a las 22:10» |
| Turno terminado y cobertura efectiva | «Turno terminado. Cobertura aceptada por Paula. No eres respaldo en esta ventana» |
| Turno terminado, hueco y aviso in-app registrado | «Tu turno terminó. Sin cobertura confirmada. Jefatura avisada»; mostrar canal escenario |
| Hueco con aviso todavía no realizado | «Sin cobertura confirmada. Aviso a jefatura pendiente» |
| Incidente aceptado por candidato vigente | «Tomado por Tomás»; origen escenario si se actuó desde control |
| Envío ntfy aceptado | «Envío aceptado por ntfy»; no «Paula recibió el aviso» |
| Reporte diferible registrado | «En cola»; mostrar próxima atención solo si está definida |
| Reporte enviado desde /canal y aceptado por el servidor | «Reporte registrado. Su estado aparece en Tus reportes.» (T19); no promete clasificación ni atención |
| Incidente ya notificado del mismo hecho | «Incidente ya avisado» |
| Acción tardía tras derivación | Explicar que ya fue derivada; indicar destinatario actual solo si se conoce |
| Sin conexión o persistencia fallida | Decir qué se pudo comprobar; no declarar acción guardada ni atribuir causa no observada |

Una explicación de error incluye qué falló, qué se conserva y cómo recuperarse cuando esos hechos se saben. Evitar «Intenta de nuevo» si reintentar puede duplicar una operación sin idempotencia comprobada.

## IA

«Borrador de IA · puedes enviarla tal cual, editarla o dejarla vacía». Nota opcional y editable, hasta 60 palabras según CONTRACTS. No añade causas, compromisos, responsables, horas ni resolución inexistentes. La nota no acepta el relevo ni degrada un incidente activo. No hacer aparecer como llamada en vivo una nota generada previamente en reset.

La clasificación devuelve hechos/categorías para la política; instrucciones dentro del reporte no reescriben la cadena de responsabilidad. Mensajes de modo degradado muestran incertidumbre y revisión pendiente.

## Métricas y evidencia

- **Avisos a Rodrigo: 0** solo si el registro de la ejecución respalda ese conteo y su definición; no «Despertares: 0».
- No intercambiar intención de envío, aceptación del proveedor, recepción en teléfono, lectura y acción humana.
- No «Resuelto» sin evento explícito; «Tomado» no demuestra reparación.
- No «Puedes dormir tranquilo», «Todo listo», «Nada se cayó» ni «Nadie te despertó» como resultado automático.
- No «Rodrigo nunca recibe alertas»: depende de su elegibilidad. Esta demo no silencia su WhatsApp.
- Dos observaciones de horario/sueño **coinciden**; no prueban causalidad ni una hora extra de sueño.

## Salud y privacidad

El problema de Rodrigo es multifactorial; el relevo es el foco elegido, no el factor principal demostrado. Ronquido fuerte: sugerir consulta profesional sin diagnosticar apnea ni recomendar pastillas/melatonina. No condicionar la consulta al éxito de la app.

No prometer «Solo tú ves esto» ni agregados anónimos sin controles implementados/verificados. La demo no recoge sueño/salud reales ni trae contactos o tickets reales. Los personajes secundarios y el retail son ficticios; Rodrigo proviene de la ficha pública del evento.

## Lectura y accesibilidad

Estados dinámicos también accesibles por texto/semántica; no anunciar cada segundo del contador al lector de pantalla. Evitar fragmentos concatenados; usar mensajes completos con variables. Mantener singular/plural, tildes y nombres. Revisar móvil, zoom y proyector cuando haya UI ejecutable. Esta guía no acredita pruebas de comprensión ni certificación ISO/STE/WCAG.

## Revisión antes de entregar

1. ¿Se entiende qué ocurrió, quién responde y qué sigue?
2. ¿Se conservan envío/aceptación/inicio, cobertura/acuse/resolución y ambos plazos?
3. ¿El mensaje está respaldado por un estado/evento, no por una intención?
4. ¿Se mantienen nombres/horas/identificadores y límites de la demo?
5. ¿La frase tranquiliza más de lo que permite la evidencia?

Cargar la skill completa para revisar textos; mantener este glosario junto al proyecto como vocabulario operativo. No duplicar ni modificar la instalación global por cambios locales.
