---
name: Plataforma Timbo
description: Sistema visual compartido para aplicaciones internas claras, modernas y proporcionadas.
colors:
  operational-blue: '#00388a'
  operational-blue-hover: '#0a4b9f'
  focus-blue: '#0b4f9c'
  focus-ring: 'rgb(11 79 156 / 18%)'
  cool-background: '#edf2f7'
  surface: '#f7f9fb'
  surface-strong: '#ffffff'
  primary-ink: '#142033'
  secondary-ink: '#475569'
  divider: '#bcc9d7'
  control-border: '#94a3b8'
  success-surface: '#dcecf0'
  error-ink: '#8c2f16'
typography:
  body:
    fontFamily: "Aptos, 'Segoe UI', sans-serif"
    fontSize: '1rem'
    lineHeight: 1.5
  title:
    fontFamily: "Aptos, 'Segoe UI', sans-serif"
    fontWeight: 700
    letterSpacing: '-0.025em'
  label:
    fontFamily: "Aptos, 'Segoe UI', sans-serif"
    fontSize: '0.8125rem'
    fontWeight: 700
rounded:
  square: '0'
spacing:
  1: '4px'
  2: '8px'
  3: '12px'
  4: '16px'
  5: '20px'
  6: '24px'
  7: '32px'
components:
  action-primary:
    backgroundColor: '{colors.operational-blue}'
    textColor: '#ffffff'
    rounded: '{rounded.square}'
    padding: '0 {spacing.5}'
    height: '44px'
  action-secondary:
    backgroundColor: 'transparent'
    textColor: '{colors.operational-blue}'
    rounded: '{rounded.square}'
    padding: '0 {spacing.3}'
    height: '44px'
  text-input:
    backgroundColor: '{colors.surface-strong}'
    textColor: '{colors.primary-ink}'
    rounded: '{rounded.square}'
    padding: '0 10px'
    height: '44px'
---

# Sistema de diseño: Plataforma Timbo

## Overview

**Norte creativo: "Operación corporativa clara"**

Plataforma Timbo es una superficie interna moderna y serena: hace visibles las decisiones, conserva
el contexto de trabajo y evita que el ornamento compita con una tarea operativa. La identidad vive
en el azul funcional, la tipografía firme y una estructura que se entiende rápidamente.

El sistema busca proporción antes que repetición mecánica. Los patrones compartidos son un punto de
partida para construir aplicaciones coherentes, no una plantilla que sustituya el juicio de layout
en cada flujo. Las decisiones particulares de una aplicación se documentan junto a esa aplicación.

**Características clave:**

- Claro y moderno, con énfasis visual reservado para acciones y estado.
- Proporcionado: la proximidad expresa relación y los espacios mayores separan decisiones.
- Operativo: los controles, el foco y la respuesta en pantallas angostas priorizan completar la tarea.

## Colors

El azul operativo concentra la acción y la orientación; las superficies frías, tintas oscuras y
divisores nítidos sostienen una lectura estable sin hacer que cada región compita por atención.

### Primary

- **Azul operativo:** acciones principales, navegación activa y referencias de producto.
- **Azul de foco:** foco de teclado y estados que requieren orientación inmediata.

### Neutral

- **Fondo frío:** plano de trabajo de la plataforma.
- **Superficies claras:** regiones de contenido y controles editables.
- **Tinta principal y secundaria:** jerarquía de lectura, etiquetas y contenido de apoyo.
- **Divisor y borde de control:** separación estructural y límites de interacción.

### Named Rules

**La regla del acento reservado.** El azul operativo señala acción, selección o contexto; no se usa
como decoración repartida por toda la pantalla.

## Typography

**Fuente de interfaz:** Aptos, con Segoe UI como respaldo.

La tipografía debe sentirse administrativa sin ser pesada: títulos compactos y fuertes, cuerpo
legible y etiquetas breves que preparan la interacción. La monoespaciada se reserva para datos,
importes o identificadores cuando una aplicación realmente lo necesite.

### Hierarchy

- **Título:** peso alto y espaciado compacto para establecer la decisión o sección actual.
- **Cuerpo:** lectura cómoda y tono secundario cuando aporta contexto, no instrucción principal.
- **Etiqueta:** peso alto y tamaño contenido para acompañar controles sin competir con el valor.

## Layout

Los layouts parten de contenedores fluidos, gutters responsivos y orden lineal de DOM. En escritorio
pueden distribuir información en columnas cuando cada región conserva una responsabilidad clara; en
pantallas angostas se apilan sin alterar el orden de lectura ni de foco.

La proporción se decide por relación: espacios pequeños unen etiqueta y control, valores intermedios
ordenan una misma decisión y espacios mayores separan grupos o cambios de contexto. No se impone una
misma medida a todos los huecos ni se elevan márgenes locales de una aplicación a regla global.

**La regla de la proporción intencional.** Antes de cambiar un layout, identificar el recorrido de la
tarea, los grupos que deben leerse juntos y los que deben separarse; luego elegir el menor cambio que
exprese esa jerarquía en todos los anchos relevantes.

## Elevation & Depth

Las superficies son planas por defecto: fondo, borde y proximidad comunican estructura. La elevación
sutil se reserva para una superposición, un estado transitorio o una prioridad real; no se usa para
convertir cada bloque de contenido en una tarjeta flotante.

**La regla de profundidad con propósito.** Una sombra debe explicar por qué un elemento emerge sobre
otro, no reemplazar la agrupación, el orden o el espacio.

## Shapes

La interfaz usa geometría recta y bordes claros. Los controles y paneles compartidos no dependen de
esquinas redondeadas para parecer interactivos: su estado se expresa con color, borde, foco y
contraste.

## Components

### Acciones principales

Las acciones principales ocupan una altura táctil consistente, usan el azul operativo y texto de alto
contraste. El hover oscurece el fondo y el foco visible conserva un anillo externo claro.

### Acciones secundarias y enlaces

Las acciones secundarias son transparentes y conservan el borde o el tratamiento de enlace sólo
cuando ayuda a reconocerlas como controles. No deben competir con la acción principal.

### Campos

Los campos son claros, rectos y delimitados. Mantienen una altura táctil suficiente; foco y error se
comunican mediante borde y anillo visibles, nunca sólo por color de texto.

### Navegación de plataforma

La barra superior azul establece identidad, contexto de aplicación y acciones de sesión. La barra de
identidad y la navegación de regreso aparecen sólo cuando el contexto lo requiere y se adaptan sin
perder el orden de lectura en móvil.

### Estado y avisos

Los avisos usan superficies y tintas semánticas con contraste suficiente. El estado debe nombrar el
resultado y, cuando corresponda, el siguiente paso recuperable.

## Do's and Don'ts

### Do:

- **Do** usar los tokens compartidos para identidad, foco, controles y accesibilidad cuando correspondan.
- **Do** evaluar lectura, agrupación, ritmo, densidad y adaptación antes de modificar un layout.
- **Do** documentar en la aplicación las decisiones de flujo, composición o dominio que no sean reutilizables.
- **Do** promover una decisión al sistema raíz sólo cuando haya evidencia de que sirve en más de una superficie.

### Don't:

- **Don't** tratar este documento como una plantilla rígida para cada pantalla o flujo.
- **Don't** promover al sistema compartido un wizard, panel, resumen o espaciado que pertenezca a una sola aplicación.
- **Don't** usar sombras, radios o contenedores extra para ocultar una jerarquía o agrupación mal resuelta.
- **Don't** cambiar el orden visual de modo que contradiga el orden de foco o de lectura asistida.
