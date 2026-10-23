---
name: Relevo
description: La continuidad — una interfaz de relevo serena, legible y explícita sobre quién sigue.
---

<!-- SEED: dirección visual elegida con el usuario antes de implementación. Volver a ejecutar $impeccable document cuando exista código para extraer tokens/componentes reales y generar el sidecar. -->

## Overview

**Dirección visual: La continuidad.**

Una emisión termina y la siguiente tiene nombre y hora. Relevo toma de la programación de radio nocturna su continuidad, su precisión horaria y su lectura serena, no la apariencia de una radio. Es una herramienta de trabajo: botones, campos, listas y navegación web reconocibles. No hay diales, ondas, parrillas de estudio ni controles que exijan aprender una metáfora.

El usuario eligió esta dirección en la comparación visual de Impeccable. Sustituye la identidad azul noche/Inter del documento anterior. El nombre y el eslogan se conservan. El boceto aprobado del cierre móvil está en [.impeccable/mocks/decision/radio.html](.impeccable/mocks/decision/radio.html); su composición específica se registra en el brief de superficie de `/rodrigo`, no como plantilla obligatoria de todas las pantallas.

La escena prioritaria es Rodrigo revisando el relevo en el teléfono bajo cansancio y con poca luz. De ahí el petróleo mate, el texto claro de alto contraste y la ausencia de brillo, gradientes o efectos ambientales. Esa elección no significa que el producto funcione solo de noche ni obliga a replicar un teléfono gigante en el proyector.

**Rasgos del sistema:**

- Jerarquía por tipografía, espacios y alineación, no por cajas dentro de cajas.
- Personas, ventanas y estados legibles sin descifrar códigos.
- Una acción primaria por paso; interacción convencional antes que expresión visual.
- Un único gesto de identidad: continuidad entre saliente y entrante, sin fingir cobertura.
- Misma gramática de actor, estado y plazo, tanto en lectura tranquila como en incidentes.

**Regla de continuidad honesta.** Enviar no cierra el traspaso visual. Una aceptación puede confirmar al receptor, pero la cobertura efectiva solo se muestra al comenzar su ventana. El texto siempre explica el estado; una línea unida nunca prueba por sí sola cobertura activa.

Este es un documento direccional previo a implementación, no una extracción de CSS ni una biblioteca construida. Los valores siguientes proceden del boceto elegido; los detalles no establecidos quedan para implementación y verificación. No se crea un sidecar de componentes ficticiamente extraídos.

## Colors

Petróleo y claros verdosos sostienen la lectura; ocre cálido concentra la acción. El azul violáceo, la paleta anterior y los gradientes quedan fuera de esta dirección.

### Valores establecidos por el boceto elegido

| Papel | Valor | Uso |
|---|---|---|
| Fondo petróleo mate | `#102A2D` | Plano continuo de trabajo; no una tarjeta flotante |
| Texto principal claro | `#F1F3E8` | Títulos, contenido y estado importante |
| Acción ocre | `#E9AF66` | Acción primaria y énfasis puntual; no decoración distribuida |
| Texto secundario verdoso | `#95B8B4` | Contexto auxiliar, IDs y separaciones de alta visibilidad |
| Texto sobre acción | `#102A2D` | Etiqueta del botón ocre; no blanco sobre ocre |

Son valores aprobados de dirección, todavía no nombres de variables CSS ni tokens extraídos. Durante la implementación darles un único origen y documentar allí los estados reales; no mantener definiciones paralelas divergentes.

**Regla del ocre escaso.** La acción primaria debe seguir siendo lo más fácil de encontrar. No colorear de ocre cada fila, cada icono y cada estado. El boceto usa ocre en propuestas de tickets: al implementar comprobar que no compitan con el botón principal ni parezcan confirmación de urgencia.

**Regla de estado explícito.** Pendiente, programado, activo, derivado y sin cobertura se distinguen por etiquetas y estructura. No inventar verde de éxito antes de aceptar ni comunicar error solo en rojo. La paleta semántica de error/advertencia/confirmación debe resolverse y medirse durante implementación; no se hereda automáticamente la anterior.

### Contraste comprobado de colores sólidos

Cálculo sRGB de luminancia relativa, sin transparencias, sobre el fondo petróleo:

