# Entornos y verificación de staging

## Lo que puede ejecutarse sin servicios externos

La demo de etapa 1 es una aplicación Next.js sin autenticación ni acceso a datos. No consulta la base integrada de Replit. La vista previa no equivale al staging Vercel autorizado ni demuestra aislamiento Supabase.

Comandos desde la raíz:

- `pnpm install --frozen-lockfile`
- `pnpm --filter @workspace/docente lint`
- `pnpm --filter @workspace/docente typecheck`
- `pnpm --filter @workspace/docente test`
- `pnpm --filter @workspace/docente build`

Servicio administrado: `artifacts/docente: web`. Las carpetas API y Canvas son scaffolds existentes, no dependencias de esta aplicación. No es necesario ejecutarlas.

## Variables de Vercel — etapa 1

| Variable | Visibilidad | Valor que debe cargar el propietario | Necesidad |
|---|---|---|---|
| NEXT_PUBLIC_APP_ENV | Pública, disponible en navegador y servidor | `staging` | Configurar para etiquetar correctamente los errores del staging |
| NEXT_PUBLIC_SENTRY_DSN | Pública, disponible en navegador y servidor | DSN real del proyecto Sentry Free destinado a pruebas | Necesaria para verificar Sentry; puede omitirse para mostrar la demo, pero entonces no se envían errores |

**No hay secretos exclusivamente de servidor requeridos por la aplicación en esta etapa.** Un DSN de Sentry es un identificador público de ingestión, no un token de administración. No colocar un token de API de Sentry en ese campo.

El propietario confirmó que ambas variables están cargadas en **Production and Preview**. `NEXT_PUBLIC_APP_ENV=staging`; el DSN se cargó manualmente, sin añadir la integración de Sentry de Vercel. No se registra el valor del DSN en este documento.

La rama `main` utiliza el contexto que Vercel denomina **Production** dentro de un proyecto dedicado exclusivamente al staging. Ese nombre de Vercel no convierte este proyecto en la producción real del producto.

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

El propietario confirmó el despliegue en equipo **Hobby**, proyecto **`plataforma-docentes.staging`**, rama **`main`**, Root Directory **`artifacts/docente`**.

- URL de staging: https://plataforma-docentesstaging.vercel.app/
- Verificación externa: `/`, `/sistema`, `/ayuda` y `/hoja-de-ruta` responden HTTP 200.
- Navegador automatizado a 1280 y 360 px: un `h1` por ruta, `lang=es-PE`, ancho del documento igual al viewport y cero violaciones en axe con etiquetas `wcag2a`, `wcag2aa`, `wcag21aa`.
- Todas las rutas incluyen `noindex, nofollow`. El sitio es accesible públicamente; esto no prueba que exista protección de acceso.
- Revisión del propietario en su celular: **sin resultado confirmado**; su mensaje conservaba el texto de plantilla.

**No usar la API de Vercel.** La verificación se realizó sobre la URL pública y GitHub Actions, sin invocar dicha API ni cambiar la configuración del proveedor.

Configuración de referencia del repositorio (los ajustes no mencionados por el propietario no se inspeccionaron en el panel de Vercel):

- Framework: Next.js.
- Root Directory: `artifacts/docente`.
- Incluir archivos fuera de Root Directory: activado; se necesitan el workspace, lockfile y configuración TypeScript compartida.
- Install Command: `pnpm install --frozen-lockfile`.
- Build Command: `pnpm run build` (se ejecuta dentro del directorio raíz seleccionado).
- Output Directory: valor predeterminado de Next.js; no usar `dist`.
- Node.js: 24.x, en correspondencia con CI.
- Proyecto dedicado a staging, sin datos reales y uso no comercial.

Mantener en GitHub `pnpm-lock.yaml`, `pnpm-workspace.yaml`, la configuración compartida y los paquetes referenciados por el workspace. No subir `.env*` con valores reales, `.next` ni `node_modules`. Verificar protección de acceso del despliegue de prueba antes de considerarlo privado: `noindex` no restringe acceso.

No publicar automáticamente ni cambiar planes. El despliegue realizado por el propietario y su URL pública ya están verificados; no se creó un despliegue mediante API.

## Sentry Free

Instrumentación servidor/navegador preparada, sin replay ni tracing. Se omiten datos de usuario, petición, contexto, logs y mensajes arbitrarios. No activa planes pagados ni subida automática de sourcemaps.

El propietario configuró el DSN manualmente en Vercel. No es necesaria la integración de Sentry de Vercel para enviar eventos con el SDK existente.

### Error sintético ejecutado en staging

Se provocó **un único error** con un temporizador del navegador, sin añadir botones, rutas de prueba ni cambiar código desplegado.

- Event ID: `1f8cfc95da1e4b708749e02280ef786d`.
- Entorno del evento: `staging`.
- Respuesta del endpoint de ingestión Sentry: **HTTP 200**.
- Excepción enviada: `ApplicationError` / `Detalle omitido por privacidad`.
- Sin `user`, `request`, `contexts` ni `tags` en el evento observado.

Esto verifica el envío desde la aplicación desplegada y su aceptación por el endpoint de Sentry. **La aparición del evento en Issues aún no está verificada**: requiere acceso de lectura al proyecto Sentry. El DSN permite ingestión, no lectura de eventos. Correlacionar por Event ID, no por el mensaje de prueba, que el filtro de privacidad omite deliberadamente.

## CI

Workflow `.github/workflows/foundation.yml` añadido por el propietario. Ejecución remota **completada con éxito**, consultada mediante GitHub:

- Commit de aplicación verificado: `bf8b3a4b5cbd9ce0ee7839a5eeb71363b7b0f9f0`.
- CI: https://github.com/Roypro5/plataforma-docentes/actions/runs/37080506638
- Job `foundation`: instalación congelada, lint, typecheck, unitarias, harness SQL/RLS, build, Playwright/axe y carga del reporte aprobados.
- Las correcciones de interfaz conservaron la prueba de humo y el workflow intactos.

PostgreSQL se inicia como servicio efímero del runner de GitHub; no requiere Docker en el entorno de desarrollo ni usa bases del producto.

El harness SQL prueba que la infraestructura de CI detecta violaciones RLS de lectura/escritura con un rol no privilegiado. No es evidencia de políticas del producto, que se implementan en etapa 2. Todo se revierte en transacción.

Playwright/axe pasó remotamente en escritorio y móvil de 360 px. Esto no certifica WCAG completo ni sustituye una revisión manual. Mantener las ejecuciones dentro de las cuotas gratuitas de Actions.

## Cierre y autorización

Demo de staging y CI remoto verificados. Para el cierre formal siguen pendientes la lectura del evento en Sentry y la confirmación de los dos proyectos Supabase Free independientes exigidos por el alcance. La revisión en celular del propietario no se presupone aprobada.

La etapa 2 **no está iniciada** y necesita aprobación explícita. Para preparar su ejecución se requerirán los proyectos Supabase de desarrollo/staging y su configuración segura, habilitación de correo/Google en Supabase Auth, identidad verificada del superadmin y validación de los textos mínimos de consentimiento y del responsable de datos. No enviar credenciales por chat ni cargar variables de etapa 2 antes de autorizarla.

## Lanzamiento futuro

Solo por autorización posterior: Supabase Pro + Vercel Pro, sin PITR. Base orientativa US$45, no presupuesto máximo aprobado. RPO 24h/RTO 8h son objetivos, no restauración verificada.