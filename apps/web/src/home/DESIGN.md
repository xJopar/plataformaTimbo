# Fondo aurora del launcher

El home usa una aurora ambiental para diferenciar el punto de entrada a las aplicaciones sin
convertir el color en una señal de acción. Tres masas de turquesa, cian azulado y teal respiran
durante 10 segundos y se desplazan apenas con el puntero fino; el contenido, los controles y la
navegación permanecen estáticos. La masa superior izquierda domina la composición y las otras dos
descienden en intensidad para conservar una jerarquía asimétrica.

El efecto anima exclusivamente `transform`. El granulado es una textura estática y no se emplean
desenfoques, canvas ni shaders en tiempo real. El seguimiento del puntero agrupa eventos con
`requestAnimationFrame`, escribe directamente sobre las capas decorativas y no provoca renders de
React.

En dispositivos sin hover o con puntero impreciso se conserva sólo la respiración. Con
`prefers-reduced-motion: reduce`, toda la decoración queda inmóvil en una composición representativa.