| Par | Relación |
|---|---|
| Texto principal / fondo | 13,46:1 |
| Texto secundario / fondo | 7,04:1 |
| Ocre / fondo | 7,76:1 |
| Texto petróleo / botón ocre | 7,76:1 |

Estos pares superan 4,5:1 para texto normal. No acreditan contraste de toda la app: recalcular con las superficies, transparencias, bordes, foco y estados reales. El divisor translúcido del boceto es decorativo; no usar su baja intensidad para el único límite de un campo interactivo. Objetivo de 3:1 en elementos no textuales donde corresponda.

No se define todavía tema claro ni selector de tema. Si se construyen después, necesitan su propia revisión de contraste, no inversión automática de colores.

## Typography

**Familia elegida: Public Sans.** Una voz legible para títulos, datos, controles y contenido; no una pareja de tipografías de exhibición. No usar Inter ni una fuente de aspecto técnico para decorar. Fallback funcional `system-ui, sans-serif` si la fuente no carga, sin tratarlo como la identidad final.

Referencias establecidas por el boceto móvil, con base de 16 px al trasladar a rem:

| Papel | Referencia | Uso |
|---|---|---|
| Título de tarea | 32 px / 2 rem; interlineado 1,1 | Título breve, no un hero de marketing |
| Personas en continuidad | 25 px / 1,5625 rem; peso 600 | Actor principal y siguiente destinatario |
| Sección | 18 px / 1,125 rem; peso 600 | Agrupación funcional |
| Contenido | 16 px / 1 rem; interlineado inicial 1,4–1,5 | Pendientes, explicaciones y errores |
| Etiqueta auxiliar | 14 px / 0,875 rem | ID/contexto; nunca la única explicación de un estado importante |
| Acción primaria | 18 px / 1,125 rem; peso 600 | Verbo y destinatario claros |

El título hereda un tracking moderado de −0,02 em del boceto, no texto apretado por sistema. Usar cifras tabulares de Public Sans para horas/contadores; no hace falta otra familia mono. No convertir etiquetas normales en mayúsculas sostenidas ni colocar una pequeña etiqueta decorativa sobre cada título.

La escala es fija por papel; la adaptación es de estructura, no de encoger toda la interfaz. En proyector crear una escala apropiada a distancia real de lectura. No imponer el tamaño móvil. En pantallas de tarea, medida de texto limitada al ancho cómodo disponible; textos largos explicativos con medida aproximada de 65–75 caracteres cuando el ancho lo permita.

Cargar la fuente mediante la estrategia del proyecto, preferiblemente servida por la propia app. El enlace de Google Fonts del boceto es un recurso de exploración, no una decisión de despliegue ni prueba de fuente instalada.

## Layout

La unidad de composición es una tarea, no una cuadrícula de tarjetas. Usar un plano continuo de lectura, grupos por proximidad y filas con alineación consistente. Separar bloques más que los elementos de un mismo bloque. Un borde fino es suficiente cuando el espacio no distingue dos grupos; no bordear cada fragmento de texto.

El boceto de referencia es un teléfono de 390 × 844 px con margen de 24 px. Es una decisión de composición, no un viewport fijo de producción. La implementación debe permitir scroll, texto ampliado y teclado sin clipping; no copiar `height:844px` ni `overflow:hidden` a la app.

Una columna para tareas móviles. Ancho de lectura contenido para cierre/receptor en escritorio; no fijar a todas las superficies los 480 px de la versión anterior. Proyector y control necesitan su propia distribución dentro de la misma gramática visual. El esquema concreto del cierre y su gesto de continuidad viven en el brief de `/rodrigo`.

Acción principal cercana al pulgar. Si se fija abajo, reservar su espacio y safe area, evitar que tape campos y conservar el foco visible. Acciones táctiles de al menos 48 px; botón primario de 56 px en el boceto. No empequeñecer acciones secundarias críticas para que quepan en la primera pantalla.

La lista de pendientes tiene filas abiertas: ID, título y propuesta. No envolverla en tarjetas anidadas. En texto largo, permitir que la propuesta baje de línea antes de truncar el significado. La razón y la corrección de la propuesta deben ser alcanzables con controles convencionales; no solo deslizando.

