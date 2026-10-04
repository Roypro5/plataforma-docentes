# Etapa 5 — Contrato técnico

Fija los nombres que comparten la base de datos y la app para trabajar en paralelo. Complementa el [plan aprobado](etapa-5-plan.md); el [alcance aprobado](approved-scope.md) prevalece.

## Decisiones de diseño

- **La base decide.**
  - Precio, contexto, estados y derechos los calcula SQL.
  - La app solo llama a funciones y muestra el resultado.
  - El navegador nunca envía importes ni estados de suscripción.
- **Sandbox fail-closed.**
  - `app_private.sandbox_enabled()` devuelve `false` en la migración. Solo `supabase/seed.sql`, que se aplica en dev y staging y nunca en producción, la reemplaza para que devuelva `true`.
  - Sin ella, no se puede iniciar un checkout ni resolver un pago.
- **Vigencia por fechas.**
  - Una suscripción es *vigente* si `status = 'active'` y `now() < current_period_end`.
  - No hay cron. Las funciones que lo necesitan marcan como vencido lo caducado al consultarlo.
- **Contexto personal.** Esta etapa solo vende en el workspace **personal** del usuario. `has_entitlement` y `current_plan_code` leen solo ese workspace: los derechos institucionales y personales nunca se suman.
- **Sin pasarela real ni webhooks.** El «adaptador sandbox» es la función `sandbox_resolve_payment`, que la página de pasarela de prueba llama en nombre del usuario. Todo va etiquetado como prueba.

## Base de datos: migración `supabase/migrations/20261006000100_stage5_billing.sql`

No se editan migraciones aplicadas; usa `create or replace` y `alter` donde haga falta.

### Tablas nuevas (5)

El total pasa de 21 a 26 tablas.

| Tabla | Columnas | Restricciones |
|---|---|---|
| `plans` | `code text pk` (`gratis` · `individual` · `institucional`), `scope text` (`personal` · `institutional`), `active bool`, `visible bool`, `sort_order int` | Datos en la migración: gratis (personal, activo, visible, 10), individual (personal, activo, visible, 20), institucional (institutional, **inactivo, oculto**, 30) |
| `plan_prices` | `id uuid pk`, `plan_code` fk, `country_code` fk, `currency text` (`^[A-Z]{3}$`), `amount_minor int > 0`, `period text` (`month`), `active bool`, `created_at` | Índice único parcial (`plan_code`, `country_code`) where `active`. Trigger: solo `active` es modificable. Datos en la migración: individual / PE / PEN / 1990 / month |
| `plan_entitlements` | `plan_code` fk, `entitlement_code` fk `entitlements` | pk de ambos. Datos: `individual` → `demo.access` |
| `subscriptions` | `id uuid pk`, `workspace_id` fk `workspaces` **on delete cascade**, `plan_code` fk, `plan_price_id` fk, `status text` (`incomplete` · `active` · `expired` · `incomplete_expired`), `current_period_start`, `current_period_end` (ambos `null` salvo si está o estuvo activa), `cancel_at_period_end bool default false`, `canceled_at null`, snapshot: `price_amount_minor int`, `price_currency text`, `price_period text`, `entitlement_codes text[]`, `created_at`, `activated_at null`, `updated_at` | Índice único parcial en `workspace_id` where `status in ('incomplete','active')`. Check de coherencia: si está activa, tiene periodo |
| `payments` | `id uuid pk`, `subscription_id` fk **on delete cascade**, `amount_minor int`, `currency text`, `provider text` (`sandbox`), `status text` (`pending` · `approved` · `rejected` · `canceled` · `expired`), `idempotency_key text unique`, `provider_reference text unique null`, `expires_at`, `created_at`, `resolved_at null` | `provider_reference` y `resolved_at` no nulos si `status <> 'pending'`. Trigger: una vez resuelto, el pago es inmutable |

### Acceso (RLS y GRANT)

- `plans`, `plan_prices` y `plan_entitlements`: `select` para `authenticated`, sin escritura.
- `subscriptions` y `payments`: **ningún privilegio de tabla** para el cliente. Todo pasa por las funciones de abajo, así que no hay escrituras directas.
- Cada función nueva: `revoke` a `public`, `anon` y `authenticated`, y `grant execute` solo a `authenticated` donde corresponda.

### Funciones privadas

