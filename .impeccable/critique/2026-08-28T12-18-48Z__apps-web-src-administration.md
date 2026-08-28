---
target: /admin
total_score: 23
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 3
timestamp: 2026-08-28T12-18-48Z
slug: apps-web-src-administration
---

Method: dual-agent (A: /root/admin_design_review · B: /root/admin_detector_evidence)

## Salud de diseño

| #         | Heurística                        | Puntaje   | Problema clave                                                                                                                          |
| --------- | --------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Visibilidad del estado            | 3/4       | Cargas y ubicación son visibles; tras un cambio administrativo falta una confirmación inequívoca de alcance y resultado.                |
| 2         | Correspondencia con el mundo real | 3/4       | Usuarios y acciones son claros; Clave, Ruta interna, Orden, Objetivo y claves de eventos exigen conocimiento previo.                    |
| 3         | Control y libertad                | 2/4       | Hay Limpiar y Cancelar edición, pero desactivar no presenta confirmación visible ni existe deshacer.                                    |
| 4         | Consistencia y estándares         | 3/4       | Controles y tablas son coherentes; Aplicaciones omite la etiqueta Administración y las acciones por fila se acomodan de forma desigual. |
| 5         | Prevención de errores             | 2/4       | Campos requeridos ayudan, pero los cambios de ciclo de vida no se diferencian ni anticipan consecuencias.                               |
| 6         | Reconocimiento antes que recuerdo | 2/4       | Los ejemplos ayudan, pero filtros vacíos y conceptos técnicos obligan a inferir qué buscar o introducir.                                |
| 7         | Flexibilidad y eficiencia         | 2/4       | Hay períodos rápidos y CSV, no ordenamiento, filtros guardados ni acción masiva evidente junto a las casillas.                          |
| 8         | Estética y minimalismo            | 3/4       | Buena disciplina plana, pero Usuarios desperdicia espacio y Aplicaciones acumula acciones con igual peso.                               |
| 9         | Recuperación de errores           | 2/4       | Hay estados y reintentos, pero no suficiente orientación sobre qué se conservó, qué falló y qué sigue.                                  |
| 10        | Ayuda y documentación             | 1/4       | No hay ayuda contextual para perfiles, permisos, claves, rutas o lectura de actividad.                                                  |
| **Total** |                                   | **23/40** | **Aceptable: requiere mejoras relevantes antes de una operación administrativa fluida.**                                                |

## Veredicto de especificidad

La interfaz es coherente con “operación corporativa clara”: azul operativo, superficies planas, bordes nítidos, controles rectangulares y tablas semánticas. Es seria, legible y consistente con Timbo.

Sin embargo, su composición sigue siendo intercambiable con un CRUD interno genérico. Timbo aparece sobre todo en nombre y paleta; la jerarquía no expresa que aquí se gobiernan accesos, aplicaciones y trazabilidad. Las tres rutas repiten “título grande + formulario + tabla” aun cuando sus riesgos y ritmos son diferentes.

El detector no encontró problemas mecánicos: 0 hallazgos en `apps/web/src/administration`. La evidencia live autenticada confirmó Usuarios con navegación lateral, búsqueda, preautorización y tabla de tres filas. No hubo falsos positivos. No se pudo crear overlay: Chrome sólo ofreció evaluación de lectura y no expuso una API de inyección mutable; se usaron DOM y captura como señal alternativa.

## Impresión general

La base visual es sobria y confiable, pero el diseño no prioriza suficientemente la intención administrativa: dar acceso, cambiar un ciclo de vida y encontrar evidencia son tareas distintas que hoy compiten con el mismo lenguaje de formulario y tabla. La mayor oportunidad es convertir Administración de “consola CRUD” en una herramienta de gobierno con decisiones claras, consecuencias explícitas y menos carga antes de ver valor.

## Qué funciona

- El sistema visual plano es disciplinado: sin tarjetas decorativas ni sombras, y con buen uso del azul, reglas y superficies para trabajo operativo.
- Los destinos Usuarios, Aplicaciones y Actividad son claros, persistentes y semánticamente bien estructurados; la navegación activa orienta sin ruido.
- Actividad tiene una buena base de trazabilidad al mostrar fuente, etiqueta humana y clave técnica estable en lugar de exponer sólo lenguaje técnico.