La nota IA editable es una parte real del recorrido, aunque el boceto de primera pantalla solo muestra su etiqueta. Colocarla en la continuación del flujo sin ocultarla detrás del botón de envío. No confundir una miniatura aprobada con una especificación exhaustiva de campos y estados.

En proyector, priorizar responsable y estado antes que un registro exhaustivo. Registro y cadena son áreas distintas, no tarjetas dentro de tarjetas. No exponer controles privilegiados. La desconexión y el alcance de los plazos deben seguir visibles según CONTRACTS.

## Elevation & Depth

**Plano mate por defecto.** La profundidad se logra con jerarquía, espacios y agrupación; no con halos, blur, glassmorphism ni sombras decorativas. Una lista no necesita elevar cada fila. La identidad nocturna no es neón sobre negro.

Priorizar edición y explicación en el flujo. Modal solo si requiere interrupción o foco protegido; usar primitives accesibles, contener/restaurar foco y no recortar overlays por contenedores con overflow. No sumar una sombra y un borde a cada superficie por defecto.

Movimiento solo para mostrar un cambio real, breve y sin desplazar la tarea. Referencia inicial de 150–200 ms para feedback, no una animación aprobada ni un retraso que haya que esperar. La transición distintiva puede completar la continuidad al aceptar; el comienzo efectivo de cobertura se señala después, si corresponde. Con movimiento reducido, cambiar estado sin animación. Nunca dibujar ondas ambientales ni un pulso permanente.

## Shapes

Formas convencionales, contenidas y funcionales. Botón primario con esquinas suaves de 10 px según el boceto, no una píldora gigante. Si aparecen contenedores, no convertir el sistema en una colección de grandes rectángulos redondeados; decidir cada límite por función.

La línea de continuidad es información, no decoración: conserva un corte o separación mientras no haya aceptación, y su etiqueta distingue aceptación programada de cobertura efectiva. El boceto muestra una flecha tipográfica como esquema; en producción debe resolverse como geometría/SVG o icono consistente, con semántica textual equivalente. No usar símbolos Unicode o emojis como sustituto de un sistema de iconos.

Campos y botones requieren default, hover donde exista, foco, pressed, disabled y loading según aplique. Respuestas de error/vencimiento se muestran junto a la acción sin afirmar éxito. Referencia de foco del boceto: contorno claro de 3 px, separado 3 px; comprobar visibilidad sobre cada fondo, incluido el botón ocre. No bajar toda la interfaz de opacidad para señalar un control deshabilitado ni hacer ilegible su explicación.

## Do's and Don'ts

### Sí

- Mantener Public Sans, petróleo mate, texto claro y ocre concentrado en acción.
- Dar a cada elemento una razón: actor, estado, plazo, contenido o acción.
- Terminar cada operación en el estado observado, incluso si es Sin cobertura confirmada.
- Preservar navegación y controles web conocidos; la metáfora aporta continuidad, no una nueva manera de operar.
- Revisar contraste, foco, teclado, texto ampliado, movimiento reducido, errores y móvil/proyector cuando exista UI ejecutable.
- Mantener los textos de LANGUAGE y las reglas de CONTRACTS sin convertir el diseño en otra máquina de estados.

### No

- Inter, gradientes morados, brillo/glow, transparencias ornamentales, bajo contraste o ruido visual.
- Cards dentro de cards, bloques de icono/título/texto repetidos como estructura universal o dashboards de métricas inventadas.
- Una radio literal, tipografía pixelada, marcas de boleto, códigos de catálogo o animaciones de tablero: no fueron la dirección elegida.
- Un chip verde, una línea cerrada o «Todo listo» por el mero envío del relevo.
- Confundir Aceptar relevo con Tomar incidente ni acuse con resolución.
- Fuente, color, tamaño o componentes anteriores mezclados por comodidad con esta dirección.
- Presentar el boceto, estos cálculos o la revisión de Impeccable como aplicación construida, ensayo en S26, validación con usuarios o certificación WCAG.

Al implementar, ejecutar `$impeccable document` sobre el código para capturar tokens, componentes y sidecar reales. Hasta entonces este seed registra la dirección elegida, no una biblioteca extraída.
