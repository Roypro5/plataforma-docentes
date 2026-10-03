# Etapa 3 — Contrato técnico

Fija los nombres que comparten la base de datos y la app para que el trabajo pueda hacerse en paralelo. Complementa el [plan aprobado](etapa-3-plan.md); el [alcance aprobado](approved-scope.md) prevalece.

## Decisión de diseño: una sola fuente de verdad

El estado de cada módulo lo calcula **SQL** (`app_private.module_access`). La app no reimplementa la regla: lee el resultado por RPC y solo añade lo que la base no conoce, que es el **entorno** (el módulo demo nunca aparece en producción). Así menú, tarjetas, servidor y RLS no pueden divergir.

## Base de datos: migración `supabase/migrations/20261004000100_stage3_modules.sql`

No se edita la migración de la etapa 2; los cambios a objetos existentes van en esta.

### Tablas

| Tabla | Columnas | Restricciones |
|---|---|---|
| `modules` | `id text pk` (`^[a-z0-9-]+$`), `status text` (`hidden` · `coming_soon` · `active`), `implementation_available bool default false`, `emergency_disabled bool default false`, `sort_order int`, `created_at`, `updated_at` | Los textos visibles viven en el código (manifiestos + i18n), no en la tabla |
| `entitlements` | `code text pk`, `value_type text` (`boolean`) | Fila única: `demo.access` |
| `module_availability` | `module_id`, `country_code`, `required_entitlement text null` (fk `entitlements`) | pk (`module_id`, `country_code`) |
| `module_interests` | `user_id` (fk `users`, cascade), `module_id`, `country_code` (copiado del perfil por trigger), `created_at` | pk (`user_id`, `module_id`) |
| `announcements` | `id uuid`, `title` (1–120), `body` (1–2000, texto plano), `status` (`draft` · `published`), `starts_at`, `ends_at null`, `author_user_id null`, `country_codes text[]`, `role_codes text[]`, `plan_codes text[]`, `created_at` | Arrays vacíos = todos; AND entre dimensiones; trigger valida países y roles existentes; `plan_codes` ⊆ {`gratis`, `individual`, `institucional`}; `ends_at > starts_at` |
| `notifications` | `id uuid`, `user_id` (cascade), `kind` (`welcome` · `module_available`), `title`, `body`, `link_path` (`^/[a-z0-9/_-]*$`), `read_at null`, `dedupe_key`, `created_at` | unique (`user_id`, `dedupe_key`) |
| `activity_events` | `id bigint identity`, `user_id` (cascade), `kind` (`session.started` · `onboarding.completed` · `module.interest_added` · `module.interest_removed`), `module_id null`, `created_at` | Sin acceso del cliente |

Datos de referencia en la migración: los 5 módulos (`generador-ia`, `biblioteca`, `marketplace`, `cursos-simulacros` en `coming_soon`; `demo` en `active` con `implementation_available = true`), el entitlement `demo.access` y la disponibilidad en `PE` de los 4 módulos futuros **sin** derecho requerido.

Seed (solo dev y staging): disponibilidad de `demo` en `PE` con `required_entitlement = 'demo.access'` y un aviso publicado con título «Aviso de prueba», sin restricción de audiencia.

### Funciones

- `app_private.has_entitlement(code) → boolean`: **siempre `false`** hasta la etapa 5 (no existen suscripciones). Comentario explícito.
- `app_private.current_plan_code() → text`: `'gratis'` hasta la etapa 5.
- `app_private.module_access(p_module text) → text`, en este orden:
  1. Usuario no activo → `hidden`.
  2. `status = 'hidden'` → `hidden`.
  3. Sin fila de disponibilidad para el país del perfil → `hidden`.
  4. `emergency_disabled` → `disabled`.
  5. `status = 'coming_soon'` → `coming_soon`.
  6. Con derecho requerido y sin `has_entitlement` → `requires_entitlement`.
  7. `implementation_available = false` → `coming_soon`.
  8. En cualquier otro caso → `available`.
- `public.list_my_modules() → table(module_id text, access text, sort_order int, interested boolean)`: excluye `hidden`.
- `public.register_module_interest(p_module text)`: solo si `module_access = 'coming_soon'`; idempotente (`on conflict do nothing`); registra actividad. Si no aplica, lanza `42501`.
- `public.withdraw_module_interest(p_module text)`: borra el interés propio; idempotente; registra actividad.
- `public.mark_notifications_read(p_ids uuid[] default null)`: `null` marca todas las propias.
- `public.record_session_started()`: inserta `session.started` para el usuario activo.
- Triggers:
  - Perfil con `onboarding_completed_at` que pasa de `null` a un valor → notificación `welcome` (dedupe `welcome`) + actividad `onboarding.completed`.
  - `modules.status` que pasa a `active` → notificación `module_available` (dedupe `module_available:<id>`, enlace `/modulos/<id>`) para cada usuario con interés.

### Acceso (RLS y GRANT)

- `modules`, `entitlements`, `module_availability`: SELECT para autenticados; sin escritura.
- `module_interests`: SELECT y DELETE propios; INSERT propio solo si `module_access(module_id) = 'coming_soon'`.
- `announcements`: SELECT si está publicado, vigente y la audiencia coincide con el país del perfil, los roles de plataforma y `current_plan_code()`, con usuario activo.
- `notifications`: SELECT propio con usuario activo; escritura solo vía funciones.
- `activity_events`: sin privilegios para el cliente.

## App (`artifacts/docente/src`)

| Archivo | Contenido |
|---|---|
| `modules/registry.ts` | Manifiestos: `{ id, icon (lucide), devOnly }` para los 5 ids de arriba; `demo` con `devOnly: true` |
| `i18n/es-modulos.ts` | Nombre y descripción de cada módulo, textos del panel, de las notificaciones y de los estados |
| `core/modules/access.ts` | `type ModuleAccess = "coming_soon" \| "available" \| "requires_entitlement" \| "disabled"` y `applyEnvironment(access, manifest, appEnv)`: `devOnly` en `production` → oculto. Con pruebas unitarias |
| `core/modules/queries.ts` | `listMyModules(supabase)` = RPC + manifiestos + `applyEnvironment` |
| `core/modules/actions.ts` | Server Actions de interés y de marcar como leídas |
| `app/panel/page.tsx`, `app/notificaciones/page.tsx`, `app/modulos/[id]/page.tsx` | Pantallas; `/modulos/[id]` vuelve a comprobar el acceso en el servidor |
| `app/manifest.ts` + iconos PNG 192 y 512 | PWA sin service worker |

Navegación: «Mi cuenta» pasa a «Panel» (`/panel`) y el perfil se enlaza desde el panel. El destino por defecto tras ingresar y tras el onboarding pasa a ser `/panel`. Las nuevas rutas privadas se añaden a `protectedPrefixes`.
