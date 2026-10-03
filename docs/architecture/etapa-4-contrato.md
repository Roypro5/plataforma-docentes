# Etapa 4 — Contrato técnico

Fija los nombres que comparten la base de datos y la app para que el trabajo pueda hacerse en paralelo. Complementa el [plan aprobado](etapa-4-plan.md); el [alcance aprobado](approved-scope.md) prevalece.

## Decisiones de diseño

- **La base decide.** Cada acción y cada consulta administrativa es una función `public.admin_*` con `security definer` y `search_path = ''`. Su primera instrucción es `perform app_private.require_admin('<permiso>')`, que exige usuario activo, el permiso de la matriz y una sesión `aal2`. La app repite la comprobación (`requireAdmin`) solo para mostrar la pantalla correcta; nunca es la protección.
- **Sin tablas nuevas.** Se usan las tablas de las etapas 2 y 3. Las métricas son funciones, no vistas.
- **Auditoría redactada.** Toda mutación escribe en `audit_logs` con `app_private.audit('admin', …)`. Los `details` solo llevan identificadores y códigos, nunca correos, nombres ni textos de avisos. Entre las lecturas, solo se auditan las que exponen datos personales: la búsqueda de usuarios y la lista de miembros de una organización.
- **El módulo `demo` queda fuera del panel.** Se gestiona solo con la migración y el seed, así que el panel no puede activarlo en ningún entorno (y la app ya lo oculta en producción).
- **Paginación fija** de 20 filas en SQL. `p_page` empieza en 1 y cada fila incluye `total_count bigint` (`count(*) over ()`). Una página fuera de rango devuelve cero filas.

## Base de datos: migración `supabase/migrations/20261005000100_stage4_admin.sql`

No se editan migraciones aplicadas. Esta migración:

1. Reemplaza `app_private.permission_matrix()` (`create or replace`, misma firma) con los permisos nuevos.
2. Crea las funciones de abajo.
3. Revoca `execute` a `public`, `anon` y `authenticated` en cada función nueva y lo concede solo a `authenticated`. Ninguna depende de los privilegios por defecto.

### Permisos nuevos (admin y superadmin)

`admin.users.read`, `admin.modules.manage`, `admin.announcements.manage`, `admin.catalogs.manage`, `admin.orgs.manage`, `admin.metrics.read`, `admin.audit.read`.

Se mantienen los de la etapa 2: `admin.access`, `admin.users.suspend` y `admin.roles.grant`, más `admin.roles.grant_privileged` solo para superadmin. `artifacts/docente/src/core/auth/permission-matrix.json` y la función SQL deben coincidir (el harness lo comprueba).

### Códigos de error

| Código | Significado | Mensaje en la app |
|---|---|---|
| `42501` | Sin permiso, sin MFA, cuenta no activa o acción prohibida (por ejemplo, sobre el demo) | «No tienes permiso para esta acción» |
| `22023` | Parámetro inválido (página, filtro, longitud) | «Revisa los datos ingresados» |
| `P0002` | El recurso no existe o no está disponible | «No se encontró el elemento; recarga la página» |
| `23514` | Regla de negocio (estado incorrecto, organización no de prueba, módulo sin implementación…) | Mensaje específico de la acción |
| `23505` | Duplicado (ya es miembro) | Mensaje específico de la acción |

### Usuarios (`admin.users.read`; acciones de la etapa 2)

- `admin_list_users(p_query text default null, p_status text default null, p_role text default null, p_page int default 1)`
  - Devuelve: `user_id uuid, email text, display_name text, country_code text, status text, roles text[], created_at timestamptz, total_count bigint`.
  - `p_query`: se recorta; vacío o `null` = sin filtro; más de 100 caracteres → `22023`. Busca por contenido (`ILIKE`, escapando `\ % _`) en el correo de `auth.users` o en `profiles.display_name`.
  - `p_status` ∈ {`active`, `suspended`, `deletion_pending`} o `null`; `p_role` debe existir en `roles` o ser `null`. Cualquier otro valor → `22023`.
  - Orden: `created_at desc, user_id`.
  - Audita `users.searched`, con `resource_type 'user'`, `resource_id null` y `details {has_query, status, role, page}`.