## Problemas prioritarios

### [P1] Falta una intención principal clara por pantalla

**Por qué importa:** Usuarios mezcla búsqueda, preautorización y gestión de filas; Actividad mezcla consulta, filtrado y análisis. La persona decide cómo usar la pantalla antes de poder trabajar.

**Arreglo:** En Usuarios, volver Preautorizar el foco y compactar búsqueda como herramienta secundaria. En Actividad, mantener período, actor y aplicación visibles y revelar el resto como filtros avanzados.

**Comando sugerido:** `$impeccable shape`, luego `$impeccable layout`.

### [P1] Las acciones de alto impacto no se diferencian ni protegen lo suficiente

**Por qué importa:** Desactivar comparte peso visual con Editar y Gestionar perfiles. Un error puede retirar una capacidad operativa.

**Arreglo:** Separar edición rutinaria de cambios de ciclo de vida; exigir confirmación con consecuencia concreta y cerrar con una confirmación persistente del cambio realizado.

**Comando sugerido:** `$impeccable harden`.

### [P1] Actividad exige demasiada lectura antes de mostrar valor

**Por qué importa:** Hay siete filtros, tres períodos rápidos y múltiples métricas antes de que el registro responda una pregunta. La consulta de 110 eventos se vuelve frágil para el trabajo frecuente.

**Arreglo:** Priorizar rango, actor y aplicación; reunir evento, objetivo, fuente y fechas en “Más filtros”. Dar primero fecha, acción humana, actor y aplicación en la tabla; dejar la clave técnica como detalle secundario.

**Comando sugerido:** `$impeccable distill`.

### [P2] Las tablas no escalan a trabajo repetitivo

**Por qué importa:** Aplicaciones presenta hasta cuatro acciones por fila; Usuarios muestra casillas sin una acción masiva evidente; Actividad no deja ver ordenamiento ni filtros reutilizables.

**Arreglo:** Consolidar acciones secundarias bajo un control contextual etiquetado, presentar acciones masivas al seleccionar y añadir orden/filtros persistentes si entra en alcance.

**Comando sugerido:** `$impeccable layout`.

### [P2] Falta ayuda justo donde el dominio se vuelve técnico

**Por qué importa:** Clave, Ruta interna, perfiles, permisos y Objetivo pueden inducir errores en una primera administración.

**Arreglo:** Añadir microayuda junto a términos de dominio y explicar consecuencias antes de confirmar cambios; conservar ejemplos sólo cuando previenen un error concreto.

**Comando sugerido:** `$impeccable clarify`.

## Personas: señales de alerta

**Alex, usuario experto:** Las casillas de Usuarios no revelan claramente la acción masiva; en Aplicaciones debe escanear cuatro acciones por fila; en Actividad no encuentra ordenamiento ni filtros reutilizables. La plataforma funciona, pero no acelera tareas recurrentes.

**Jordan, primera vez:** Preautorizar, Clave, Ruta interna, Orden, Perfiles, Permisos, Objetivo y claves como `security.login_succeeded` aparecen sin definición contextual. No está claro qué tarea iniciar ni cuál es la consecuencia de desactivar.

**Sam, usuario que depende de accesibilidad:** Labels, regiones y tablas dan una buena base, pero 110 eventos con múltiples columnas, botones repetidos y filtros abiertos aumentan innecesariamente el recorrido lineal de teclado y lector de pantalla.

## Observaciones menores

- Aplicaciones no usa la etiqueta Administración presente en Usuarios y Actividad.
- El bloque Buscar de Usuarios consume más superficie de la que justifica su único campo.
- La sesión completa bajo Usuarios compite con la instrucción principal; puede mantenerse como contexto secundario.
- “Ver detalle seguro” transmite una buena restricción, pero debería percibirse inequívocamente como control accionable.

## Preguntas para abrir soluciones

- ¿Administración debería abrir en Usuarios o en una portada breve basada en intenciones: dar acceso, gestionar catálogo y revisar actividad?
- ¿Qué cambios deben ser flujos protegidos —desactivar, desasignar o modificar perfiles— en vez de botones pares en una fila?
- ¿El trabajo dominante de Actividad es investigar incidentes, auditar acciones o medir uso? Cada objetivo requiere una jerarquía de filtros distinta.
