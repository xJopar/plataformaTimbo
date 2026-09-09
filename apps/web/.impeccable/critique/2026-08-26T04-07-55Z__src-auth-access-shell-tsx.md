---
target: pantalla de acceso corporativo / login
total_score: 23
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
timestamp: 2026-08-26T04-07-55Z
slug: src-auth-access-shell-tsx
---

## Design Health Score

| #         | Heurística                                 | Score     | Hallazgo clave                                                                                                                              |
| --------- | ------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Visibilidad del estado del sistema         | 3         | Spinner + "Validando sesión segura" cubren bien lo transitorio; falta feedback si la validación se extiende (sin estado de timeout visible) |
| 2         | Coincidencia con el mundo real             | 2         | "Acceso corporativo" es lenguaje de formulario; no dice qué cuenta usar ni menciona "Google" en el copy                                     |
| 3         | Control y libertad del usuario             | 2         | No hay forma de cancelar la validación en curso ni de "cambiar de cuenta" antes de redirigir a Google                                       |
| 4         | Consistencia y estándares                  | 2         | El "G" de texto no sigue el logomark oficial de Google (estándar externo reconocible)                                                       |
| 5         | Prevención de errores                      | 3         | Poco que prevenir en un OAuth de un botón; delega correctamente a Google                                                                    |
| 6         | Reconocimiento antes que memoria           | 2         | Monograma "T" y "G" de texto son íconos no estándar a aprender, en vez de reconocer al instante                                             |
| 7         | Flexibilidad y eficiencia de uso           | 2         | Nada para usuarios de alta frecuencia (recordar última cuenta, SSO silencioso)                                                              |
| 8         | Diseño estético y minimalista              | 3         | Ejecuta bien el minimalismo pedido por el sistema, aunque ese mismo minimalismo abona a la genericidad                                      |
| 9         | Ayuda a reconocer y recuperarse de errores | 3         | `role="alert"` y estilo sobrio correctos; falta contenido de recuperación (a quién contactar)                                               |
| 10        | Ayuda y documentación                      | 1         | Ningún enlace de ayuda/soporte visible, ni siquiera en el estado de rechazo                                                                 |
| **Total** |                                            | **23/40** | **Aceptable**                                                                                                                               |

## Veredicto de Especificidad de Diseño

**LLM (Assessment A):** Hoy la pantalla es intercambiable con cualquier login B2B genérico. Tapando "Plataforma Timbo" y la foto, podría ser cualquier SaaS. El único elemento realmente propio de Timbo —la fotografía aérea de la planta— está apagado bajo un velo azul al 58%. El wordmark real de Timbo (itálico, agresivo, coherente con un negocio de camiones y maquinaria pesada) no aparece en ningún lado; en su lugar hay un monograma "T" geométrico y neutro, y un título en Aptos derecho sin ningún carácter. La marca real es dinámica y musculosa; la interfaz de acceso es plana y anónima.

**Escaneo determinístico:** `detect.mjs --json` sobre `access-shell.tsx` y `app.tsx` → exit 0, `[]` (sin hallazgos). Sin falsos positivos que señalar. Es un resultado esperable: el detector mecánico verifica antipatrones (sombras, gradientes, radios inconsistentes, etc.), no genericidad de marca — por eso un diseño "limpio" según el detector puede seguir siendo intercambiable según el juicio de diseño.

**Overlays visuales:** no disponibles. Assessment B levantó el dev server de Vite correctamente (`localhost:5173`), pero la extensión de Chrome de Claude no está conectada en esta sesión, así que no se pudo crear una pestaña ni inyectar el detector visual. No hay overlay visible en ningún tab `[Human]`; la señal de fallback es "Browser extension is not connected". El servidor de desarrollo se detuvo y se verificó que el puerto quedó libre.

## Overall Impression

La base técnica es sólida (responsive, accesibilidad, carga cognitiva en cero fallos), pero la pantalla no dice "Timbo" en ningún lado más allá del nombre escrito. La mayor oportunidad no es agregar animación — es dejar que la marca real (wordmark itálico + fotografía sin apagar) y un copy más humano hagan el trabajo de calidez que hoy se le está pidiendo al movimiento.

## What's Working

1. **Ejecución responsive prolija**: el layout de dos columnas (47/53) pasa a banda superior de foto en ≤860px sin romper nada, y el corte diagonal se adapta correctamente en ambos breakpoints.
2. **Disciplina de carga cognitiva**: un solo CTA, jerarquía clara, cero ruido — 0 fallos sobre el checklist de 8 ítems.
3. **Accesibilidad de base correcta**: `focus-visible` con anillo turquesa de 3px no reducido, `aria-busy`, `role="status"`/`role="alert"`, y respeto real a `prefers-reduced-motion`.

## Priority Issues

**[P1] Botón "Ingresar con Google" usa una "G" de texto, no el logomark oficial**

- **Por qué importa**: en el momento de mayor sensibilidad de seguridad del flujo (un OAuth de terceros), el usuario busca reconocer visualmente el ícono real de Google para confiar que no es una imitación. Una letra "G" en Aptos dentro de un círculo no cumple ese reconocimiento inmediato y probablemente incumple los lineamientos de marca de Google.
- **Fix**: reemplazar por el SVG oficial del ícono "G" de Google (asset estático gratuito de la guía de marca de Google Identity, embebido en `/public/icons` o inline). No requiere ninguna librería npm — `@thesvg/react` no existe como paquete real.
- **Suggested command**: `/impeccable polish`