- Sin cambios: `admin_set_user_status(p_user, p_status)` (`admin.users.suspend`), `admin_grant_role(p_user, p_role)` y `admin_revoke_role(p_user, p_role)` (`admin.roles.grant`). Admin no otorga ni retira `admin` ni `superadmin`.

### Módulos (`admin.modules.manage`)

- `admin_list_modules()`
  - Devuelve: `module_id text, status text, implementation_available boolean, emergency_disabled boolean, sort_order int, country_codes text[], interest_count bigint, updated_at timestamptz`.
  - Excluye `demo`. Orden: `sort_order`.
- `admin_set_module_status(p_module text, p_status text)`
  - `p_status` ∈ {`hidden`, `coming_soon`, `active`}; otro valor → `22023`.
  - `demo` → `42501`; módulo inexistente → `P0002`; `active` con `implementation_available = false` → `23514`.
  - Audita `module.status_changed`, con `details {status, previous}`.
- `admin_set_module_emergency(p_module text, p_disabled boolean)`
  - Mismas reglas para `demo` y para módulos inexistentes.
  - Audita `module.emergency_changed`, con `details {disabled}`.
- `admin_set_module_country(p_module text, p_country text, p_enabled boolean)`
  - El país debe existir y estar activo; si no, `22023`.
  - Habilitar inserta la disponibilidad sin derecho requerido (`on conflict do nothing`); deshabilitar la borra.
  - Mismas reglas para `demo` y para módulos inexistentes.
  - Audita `module.country_changed`, con `details {country, enabled}`.

### Avisos (`admin.announcements.manage`)

- `admin_list_announcements(p_status text default null, p_page int default 1)`
  - Devuelve: `id uuid, title text, status text, starts_at timestamptz, ends_at timestamptz, country_codes text[], role_codes text[], plan_codes text[], created_at timestamptz, total_count bigint`.
  - `p_status` ∈ {`draft`, `published`} o `null`. Orden: `created_at desc, id`.
- `admin_get_announcement(p_id uuid)`
  - Devuelve una fila con las columnas anteriores más `body text` y sin `total_count`.
  - Si no existe → `P0002`.
- `admin_save_announcement(p_id uuid, p_title text, p_body text, p_starts_at timestamptz, p_ends_at timestamptz, p_country_codes text[], p_role_codes text[], p_plan_codes text[]) returns uuid`
  - Con `p_id null` crea un borrador con `author_user_id = auth.uid()`. Con id, edita solo si el aviso es `draft`: si está publicado → `23514`; si no existe → `P0002`.
  - Arrays `null` = `'{}'`. `p_starts_at null` = `now()`.
  - Las restricciones de la tabla y el trigger de audiencia validan el contenido.
  - Audita `announcement.created` o `announcement.updated`, con `resource_type 'announcement'` y `details {}` (nunca el texto).
- `admin_publish_announcement(p_id uuid)`: de `draft` a `published`; si ya está publicado → `23514`. Audita `announcement.published`.
- `admin_unpublish_announcement(p_id uuid)`: de `published` a `draft`; si no está publicado → `23514`. Audita `announcement.unpublished`. No se borran avisos.

### Catálogos (`admin.catalogs.manage`)

`p_kind` ∈ {`region`, `ugel`, `level`, `grade`}; otro valor → `22023`. `region` y `ugel` usan `territory_units`; `level` y `grade`, `education_catalog`.

- `admin_list_catalog(p_kind text, p_parent uuid default null, p_query text default null, p_page int default 1)`
  - Devuelve: `id uuid, kind text, code text, name text, active boolean, parent_id uuid, parent_name text, is_synthetic boolean, source text, total_count bigint`.
  - `code` es `official_code` en territorio y `code` en educación.
  - `p_parent` filtra UGEL por región, o grados por nivel (con `education_catalog_relations`). Si se envía `p_parent` para `region` o `level` → `22023`.
  - `p_query`: igual que en usuarios, sobre `name` y `code`.
  - Orden: territorio por `name`; educación por `sort_order, name`.
  - `is_synthetic` es `false` en educación. `parent_name` es el nombre de la región, o `null`.
- `admin_rename_catalog_item(p_kind text, p_id uuid, p_name text)`
  - El nombre se recorta: 1–200 caracteres en territorio y 1–120 en educación; si no → `22023`. Elemento inexistente o de otro tipo → `P0002`.
  - Audita `catalog.renamed`, con `resource_type` `territory_unit` o `education_catalog` y `details {kind, code}`.
