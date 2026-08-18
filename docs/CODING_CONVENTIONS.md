# Convenciones de código

Reglas durables que se aplican a todo el código de este repositorio, independientemente de la aplicación o la actividad en curso. No documentan decisiones de una tanda particular: cuando cambien, deben seguir siendo válidas para el código futuro.

## Idioma

- **Identificadores técnicos en inglés**: nombres de archivos, carpetas, clases, funciones, variables, parámetros, tipos, rutas HTTP y claves de configuración.
- **Texto visible y documentación explicativa en español**: mensajes de commit, comentarios, README, descripciones de OpenAPI (`@ApiOperation`, `@ApiProperty`, etc.) y cualquier texto que una persona vaya a leer.

## Nombres

- Nombres completos y descriptivos; evitar abreviaturas oscuras (`HealthResponseDto`, no `HResDto`).
- Un mismo concepto se nombra igual en todo el repositorio (por ejemplo, `HealthResponseDto` se llama así en el servicio, el controller y las pruebas).

## Fronteras de responsabilidad

- **Controllers** reciben la petición HTTP, la traducen a una llamada de servicio y devuelven la respuesta. No contienen lógica de negocio.
- **Services** coordinan la lógica de la operación. No conocen detalles de HTTP (códigos de estado, cabeceras, etc.).
- **DTOs** describen la forma de entrada o salida de una operación y se documentan con decoradores de `@nestjs/swagger`. No contienen lógica.
- No se agregan capas adicionales (repositorios genéricos, fachadas, mappers) sin una necesidad concreta y demostrable en el incremento actual.

## Abstracciones

- No se crean depósitos genéricos como `utils/`, `helpers/` o `common/`. Si una función se comparte entre módulos, vive en el módulo al que pertenece conceptualmente, o se reconsidera si realmente amerita compartirse.
- No se diseñan abstracciones para necesidades hipotéticas o futuras. Se prefiere código simple y directo, aunque signifique repetir algunas líneas, antes que una abstracción prematura.

## Comentarios

- Los comentarios explican **por qué** se hizo algo cuando no es obvio (una restricción externa, una decisión que podría parecer rara, un problema concreto que se está evitando).
- No se traducen líneas de código a prosa ni se documenta lo que el nombre del identificador ya deja claro.

## Código generado

- El código generado automáticamente (por ejemplo, clientes o tipos derivados de un contrato OpenAPI) se guarda en una ubicación separada del código escrito a mano.
- El código generado nunca se edita manualmente: si algo generado está mal, se corrige la fuente (el contrato o el generador), no el archivo generado.
- El cliente de Prisma se genera reproduciblemente antes de typecheck, pruebas y build, y permanece ignorado por Git, lint y formato.

## Secretos

- Ningún secreto (contraseñas, tokens, claves de API, cadenas de conexión con credenciales) entra al repositorio, al código fuente, a los logs ni a los ejemplos.
- Las variables de entorno no secretas se documentan en `.env.example`, con su valor por defecto explicado en un comentario.

## Errores y diagnóstico

- Un error inesperado nunca se silencia, se transforma en éxito ni activa un valor por defecto engañoso. Los `catch` se reservan para aportar contexto, traducir una falla esperada o hacer cleanup; después de eso el fallo sigue siendo explícito.
- Los diagnósticos conservan operación, clase, código y stack cuando están disponibles, junto con identificadores seguros que ayuden a investigar.
- Antes de registrar o exponer un error se redactan `DATABASE_URL`, cabeceras `Authorization`, cookies, tokens, contraseñas, secretos y PII innecesaria. No se serializan ciegamente objetos de error ni `process.env`.

## Persistencia y migraciones

- Prisma y las migraciones de persistencia viven sólo en `apps/api`. Las migraciones versionadas se revisan como SQL, incluido cualquier `CHECK` personalizado que el schema declarativo no pueda expresar.
- `DATABASE_URL` es obligatoria para el arranque y las migraciones, y es siempre secreta: sólo se documentan placeholders o referencias privadas, nunca su valor real.
- `prisma migrate dev` se usa únicamente con la base aislada de development. Producción aplica exclusivamente migraciones versionadas con `prisma migrate deploy`; `db push`, `migrate dev` y `migrate reset` quedan prohibidos allí.
- Las pruebas que escriben en PostgreSQL son opt-in, exigen guardas explícitas de development y limpian sólo fixtures propios identificados. La suite normal de pruebas no abre conexiones a la base.

## Dependencias

- Toda dependencia agregada debe resolver un problema concreto del incremento en curso. No se agregan dependencias por conveniencia especulativa.
- Se prefieren versiones estables y vigentes, verificadas contra la documentación oficial y compatibles entre sí (por ejemplo, revisando `pnpm peers check` tras instalar).

## TypeScript

- `strict` habilitado en todo el repositorio.
- `any` no se usa sin una justificación excepcional documentada en un comentario junto a su uso.

## Checks obligatorios

Todo cambio debe pasar, desde la raíz del workspace: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` y `pnpm format:check`.