**[P1] Cero especificidad de marca Timbo en el panel funcional**

- **Por qué importa**: el login podría pertenecer a cualquier empresa. El wordmark real (itálico, musculoso) no aparece, y la fotografía de la sede —el único activo genuinamente "Timbo"— está apagada bajo un velo azul del 58%.
- **Fix**: conectar el wordmark real (imagen con fondo azul marino sólido) sobre la fotografía del lado derecho, donde ese fondo se funde con el overlay `rgba(31,36,92,0.58)` y con `--access-brand` — exactamente lo que las reglas CSS ya existentes `.access-brand-statement`/`.access-wordmark` anticipaban sin estar conectadas al TSX. Poner el wordmark sobre el panel blanco izquierdo no es viable sin una versión vectorizada aislada (SVG monocromo sin el fondo sólido).
- **Suggested command**: `/impeccable bolder`

**[P2] Copy del título/subtítulo genérico y desconectado de la acción real**

- **Por qué importa**: "Acceso corporativo" / "Ingresá con tu cuenta corporativa autorizada" repite "corporativo/corporativa" en dos líneas seguidas, suena a plantilla legal, y no menciona "Google" pese a que el botón sí lo hace.
- **Fix**: usar un copy que nombre la acción real, p. ej. "Ingresá a Plataforma Timbo" / "Usá tu cuenta de Google del trabajo para continuar." — o una variante que además dé una salida en caso de rechazo ("si no tenés acceso, contactá a Sistemas").
- **Suggested command**: `/impeccable clarify`

**[P2] Sin ayuda/soporte visible, especialmente en el estado de rechazo**

- **Por qué importa**: heurística 10 (Ayuda y documentación) en 1/4. El estado `rejected` es el valle emocional real de esta pantalla y no ofrece ninguna salida — el usuario queda con un mensaje de error y el mismo botón de antes, sin saber a quién recurrir.
- **Fix**: agregar un enlace o texto discreto de contacto/soporte, visible al menos en los estados `rejected` y `technical-failure`.
- **Suggested command**: `/impeccable harden`

**[P3] Un mismo mensaje de error para causas distintas**

- **Por qué importa**: "cuenta no autorizada" y "error de red/timeout" comparten el mismo slot visual (`rejectionMessage`) sin diferenciarse — para alguien que entra varias veces al día (Alex), un error de red mal explicado se lee como un rechazo de acceso.
- **Fix**: diferenciar el copy según la causa del fallo cuando el backend lo permita.
- **Suggested command**: `/impeccable harden`

## Persona Red Flags

**Jordan (primerizo/a)**: no sabe con certeza qué cuenta de Google usar (¿personal o del trabajo?) porque el copy no lo dice; si el login falla, no tiene ningún enlace de ayuda ni indicación de a quién recurrir — puede quedar bloqueado sin saber si el error es suyo o del sistema.

**Sam (dependiente de accesibilidad)**: base técnica correcta (foco visible no reducido, `prefers-reduced-motion` respetado), pero `.access-product-name` lleva `aria-label="Plataforma Timbo"` mientras el `<span>` hijo ya contiene el mismo texto visible — riesgo de doble anuncio en lector de pantalla. Verificar con un lector real.

**Alex (uso muy frecuente)**: sin penalización visible por reingresos frecuentes, pero tampoco hay aceleración (recordar última cuenta) ni distinción entre "fallo de red" (común en planta/taller) y "sin autorización" — para quien entra varias veces al día, un error de red mal explicado se lee como rechazo de acceso.

## Minor Observations

- `aria-label` potencialmente duplicado sobre `.access-product-name` (ver Sam).
- El velo de la foto al 58% de opacidad es razonable por contraste, pero es también la causa principal de que la foto pierda su capacidad de dar calidez; vale la pena probar 40–45% si el contraste de un wordmark agregado lo permite.
- El corte diagonal (`.access-brand-cut`) es una firma visual propia y ya distingue esta pantalla de un template genérico — preservarlo intacto en cualquier iteración.
- Código CSS muerto (`.access-brand-statement`, `.access-wordmark`) sin consumidor en el TSX: es evidencia de una iteración de marca interrumpida, no una decisión vigente. Conectarlo (P1 de arriba) o eliminarlo — no dejarlo como deuda silenciosa.

## Questions to Consider

- Si el wordmark real de Timbo es itálico y agresivo, y la interfaz completa es recta y neutra, ¿el sistema "Operación corporativa clara" fue diseñado mirando la marca real de Timbo, o como plantilla genérica a la que después se le puso el nombre?
- ¿Existe el archivo fuente vectorial del wordmark (AI/EPS/SVG), o solo los rasters con fondo sólido compartidos? Sin eso, cualquier plan de usarlo sobre superficies claras queda bloqueado.
- ¿Hoy `rejectionMessage` ya distingue "no tenés cuenta corporativa registrada" de "error técnico de red/token"? Si no, ese es probablemente el problema de UX más costoso de esta pantalla, más que cualquier tema visual.