- `admin_set_catalog_item_active(p_kind text, p_id uuid, p_active boolean)`
  - Audita `catalog.status_changed`, con `details {kind, code, active}`.
  - Desactivar no toca perfiles existentes: `validate_profile` no exige `active`. El onboarding ya ofrece solo elementos activos.

### Organizaciones de prueba (`admin.orgs.manage`)

- `admin_list_orgs(p_status text default null, p_page int default 1)`
  - Devuelve: `id uuid, name text, country_code text, status text, is_test boolean, member_count bigint, created_at timestamptz, total_count bigint`.
  - `member_count` cuenta solo membresías `active`. Orden: `created_at desc, id`.
- `admin_get_org(p_org uuid)`
  - Devuelve una fila con las columnas de `admin_list_orgs`, sin `total_count`.
  - Si no existe → `P0002`. No se audita: no expone datos personales.
- `admin_create_test_org(p_name text, p_country text) returns uuid`
  - Nombre recortado de 1–200 caracteres; país existente y activo. Si no → `22023`.
  - `is_test = true`; el workspace institucional lo crea el trigger existente.
  - Audita `org.created`, con `resource_type 'organization'` y `details {country}`.
- `admin_set_org_status(p_org uuid, p_status text)`
  - `p_status` ∈ {`active`, `inactive`}. Organización no de prueba → `23514`; inexistente → `P0002`.
  - Audita `org.status_changed`, con `details {status}`.
- `admin_list_org_members(p_org uuid)`
  - Devuelve: `user_id uuid, email text, display_name text, role_code text, status text, created_at timestamptz, removed_at timestamptz`. Incluye las membresías retiradas.
  - Máximo 200 filas; orden: `status, created_at`. Organización inexistente → `P0002`.
  - Audita `org.members_listed`.
- `admin_add_org_member(p_org uuid, p_email text, p_role text)`
  - `p_role` ∈ {`docente`, `director`}; si no → `22023`.
  - La organización debe ser de prueba y estar activa; si no → `23514`.
  - Busca el usuario por `lower(auth.users.email) = lower(btrim(p_email))`, con `users.status = 'active'`; si no lo encuentra → `P0002`.
  - Si ya es miembro activo → `23505`. Si su membresía estaba retirada, la reactiva (`status active`, `removed_at null`, rol nuevo).
  - Audita `org.member_added`, con `details {user_id, role}`.
- `admin_remove_org_member(p_org uuid, p_user uuid)`
  - Pasa la membresía activa a `removed` con `removed_at = now()`. Sin membresía activa → `P0002`. La organización debe ser de prueba.
  - Audita `org.member_removed`, con `details {user_id}`.

### Métricas (`admin.metrics.read`)

Población: `public.users` con `is_seed = false`. Los días se calculan en `America/Lima` (zona de `PE`, el único país activo).

- `admin_metric_overview()`
  - Una fila: `total_users bigint, active_users bigint, suspended_users bigint, onboarded_users bigint`.
  - `onboarded_users` cuenta los usuarios activos con `onboarding_completed_at`.
- `admin_metric_signups(p_days int default 30)`
  - Devuelve: `day date, signups bigint`, una fila por día desde hoy − (`p_days` − 1) hasta hoy, con ceros incluidos.
  - `p_days` entre 1 y 90; si no → `22023`.
- `admin_metric_active_users()`
  - Tres filas: `window_days int` (1, 7, 30) y `active_users bigint`.
  - Cuenta usuarios distintos con algún `activity_events` en las últimas 24 horas × `window_days`.
- `admin_metric_distribution(p_dimension text)`
  - Devuelve: `item_id uuid, name text, users bigint`.
  - `p_dimension` ∈ {`region`, `level`, `grade`}; si no → `22023`.
  - Población: usuarios activos con onboarding completo.
  - `region` agrupa por `profiles.region_id` e incluye una fila con `item_id null` (sin región) cuando hay alguno. `level` y `grade` cuentan selecciones, así que un usuario puede sumar en varias filas.
  - Solo filas con `users > 0`. Orden: `users desc, name`.
