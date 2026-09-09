# 001 — Suavizar el relevo vertical de los valores

- **Commit:** 06ff2b0
- **Estado:** Completado
- **Severidad:** MEDIUM
- **Categoría:** Easing & duration
- **Alcance estimado:** 2 archivos, ~35 líneas

## Problema

La transición dura 560 ms, pero la curva de entrada concentra casi todo el desplazamiento en los primeros instantes. En Chrome el cambio se percibe como un desvanecimiento breve, no como un relevo vertical fluido; además, la frase entrante, la saliente y el marco usan duraciones y curvas diferentes y no se leen como una sola transformación.

La corrección debe conservar el comportamiento acordado: el valor anterior sube, el nuevo llega desde abajo y el marco se adapta con un rebote leve. El intervalo de rotación de 5.600 ms no necesita cambios.

## Dónde

| Archivo                               | Líneas                | Qué existe                                                                               |
| ------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------- |
| `apps/web/src/app.css`                | 441–506               | Entrada de 560 ms muy adelantada por la curva, salida de 360 ms y recorridos de 14/16 px |
| `apps/web/src/home/home-launcher.tsx` | 22–24, 66–68, 103–114 | Duraciones de texto y morph del marco; el marco comienza al mismo tiempo que la salida   |

### Código actual

```css
.company-value-copy--incoming {
  animation: company-value-enter 560ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.company-value-copy--outgoing {
  color: #475569;
  animation: company-value-exit 360ms cubic-bezier(0.19, 1, 0.22, 1) both;
}

@keyframes company-value-enter {
  from {
    opacity: 0;
    filter: blur(2px);
    transform: translate(-50%, calc(-50% + 14px)) scale(0.98);
  }
  to {
    opacity: 1;
    filter: blur(0);
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes company-value-exit {
  to {
    opacity: 0;
    filter: blur(2px);
    transform: translate(-50%, calc(-50% - 16px)) scale(0.98);
  }
}
```

```tsx
const COMPANY_VALUE_TRANSITION_DURATION_MS = 560;
const COMPANY_VALUE_EXIT_DURATION_MS = 360;

frameElement.animate(
  [
    {
      transform: `translate(-50%, -50%) scale(${previousFrameSize.inlineSize / nextFrameSize.inlineSize}, ${previousFrameSize.blockSize / nextFrameSize.blockSize})`,
    },
    { transform: 'translate(-50%, -50%) scale(1)' },
  ],
  {
    duration: COMPANY_VALUE_TRANSITION_DURATION_MS,
    easing: 'cubic-bezier(0.34, 1.22, 0.64, 1)',
  },
);
```

## Objetivo

Usar un **vertical reel crossfade**: la frase saliente sube 24 px durante 460 ms; 80 ms después, la entrante comienza 24 px debajo de su posición final y se asienta durante 560 ms. La opacidad acompaña al movimiento, pero parte de `0.18` y el blur baja a `1px` para que el desplazamiento domine visualmente sobre el desvanecimiento.

```css
.company-value-copy--incoming {
  animation: company-value-enter 560ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 80ms both;
}

.company-value-copy--outgoing {
  color: #475569;
  animation: company-value-exit 460ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

@keyframes company-value-enter {
  from {
    opacity: 0.18;
    filter: blur(1px);
    transform: translate(-50%, calc(-50% + 24px)) scale(0.99);
  }
  to {
    opacity: 1;
    filter: blur(0);
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes company-value-exit {
  to {
    opacity: 0;
    filter: blur(1px);
    transform: translate(-50%, calc(-50% - 24px)) scale(0.99);
  }
}
```

En `home-launcher.tsx`:

```tsx
const COMPANY_VALUE_TRANSITION_DURATION_MS = 560;
const COMPANY_VALUE_EXIT_DURATION_MS = 460;
const COMPANY_VALUE_FRAME_DELAY_MS = 80;
```

Mantener el rebote del marco como gesto de marca, pero iniciarlo junto con la frase entrante:

```tsx
{
  delay: COMPANY_VALUE_FRAME_DELAY_MS,
  duration: COMPANY_VALUE_TRANSITION_DURATION_MS,
  easing: 'cubic-bezier(0.34, 1.22, 0.64, 1)',
}
```

**Por qué estos valores:**

- `560ms` conserva la duración ya elegida para el valor principal.
- `460ms` mantiene una salida más corta que la entrada, sin cortarla a mitad del recorrido.
- `80ms` evita que ambas frases tengan su máxima presencia al mismo tiempo y sincroniza la llegada con el marco.
- `cubic-bezier(0.25, 0.46, 0.45, 0.94)` es la curva `ease-out-quad` del catálogo de la auditoría: distribuye el desplazamiento durante más tiempo que la curva actual.
- `24px` hace visible el eje vertical sin convertir el cambio en un slide amplio.
- `blur(1px)` une ambos estados sin dominar el movimiento.
- `scale(0.99)` conserva profundidad sin que la tipografía parezca inflarse.

## Convenciones a seguir

- La animación de este componente vive en `apps/web/src/app.css`; no introducir una librería de movimiento.
- La medición y el morph del marco ya usan WAAPI en `apps/web/src/home/home-launcher.tsx`; conservar esa estrategia y no animar `width` ni `height` por frame.
- Mantener el manejo existente de `prefers-reduced-motion`: la rotación automática se detiene y el valor saliente no queda visible.

## Pasos

1. Cambiar `COMPANY_VALUE_EXIT_DURATION_MS` de `360` a `460` y agregar `COMPANY_VALUE_FRAME_DELAY_MS = 80`.
2. Pasar `delay: COMPANY_VALUE_FRAME_DELAY_MS` a las opciones de `frameElement.animate` sin cambiar la curva de rebote del marco.
3. Sustituir las duraciones, curvas y keyframes del texto por los valores exactos del bloque objetivo.
4. Mantener `COMPANY_VALUE_ROTATION_INTERVAL_MS = 5_600` y la estructura accesible actual.
5. Actualizar o agregar una prueba con timers falsos que verifique que el valor saliente permanece 459 ms y desaparece a los 460 ms.

## Fuera de alcance

- No cambiar el mesh ni el granulado del Home.
- No alterar tipografía, peso, esquinas, tarjetas o posición del contador.
- No modificar el intervalo de rotación.
- No introducir una librería nueva de animación.
- No cambiar animaciones de otras pantallas.

## Verificación

**Build**

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` y `pnpm format:check` pasan o se documentan los bloqueos preexistentes.
- [ ] La prueba del Home pasa con timers falsos.

**Comportamiento**

- [ ] Solo dos frases coexisten durante el relevo y nunca quedan palabras cortadas.
- [ ] La frase anterior sube 24 px y desaparece; la nueva llega desde 24 px debajo y termina centrada.
- [ ] El marco comienza a reajustarse 80 ms después de la salida y termina encapsulando la frase nueva.
- [ ] Con `prefers-reduced-motion: reduce`, la rotación automática continúa detenida y nada se desplaza.
- [ ] Al cambiar el ancho del viewport durante el relevo, el marco sigue encapsulando la frase sin saltos.

**Sensación**

- [ ] Grabar al menos dos ciclos en Chrome y revisar cuadro por cuadro: el desplazamiento debe seguir siendo perceptible pasada la mitad de la transición.
- [ ] Probar en un teléfono real: las frases de dos líneas deben moverse como una unidad, no línea por línea.
- [ ] Si todavía predomina el fade, no aumentar primero la duración; comprobar que la curva aplicada sea exactamente `cubic-bezier(0.25, 0.46, 0.45, 0.94)`.

## Notas

La frase “movimiento hacia abajo” puede referirse a que el valor nuevo debe descender desde arriba. Este plan conserva la dirección definida anteriormente —valor viejo hacia arriba y valor nuevo desde abajo— porque produce un relevo continuo. Si se desea literalmente una entrada descendente, hay que invertir ambos signos como una decisión separada y no mezclar direcciones dentro del mismo ciclo.