- `app_private.sandbox_enabled() → boolean`: `false` en la migración (comentario explícito). El seed la reemplaza con `true`.
- `app_private.personal_workspace_id(p_user uuid default auth.uid()) → uuid`.
- `app_private.expire_stale(p_workspace uuid)`: lazy.
  - Pagos `pending` con `expires_at <= now()` → `expired`, con `resolved_at` y `provider_reference` `'sandbox-' || id`; su suscripción `incomplete` → `incomplete_expired`.
  - Suscripciones `active` con `current_period_end <= now()` → `expired`.
- `create or replace app_private.has_entitlement(p_code)`: `security definer`. Existe una suscripción vigente en el workspace personal de `auth.uid()` con `p_code = any(entitlement_codes)`, y el usuario está activo.
- `create or replace app_private.current_plan_code()`: el `plan_code` de la suscripción personal vigente, o `'gratis'`.

### Funciones públicas (usuario)

Todas `security definer`, con `set search_path = ''` y usuario activo (`42501` si no).

- `sandbox_available() returns boolean`: devuelve `sandbox_enabled()`, para que la interfaz explique cuándo el checkout no está habilitado. Requiere usuario activo, como las demás.
- `list_plans()`
  - Devuelve: `plan_code text, scope text, price_id uuid, amount_minor int, currency text, period text, entitlement_codes text[], sort_order int`.
  - Solo planes activos y visibles. El precio activo es el del país del perfil; Gratis devuelve los campos de precio en `null`.
- `start_checkout(p_plan text) returns uuid` (id del pago)
  - `sandbox_enabled()` falso → `42501`.
  - El plan debe ser activo, visible, personal y distinto de `gratis`, y tener un precio activo en el país del perfil; si no → `22023`.
  - Llama a `expire_stale`. Si ya hay una suscripción vigente → `23514`.
  - Si ya hay una `incomplete` con un pago `pending` no vencido, devuelve **ese** pago (doble clic idempotente).
  - Si no, crea la suscripción `incomplete` con el snapshot (importe, moneda, periodo y `entitlement_codes` de `plan_entitlements`) y un pago `pending` con `expires_at = now() + 30 min`.
  - Audita `checkout.started`, con `details {plan, payment_id}`.
- `sandbox_resolve_payment(p_payment uuid, p_result text) returns text` (estado final del pago)
  - `sandbox_enabled()` falso → `42501`. Pago inexistente o de otro usuario → `P0002`. `p_result` ∈ {`approved`, `rejected`, `pending`, `canceled`}; otro → `22023`.
  - Bloquea el pago (`for update`) y aplica la expiración lazy.
  - **Pendiente:**
    - con `approved`: el pago queda `approved` con `provider_reference = 'sandbox-' || id`. La suscripción pasa a `active`, con periodo `now()` → `now() + interval '1 month'` y `activated_at`. Se crea la notificación `subscription_activated` y se audita `subscription.activated`.
    - con `rejected`: pago `rejected`, suscripción `incomplete_expired`, notificación `payment_rejected`.
    - con `canceled`: pago `canceled`, suscripción `incomplete_expired`.
    - con `pending`: sin cambios.
  - **Ya resuelto**, sea con el mismo resultado o con otro: **sin cambios**. Devuelve el estado actual. Una repetición o un resultado tardío nunca revierten nada.
  - Toda resolución efectiva audita `payment.resolved`, con `details {result, payment_id}`.
- `get_payment(p_payment uuid)`
  - Devuelve: `id, status, plan_code, amount_minor, currency, expires_at, created_at, resolved_at`.
  - Aplica la expiración lazy. Solo pagos propios; si no → `P0002`.
- `my_plan()`
  - Una fila: `plan_code text` (`gratis` si no hay suscripción vigente), `subscription_id uuid null`, `status text null`, `current_period_start`, `current_period_end`, `cancel_at_period_end bool`, `amount_minor int null`, `currency text null`, `pending_payment_id uuid null`.
  - `pending_payment_id` es el pago pendiente no vencido, si existe. Aplica la expiración lazy.
- `list_my_payments(p_page int default 1)`
  - Devuelve: `id, created_at, resolved_at, status, amount_minor, currency, plan_code, provider, total_count`. Página de 20; orden `created_at desc, id`.
- `cancel_subscription()`
  - Exige una suscripción vigente (si no → `P0002`) que no esté ya cancelada (si lo está → `23514`).
  - Pone `cancel_at_period_end = true` y `canceled_at = now()`. Audita `subscription.canceled`.
- `resume_subscription()`
  - Exige una suscripción vigente con `cancel_at_period_end`; si no → `23514`.
  - Lo pone en `false` y `canceled_at` en `null`. Audita `subscription.resumed`.