- `admin_metric_module_interest()`
  - Devuelve: `module_id text, interested bigint`, con todos los módulos salvo `demo` (incluidos los ceros). Orden: `sort_order`.

La conversión no tiene función: se muestra «sin datos hasta la etapa 5».

### Auditoría (`admin.audit.read`)

- `admin_list_audit(p_action text default null, p_actor uuid default null, p_resource_type text default null, p_resource_id text default null, p_from timestamptz default null, p_to timestamptz default null, p_page int default 1)`
  - Devuelve: `id bigint, occurred_at timestamptz, actor_user_id uuid, actor_email text, actor_context text, action text, resource_type text, resource_id text, result text, details jsonb, total_count bigint`.
  - Los filtros son de igualdad exacta, salvo el rango de fechas (`p_from` ≤ `occurred_at` < `p_to`). `p_from ≥ p_to` → `22023`.
  - `actor_email` sale de `auth.users`; es `null` si la cuenta ya no existe.
  - Orden: `occurred_at desc, id desc`. No se audita (evita ruido recursivo).

Acciones conocidas, para el filtro de la interfaz:
- De la etapa 2: `user.status_changed`, `user.role_granted`, `user.role_revoked`, `user.superadmin_bootstrapped`, `account.deleted`, `account.deletion_requested`. El ingeniero las confirma en la migración de la etapa 2.
- De esta etapa: todas las listadas arriba.

### Pruebas del harness (`artifacts/docente/scripts/rls-harness.mjs`)

- **Paridad** de la matriz JSON ↔ SQL (ya existe; debe pasar con los permisos nuevos).
- **Rechazo** con `42501` en cada función nueva para:
  - anon (sin `execute`);
  - docente;
  - admin con `aal1`;
  - admin suspendido.
- Admin con `aal2` no otorga ni retira `admin` ni `superadmin` (ya existe; se mantiene).
- **Módulos:** el demo es intocable; no se activa sin implementación; cambiar país y apagado modifica lo que ve un docente en `list_my_modules`.
- **Avisos:** crear → publicar → visible para el docente → despublicar → invisible; editar un aviso publicado → `23514`.
- **Catálogos:** desactivar una región la saca de la lectura activa; renombrar se refleja.
- **Organizaciones:**
  - crear crea el workspace;
  - agregar un miembro le da `org.read` por RLS;
  - retirarlo se lo quita;
  - una organización inactiva bloquea el acceso;
  - el correo inexistente → `P0002`;
  - el duplicado → `23505`.
- **Métricas:** con un conjunto de datos conocido (usuarios con fechas, actividad, perfiles y selecciones fijados en la prueba), cada función devuelve cifras exactas esperadas, y los usuarios `is_seed` no cuentan.
- **Auditoría:** cada mutación deja exactamente un registro con la acción esperada y sin correos ni textos en `details`; `admin_list_users` audita `users.searched`.
- **Búsqueda:** `%` y `_` en `p_query` se tratan como literales.

### Correcciones de la auditoría

Hallazgos de `rls-auditor`, corregidos en la misma migración (aún no aplicada). Las funciones de la etapa 2 se reemplazan con `create or replace` y la misma firma; las migraciones de las etapas 2 y 3 no se tocan.

- **M1. Siempre queda un superadmin activo.**
  - `app_private.assert_other_active_superadmin(p_user)` toma `pg_advisory_xact_lock` y lanza `23514` si no hay otro superadmin con `users.status = 'active'`. El lock serializa las llamadas concurrentes.
  - Lo usan:
    - `admin_set_user_status`, al dejar no activo a un superadmin;
    - `admin_revoke_role`, con `superadmin`;
    - `request_account_deletion`, si quien llama es superadmin. Conserva el `23514` que la app muestra como «Eres el último superadmin…».
    - el trigger `protect_last_superadmin`, también en la eliminación en cascada.
  - `admin_grant_role` y `admin_revoke_role` rechazan `p_user = auth.uid()` con `42501`.
- **M2. Un catálogo inactivo no se puede elegir.**
  - Trigger `BEFORE INSERT OR UPDATE OF region_id, ugel_id` en `profiles`: exige `territory_units.active` solo si el valor cambia.
  - Trigger `BEFORE INSERT` en `profile_education_selections`: exige `education_catalog.active`.
  - En ambos casos el error es `23514`, el mismo que la app ya muestra como error de coherencia.
  - `save_education_selection` guarda por diferencia: borra solo lo que sale e inserta solo lo nuevo. Así, una selección antigua ya inactiva se conserva sin reinsertarse.
