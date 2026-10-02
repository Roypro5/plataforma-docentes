# Entornos y conexiones pendientes

## Lo que puede ejecutarse sin servicios externos

La demo de etapa 1 es una aplicación Next.js sin autenticación ni acceso a datos. No consulta la base integrada de Replit. La vista previa no equivale al staging Vercel autorizado ni demuestra aislamiento Supabase.

Comandos desde la raíz:

- `pnpm install --frozen-lockfile`
- `pnpm --filter @workspace/docente lint`
- `pnpm --filter @workspace/docente typecheck`
- `pnpm --filter @workspace/docente test`
- `pnpm --filter @workspace/docente build`

Servicio administrado: `artifacts/docente: web`. Las carpetas API y Canvas son scaffolds existentes, no dependencias de esta aplicación. No es necesario ejecutarlas.

## Variables para cargar en Vercel — etapa 1

| Variable | Visibilidad | Valor que debe cargar el propietario | Necesidad |
|---|---|---|---|
| NEXT_PUBLIC_APP_ENV | Pública, disponible en navegador y servidor | `staging` | Configurar para etiquetar correctamente los errores del staging |
| NEXT_PUBLIC_SENTRY_DSN | Pública, disponible en navegador y servidor | DSN real del proyecto Sentry Free destinado a pruebas | Necesaria para verificar Sentry; puede omitirse para mostrar la demo, pero entonces no se envían errores |

**No hay secretos exclusivamente de servidor requeridos por la aplicación en esta etapa.** Un DSN de Sentry es un identificador público de ingestión, no un token de administración. No colocar un token de API de Sentry en ese campo.

Seleccionar el alcance **Preview** en Vercel. Si se utiliza la rama que Vercel denomina **Production** dentro de un proyecto dedicado exclusivamente al staging, cargar allí los mismos valores de staging. Ese nombre de Vercel no convierte este proyecto en la producción real del producto.

Las variables `NEXT_PUBLIC_*` se incorporan al JavaScript durante el build: cambiarlas exige un nuevo despliegue y nunca deben contener secretos. `NEXT_PUBLIC_APP_ENV` solo etiqueta la telemetría en la implementación actual: no configura aislamiento de bases ni constituye un control de acceso.

### No cargar en Vercel en etapa 1

- `PORT`, `BASE_PATH`, `NEXT_RUNTIME`, `NODE_ENV` y variables `VERCEL_*`: no añadirlas manualmente para esta app; los scripts y el proveedor resuelven el entorno de ejecución.
- `EPHEMERAL_DATABASE_URL`: únicamente en GitHub Actions para la base temporal del harness SQL/RLS. Nunca reutilizar una base real para esa prueba.
- `SESSION_SECRET`: el scaffold existente la tiene disponible, pero esta aplicación Next.js no la utiliza.
- `SENTRY_AUTH_TOKEN`: no se necesita; no hay subida de sourcemaps configurada.
- Tokens de Vercel o GitHub: no son variables de ejecución de la app y no se necesitan para que el propietario conecte su repositorio a Vercel.

### Variables previstas para etapa 2 — no cargar todavía

| Variable | Visibilidad | Uso futuro |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Pública | URL del proyecto Supabase de staging, separado del de desarrollo |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Pública | Clave publicable del mismo proyecto; el acceso a datos debe quedar protegido por RLS |
| SUPABASE_SERVICE_ROLE_KEY | Secreta, solo servidor, únicamente si resulta necesaria | Operaciones privilegiadas controladas; nunca prefijo NEXT_PUBLIC ni acceso desde navegador |

Estos nombres futuros están documentados, pero el código de etapa 1 no los consume. No cargar una clave privilegiada por adelantado. Introducir secretos solo en los gestores de variables del proveedor, no en chat, archivos versionados ni logs.

## Supabase Free

Crear/confirmar dos proyectos Free independientes, desarrollo y staging, en una organización Free. Solo avanzar si no supera el límite Free disponible. No crear tablas del producto en etapa 1. No copiar datos reales.

La integración Supabase no apareció en la búsqueda disponible. Esto no impide usar su SDK/servicio externo aprobado; sus proyectos y credenciales deben configurarse de forma segura por el propietario. No sustituir silenciosamente el proveedor.

## Vercel Hobby

El usuario confirmó que el equipo está en Hobby. **No usar la API de Vercel.** El propietario conectará GitHub cuando el repositorio de etapa 1 esté listo. No se requiere ampliar permisos del conector existente para continuar.

Configuración prevista al importar el repositorio completo:

- Framework: Next.js.
- Root Directory: `artifacts/docente`.
- Incluir archivos fuera de Root Directory: activado; se necesitan el workspace, lockfile y configuración TypeScript compartida.
- Install Command: `pnpm install --frozen-lockfile`.
- Build Command: `pnpm run build` (se ejecuta dentro del directorio raíz seleccionado).
- Output Directory: valor predeterminado de Next.js; no usar `dist`.
- Node.js: 24.x, en correspondencia con CI.
- Proyecto dedicado a staging, sin datos reales y uso no comercial.

Mantener en GitHub `pnpm-lock.yaml`, `pnpm-workspace.yaml`, la configuración compartida y los paquetes referenciados por el workspace. No subir `.env*` con valores reales, `.next` ni `node_modules`. Verificar protección de acceso del despliegue de prueba antes de considerarlo privado: `noindex` no restringe acceso.

No publicar automáticamente. La autorización de trabajo no sustituye la confirmación de publicación. Hasta disponer de despliegue y URL verificables, registrar staging como pendiente, no como terminado.

## Sentry Free

Instrumentación servidor/navegador preparada, sin replay ni tracing. Se omiten datos de usuario, petición, contexto, logs y mensajes arbitrarios. No activa planes pagados ni subida automática de sourcemaps.

Pendiente conectar proyecto Sentry Free, configurar DSN y verificar recepción de un error sintético. Las pruebas del filtro local no prueban entrega al proveedor.

## CI

Workflow .github/workflows/foundation.yml listo para un repositorio GitHub autorizado. PostgreSQL se inicia como servicio efímero del runner de GitHub; no requiere Docker en el entorno de desarrollo ni usa bases del producto.

El harness SQL prueba que la infraestructura de CI detecta violaciones RLS de lectura/escritura con un rol no privilegiado. No es evidencia de políticas del producto, que se implementan en etapa 2. Todo se revierte en transacción.

Playwright/axe está preparado como prueba de humo de rutas y accesibilidad desktop/360px. No declarar CI remoto verde sin URL de ejecución. Para evitar costes, confirmar cuotas gratuitas de Actions antes de habilitar su ejecución en una cuenta.

## Lanzamiento futuro

Solo por autorización posterior: Supabase Pro + Vercel Pro, sin PITR. Base orientativa US$45, no presupuesto máximo aprobado. RPO 24h/RTO 8h son objetivos, no restauración verificada.