### Funciones públicas (admin, permiso nuevo `admin.billing.read` para admin y superadmin)

Siguen el patrón de la etapa 4: `require_admin`, 20 filas por página y `total_count`.

- `admin_list_subscriptions(p_status text default null, p_plan text default null, p_page int default 1)`
  - Devuelve: `id, user_id, email, plan_code, status, is_current bool, current_period_start, current_period_end, cancel_at_period_end, amount_minor, currency, created_at, activated_at, total_count`.
  - Audita `billing.subscriptions_listed`.
- `admin_list_payments(p_status text default null, p_page int default 1)`
  - Devuelve: `id, subscription_id, user_id, email, amount_minor, currency, provider, status, provider_reference, created_at, resolved_at, expires_at, total_count`.
  - Audita `billing.payments_listed`.
- `admin_metric_conversion()`
  - Una fila: `converted_users bigint, converted_last_30_days bigint`.
  - Primera activación de Individual por usuario (`activated_at` mínimo de su workspace personal), sin usuarios `is_seed`.
- El modelo es de solo lectura: no hay funciones admin que modifiquen suscripciones ni pagos.

### Otros cambios

- `notifications.kind` admite además `subscription_activated` (enlace `/mi-plan`) y `payment_rejected` (enlace `/planes`). Los textos son en español y claros sobre que se trata de una prueba.
- `permission_matrix()`: añade `admin.billing.read` para admin y superadmin.
- `supabase/seed.sql`: añade al final la redefinición de `sandbox_enabled()` → `true`, con un comentario «SOLO dev y staging».

### Precisiones de la implementación (db-engineer)

- `list_plans`: un plan visible **sin precio activo en el país del perfil** (por ejemplo, un perfil sin país) también devuelve los campos de precio en `null`, igual que Gratis. `start_checkout` lo rechaza con `22023`.
- `start_checkout`: si hay un checkout en curso de **otro** plan, devuelve `23514` (hoy solo se vende Individual).
- `sandbox_resolve_payment`: un pago vencido devuelve `expired`. Un `p_result` nulo o desconocido devuelve `22023`.
- `my_plan`: los campos de suscripción vienen solo de la suscripción **vigente**. Sin ella, son `null`, salvo `cancel_at_period_end = false`. Un checkout en curso se ve únicamente en `pending_payment_id`.
- `list_my_payments`: una página inválida (`< 1` o `null`) devuelve `22023`.
- `get_payment`, `my_plan` y `list_my_payments` son volátiles, porque aplican la expiración lazy.
- Auditoría:
  - `checkout.started`, `subscription.activated`, `subscription.canceled` y `subscription.resumed` usan el recurso `subscription`; `payment.resolved` usa `payment`. La activación lleva `details {plan, payment_id}`; cancelar y reanudar, `{plan}`.
  - `billing.subscriptions_listed` lleva `{status, plan, page}` y `billing.payments_listed`, `{status, page}`.
  - `admin_metric_conversion` no se audita.
- Admin: `status` es el estado guardado e `is_current` compara fechas. Una suscripción institucional sale con `user_id` y `email` en `null`.
- Integridad añadida:
  - triggers que hacen inmutables el snapshot de la suscripción y el pago resuelto;
  - solo se admiten las transiciones `incomplete → active | incomplete_expired` y `active → expired`;
  - el ámbito del plan debe coincidir con el tipo de workspace, y el precio con el plan;
  - Gratis no admite precio ni suscripción.

  Las violaciones devuelven `23514`.
- `plans`, `plan_prices` y `plan_entitlements` solo exponen al cliente los planes activos y visibles.
- **Orden de bloqueo (B2):** toda función que llama a `expire_stale` o bloquea un pago o una suscripción bloquea **primero** el workspace personal (`select … from public.workspaces where id = v_ws for update`) y después lo demás. Lo cumplen `start_checkout`, `sandbox_resolve_payment`, `get_payment`, `my_plan`, `list_my_payments`, `cancel_subscription` y `resume_subscription`. Así no hay esperas en cruz.
- **Límites conocidos:**
  - **B1.** Los triggers no impiden que el propietario de la base extienda un periodo ni active una suscripción sin un pago aprobado. La invariante «activa ⇒ pago aprobado» se apoya en las funciones; el cliente no tiene privilegios de tabla.
  - **B3.** El precio se elige con `profiles.country_code`, que el usuario puede editar. Hoy no tiene efecto, porque solo hay precio en PE. Antes de tener precios por país hay que fijar un país de facturación verificado.
  - **B7.** La serialización (bloqueos y su orden) se comprueba de forma estática en el código de las funciones, no con dos conexiones reales, por la arquitectura de transacción única del harness.