- **B1.** `admin_grant_role` y `admin_revoke_role` validan `p_role` contra `roles` (`22023`). `admin_revoke_role` audita solo si retiró una asignación.
- **B2.** `admin_add_org_member` rechaza agregarse a uno mismo (`42501`).
- **B3.** `admin_set_module_country` no deshabilita una disponibilidad con `required_entitlement` (`23514`); esas filas se gestionan en la etapa 5.
- **B4.** `admin_save_announcement` acepta en `p_role_codes` solo roles de plataforma asignables (`docente`, `admin`, `superadmin`); otro valor → `22023`. Un aviso para `director` no llegaría a nadie.
- **B5.** `admin_save_announcement`: título de más de 120 caracteres o texto de más de 2000, sin recortar → `22023`.
- **Sin cambio:**
  - B6: el término de búsqueda en la URL (documentado por el orquestador);
  - B7: el umbral de las métricas.

## App (`artifacts/docente/src`)

Rutas, todas bajo `/admin`, que ya está en `protectedPrefixes`:

| Ruta | Permiso | Agente |
|---|---|---|
| `/admin` | `admin.access` | orquestador (índice de secciones) |
| `/admin/usuarios` | `admin.users.read` (acciones: `admin.users.suspend`, `admin.roles.grant`) | ui-builder A |
| `/admin/modulos` | `admin.modules.manage` | ui-builder A |
| `/admin/auditoria` | `admin.audit.read` | ui-builder A |
| `/admin/avisos`, `/admin/avisos/nuevo`, `/admin/avisos/[id]` | `admin.announcements.manage` | ui-builder B |
| `/admin/catalogos` | `admin.catalogs.manage` | ui-builder B |
| `/admin/organizaciones`, `/admin/organizaciones/[id]` | `admin.orgs.manage` | ui-builder B |
| `/admin/metricas` | `admin.metrics.read` | ui-builder B |

Piezas compartidas, escritas por el orquestador antes de lanzar a los agentes. Los agentes **no** las modifican; si necesitan un cambio, lo reportan.

- `core/admin/rpc.ts` (server-only):
  - `ADMIN_PAGE_SIZE = 20`.
  - `parsePage(value)`.
  - `adminCall(permission, fn, args)`: llama a `requireAdmin(permission)` y a la RPC, y devuelve `{ ok: true, data } | { ok: false, error: AdminErrorKey }`.
  - `adminErrorMessage(key, overrides?)`.
- `components/admin/admin-shell.tsx`: encabezado y menú de las 7 secciones (filtradas por permiso; desplegable en el celular).
- `components/admin/pager.tsx`: anterior y siguiente, con «página X de Y» y los filtros conservados.
- `components/admin/confirm-form.tsx`: botón que pide confirmación (diálogo accesible) antes de enviar un Server Action con `useActionState`, y muestra el resultado.
- `components/admin/denied.tsx`: aviso de permiso insuficiente.
- `i18n/es-admin.ts`: textos comunes (menú, paginación, errores, confirmación, «ninguno»).

Convenciones para los agentes:

- Por sección:
  - `core/admin/<seccion>-queries.ts` (server-only, lecturas con `adminCall`);
  - `core/admin/<seccion>-actions.ts` (`"use server"`, validación con zod, `adminCall` y `revalidatePath`);
  - `components/admin/<seccion>/*`;
  - `i18n/es-admin-<seccion>.ts`.
- Cada página llama a `requireAdmin(<permiso>)` y muestra `denied` si no está permitido. Cada Server Action vuelve a llamar a `adminCall` con su permiso.
- Los textos de los avisos se muestran siempre como texto plano, nunca como HTML.
- En la lista de usuarios no se ofrecen acciones sobre la propia cuenta. Otorgar o retirar `admin` y `superadmin` se muestra solo con `admin.roles.grant_privileged`.
- Accesibilidad y 360 px: tablas que en el celular pasan a tarjetas o tienen desplazamiento horizontal dentro de su contenedor, nunca de la página. Los controles miden al menos 44 px.
- Pruebas unitarias (vitest) para validaciones y mapeo de errores.