### Pruebas del harness

- **Planes y precios:** Gratis no tiene precio; el precio es inmutable; Institucional no aparece ni admite checkout.
- **Checkout:**
  - sin sandbox (reemplazando la función con `false` dentro de un savepoint) → `42501`;
  - el doble clic devuelve el mismo pago;
  - con una suscripción vigente → `23514`;
  - el precio lo fija el servidor.
- **Resultados del pago:**
  - aprobado: la suscripción queda vigente y `module_access('demo')` pasa de `requires_entitlement` a `available`;
  - rechazado y cancelado: siguen en Gratis;
  - pendiente: sin cambios;
  - repetición: sin efectos duplicados (una notificación, una auditoría);
  - fuera de orden: un rechazo después de la aprobación no revierte nada;
  - vencimiento: un pago `pending` con `expires_at` en el pasado queda `expired` y ya no se puede aprobar.
- **Vigencia:**
  - con `current_period_end` en el pasado, el demo queda bloqueado y `my_plan` dice `gratis`;
  - cancelar mantiene el acceso hasta el fin del periodo;
  - reanudar funciona.
- **Aislamiento:**
  - B no lee los pagos ni las suscripciones de A, ni con las funciones ni con las tablas;
  - una suscripción en un workspace institucional (insertada directamente) no da derechos personales a sus miembros;
  - ningún otro módulo se desbloquea.
- **Avisos:** un aviso con `plan_codes = {individual}` lo ve solo quien tiene Individual vigente.
- **Admin:**
  - funciones nuevas rechazadas a anon, a un docente, a un admin con aal1 y a un admin suspendido;
  - la conversión, exacta sobre un dataset conocido y sin usuarios seed.
- **Eliminación de cuenta:** borra en cascada la suscripción y los pagos.
- **Mutaciones:** sobre las funciones críticas, igual que en la etapa 4.

## App (`artifacts/docente/src`)

Rutas nuevas, protegidas (el orquestador las añade a `protectedPrefixes`):

| Ruta | Agente |
|---|---|
| `/planes`, `/planes/checkout`, `/planes/sandbox/[pago]`, `/planes/resultado` y `/mi-plan` | ui-builder A |
| `/modulos/demo` (contenido del demo), `/admin/planes-pagos` y la conversión en `/admin/metricas` | ui-builder B |

- **ui-builder A**
  - `core/billing/{schemas,queries,actions}.ts`, `components/planes/**` e `i18n/es-planes.ts`.
  - Enlace «Mi plan» desde `/perfil` y desde `/panel` (edición mínima en esas páginas).
  - Importes con un formateador `formatMinor(amount, currency)` (`es-PE`, «S/ 19.90») más la etiqueta «prueba» en todos los importes.
- **ui-builder B**
  - `components/modulos/demo-content.tsx` y edición mínima de `app/modulos/[id]/page.tsx` para mostrarlo solo si el acceso es `available`.
  - `core/admin/facturacion-*.ts`, `components/admin/facturacion/**` e `i18n/es-admin-facturacion.ts`.
  - Una sección nueva en `core/admin/sections.ts` (`planes-pagos`, permiso `admin.billing.read`) y en `es-admin.ts`. Son las dos únicas piezas compartidas que puede tocar, y solo para añadir.
  - Conversión en `/admin/metricas`.
  - **Suite E2E:**
    - `tests/e2e/*.spec.ts` con `playwright.e2e.config.ts`. Base URL desde `E2E_BASE_URL`; credenciales desde `E2E_DOCENTE_EMAIL` y `E2E_DOCENTE_PASSWORD`, nunca en el repo.
    - Workflow `.github/workflows/e2e-staging.yml`, solo con `workflow_dispatch` y esos tres valores como secrets.
    - Flujo: ingreso → panel → interés (registrar y retirar) → si está en Gratis, checkout rechazado y luego aprobado → demo disponible → Mi plan → cancelar y reanudar. Si ya tiene Individual vigente, verifica el demo y Mi plan. Es repetible.
- **Errores:** los mismos códigos de la etapa 4 (`42501`, `22023`, `P0002`, `23514`), con mensajes propios.
- **Resultado del pago:** `/planes/resultado` lee el pago con `get_payment` y **nunca** acredita nada por los parámetros de la URL.
- **Producción:** con `sandbox_enabled()` falso, `/planes` muestra los planes pero el botón de checkout explica que los pagos de prueba no están habilitados en este entorno.
