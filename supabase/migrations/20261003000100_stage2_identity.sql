-- Etapa 2: identidad, perfil, onboarding, organizaciones y RLS.
--
-- Reglas (docs/architecture/approved-scope.md, docs/runbooks/environments.md):
-- * Ninguna tabla depende de la exposición automática: se revoca todo y se concede
--   explícitamente por tabla y columna.
-- * Matriz rol→permiso versionada: debe coincidir con
--   artifacts/docente/src/core/auth/permission-matrix.json (lo comprueba el harness).
-- * Las funciones auxiliares viven en app_private, que no se expone por la Data API.

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

-- ---------------------------------------------------------------------------
-- Catálogos de referencia
-- ---------------------------------------------------------------------------

create table public.countries (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  locale text not null,
  time_zone text not null,
  active boolean not null default true,
  sandbox_provider_key text
);

insert into public.countries (code, name, currency, locale, time_zone)
values ('PE', 'Perú', 'PEN', 'es-PE', 'America/Lima');

create table public.roles (
  code text primary key check (code ~ '^[a-z_]+$'),
  platform_assignable boolean not null,
  institution_assignable boolean not null,
  -- creador y revisor existen, pero no se asignan a ningún usuario en esta fase.
  assignment_blocked boolean not null default false,
  check (platform_assignable or institution_assignable)
);

insert into public.roles (code, platform_assignable, institution_assignable, assignment_blocked) values
  ('docente', true, true, false),
  ('creador', true, false, true),
  ('director', false, true, false),
  ('revisor', true, false, true),
  ('admin', true, false, false),
  ('superadmin', true, false, false);

create table public.territory_units (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries (code),
  kind text not null check (kind in ('region', 'ugel')),
  -- Texto para conservar ceros iniciales de los códigos oficiales.
  official_code text not null check (char_length(official_code) between 1 and 20),
  name text not null check (char_length(name) between 1 and 200),
  parent_id uuid references public.territory_units (id),
  active boolean not null default true,
  -- Identificador del manifiesto de procedencia (docs/catalogs) o 'sintetico'.
  source text not null,
  is_synthetic boolean not null default false,
  unique (country_code, kind, official_code),
  check ((kind = 'region') = (parent_id is null))
);
create index territory_units_parent_idx on public.territory_units (parent_id);

create table public.education_catalog (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries (code),
  kind text not null check (kind in ('level', 'grade', 'area')),
  code text not null check (code ~ '^[a-z0-9_-]+$'),
  name text not null check (char_length(name) between 1 and 120),
  sort_order integer not null default 0,
  active boolean not null default true,
  source text not null,
  unique (country_code, kind, code)
);

create table public.education_catalog_relations (
  from_id uuid not null references public.education_catalog (id) on delete cascade,
  to_id uuid not null references public.education_catalog (id) on delete cascade,
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index education_catalog_relations_to_idx on public.education_catalog_relations (to_id);

create view public.regions with (security_invoker = true) as
  select id, country_code, official_code, name, active, is_synthetic
  from public.territory_units where kind = 'region';

create view public.ugels with (security_invoker = true) as
  select id, country_code, official_code, name, parent_id as region_id, active, is_synthetic
  from public.territory_units where kind = 'ugel';

-- ---------------------------------------------------------------------------
-- Identidad
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended', 'deletion_pending')),
  -- La eliminación borra datos e identidad Auth en una sola transacción; este estado
  -- bloquea el acceso entre la solicitud y su ejecución y permite reintentar.
  deletion_requested_at timestamptz,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'deletion_pending') = (deletion_requested_at is not null))
);

create table public.profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  display_name text check (char_length(btrim(display_name)) between 1 and 120),
  country_code text references public.countries (code),
  region_id uuid references public.territory_units (id),
  ugel_id uuid references public.territory_units (id),
  employment_status text check (employment_status in ('nombrado', 'contratado', 'otro')),
  -- IE en texto libre: no crea organización ni membresía.
  institution_name text check (char_length(institution_name) <= 200),
  -- Código modular futuro: no se importa ni valida IE en esta fase.
  future_modular_code text check (future_modular_code is null),
  onboarding_step smallint not null default 1 check (onboarding_step between 1 and 3),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_education_selections (
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  catalog_id uuid not null references public.education_catalog (id),
  created_at timestamptz not null default now(),
  primary key (user_id, catalog_id)
);

create table public.user_roles (
  user_id uuid not null references public.users (id) on delete cascade,
  role_code text not null references public.roles (code),
  -- null = asignación del sistema (rol docente al registrarse o bootstrap controlado).
  granted_by uuid,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_code),
  check (granted_by is null or granted_by <> user_id)
);

create table public.consent_records (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  document text not null check (document in ('terminos', 'privacidad')),
  version text not null check (char_length(version) between 1 and 40),
  accepted_at timestamptz not null default now()
);
create index consent_records_user_idx on public.consent_records (user_id);

-- ---------------------------------------------------------------------------
-- Organizaciones (sin interfaz de director ni invitaciones)
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  country_code text not null references public.countries (code),
  status text not null default 'active' check (status in ('active', 'inactive')),
  is_test boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('personal', 'institutional')),
  owner_user_id uuid unique references public.users (id) on delete cascade,
  organization_id uuid unique references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (
    (kind = 'personal' and owner_user_id is not null and organization_id is null)
    or (kind = 'institutional' and organization_id is not null and owner_user_id is null)
  )
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role_code text not null references public.roles (code),
  status text not null default 'active' check (status in ('active', 'removed')),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (user_id, organization_id),
  check ((status = 'removed') = (removed_at is not null))
);
create index memberships_org_idx on public.memberships (organization_id);

-- ---------------------------------------------------------------------------
-- Auditoría (append-only; escritura solo mediante funciones autorizadas)
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  actor_context text not null check (actor_context in ('user', 'admin', 'system')),
  action text not null check (action ~ '^[a-z_.]+$'),
  resource_type text not null,
  resource_id text,
  result text not null check (result in ('success', 'denied', 'error')),
  request_id text,
  -- Solo datos redactados: identificadores y códigos, nunca nombres, correos ni textos libres.
  details jsonb not null default '{}'::jsonb
);
create index audit_logs_occurred_idx on public.audit_logs (occurred_at);

-- ---------------------------------------------------------------------------
-- Matriz rol→permiso (espejo de permission-matrix.json)
-- ---------------------------------------------------------------------------

create function app_private.permission_matrix()
returns table (role_code text, permission text)
language sql immutable
set search_path = ''
as $$
  values
    ('docente', 'org.read'),
    ('director', 'org.read'),
    ('director', 'org.members.read'),
    ('admin', 'admin.access'),
    ('admin', 'admin.users.suspend'),
    ('admin', 'admin.roles.grant'),
    ('superadmin', 'admin.access'),
    ('superadmin', 'admin.users.suspend'),
    ('superadmin', 'admin.roles.grant'),
    ('superadmin', 'admin.roles.grant_privileged')
$$;

-- ---------------------------------------------------------------------------
-- Funciones auxiliares de autorización
-- ---------------------------------------------------------------------------

create function app_private.is_active_user()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.status = 'active')
$$;

create function app_private.has_platform_permission(p_permission text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app_private.is_active_user() and exists (
    select 1
    from public.user_roles ur
    join app_private.permission_matrix() m on m.role_code = ur.role_code
    where ur.user_id = auth.uid() and m.permission = p_permission
  )
$$;

create function app_private.is_mfa_session()
returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

create function app_private.is_active_member(p_org uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app_private.is_active_user() and exists (
    select 1
    from public.memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_org and m.user_id = auth.uid()
      and m.status = 'active' and o.status = 'active'
  )
$$;

create function app_private.has_org_permission(p_org uuid, p_permission text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app_private.is_active_member(p_org) and exists (
    select 1
    from public.memberships m
    join app_private.permission_matrix() pm on pm.role_code = m.role_code
    where m.organization_id = p_org and m.user_id = auth.uid()
      and m.status = 'active' and pm.permission = p_permission
  )
$$;

-- Reautenticación reciente según los métodos registrados en el JWT (amr).
create function app_private.authenticated_recently(p_window interval default interval '10 minutes')
returns boolean
language sql stable
set search_path = ''
as $$
  select exists (
    select 1
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) e
    where (e ->> 'timestamp') ~ '^[0-9]+$'
      and to_timestamp((e ->> 'timestamp')::bigint) >= now() - p_window
  )
$$;

create function app_private.audit(
  p_context text, p_action text, p_resource_type text, p_resource_id text,
  p_result text, p_details jsonb default '{}'::jsonb
)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_user_id, actor_context, action, resource_type, resource_id, result, request_id, details)
  values (
    auth.uid(), p_context, p_action, p_resource_type, p_resource_id, p_result,
    nullif(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-request-id', ''),
    p_details
  )
$$;

-- Exige admin/superadmin activo con sesión MFA (aal2) y el permiso indicado.
create function app_private.require_admin(p_permission text)
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not app_private.has_platform_permission(p_permission) then
    raise exception 'Permiso administrativo denegado' using errcode = '42501';
  end if;
  if not app_private.is_mfa_session() then
    raise exception 'Se requiere una sesión con MFA' using errcode = '42501';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Integridad
-- ---------------------------------------------------------------------------

create function app_private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger users_touch before update on public.users
  for each row execute function app_private.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function app_private.touch_updated_at();

create function app_private.check_territory_parent()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.kind = 'ugel' and not exists (
    select 1 from public.territory_units p
    where p.id = new.parent_id and p.kind = 'region' and p.country_code = new.country_code
  ) then
    raise exception 'La UGEL debe pertenecer a una región del mismo país' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger territory_units_parent before insert or update on public.territory_units
  for each row execute function app_private.check_territory_parent();

create function app_private.check_catalog_relation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1
    from public.education_catalog f
    join public.education_catalog t on t.country_code = f.country_code
    where f.id = new.from_id and t.id = new.to_id and f.kind = 'level' and t.kind in ('grade', 'area')
  ) then
    raise exception 'Relación de catálogo no permitida' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger education_catalog_relations_check before insert or update on public.education_catalog_relations
  for each row execute function app_private.check_catalog_relation();

-- Coherencia del perfil: territorio, catálogo educativo y requisitos al completar el
-- onboarding. Diferida para permitir guardar perfil y selecciones en una transacción.
create function app_private.validate_profile(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  p public.profiles;
begin
  select * into p from public.profiles where user_id = p_user;
  if not found then
    return;
  end if;

  if p.region_id is not null and not exists (
    select 1 from public.territory_units t
    where t.id = p.region_id and t.kind = 'region' and t.country_code = p.country_code
  ) then
    raise exception 'La región no corresponde al país del perfil' using errcode = '23514';
  end if;

  if p.ugel_id is not null and not exists (
    select 1 from public.territory_units t
    where t.id = p.ugel_id and t.kind = 'ugel' and t.parent_id = p.region_id
  ) then
    raise exception 'La UGEL no pertenece a la región seleccionada' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.profile_education_selections s
    join public.education_catalog c on c.id = s.catalog_id
    where s.user_id = p_user and c.country_code is distinct from p.country_code
  ) then
    raise exception 'La selección educativa no corresponde al país del perfil' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.profile_education_selections s
    join public.education_catalog c on c.id = s.catalog_id
    where s.user_id = p_user and c.kind in ('grade', 'area')
      and not exists (
        select 1
        from public.profile_education_selections ls
        join public.education_catalog_relations r on r.from_id = ls.catalog_id
        where ls.user_id = p_user and r.to_id = s.catalog_id
      )
  ) then
    raise exception 'Grado o área sin un nivel compatible seleccionado' using errcode = '23514';
  end if;

  if p.onboarding_completed_at is not null and (
    p.display_name is null or p.country_code is null or not exists (
      select 1 from public.profile_education_selections s
      join public.education_catalog c on c.id = s.catalog_id
      where s.user_id = p_user and c.kind = 'level'
    )
  ) then
    raise exception 'El onboarding requiere nombre, país y al menos un nivel' using errcode = '23514';
  end if;
end
$$;

create function app_private.validate_profile_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.validate_profile(case when tg_op = 'DELETE' then old.user_id else new.user_id end);
  return null;
end
$$;

create constraint trigger profiles_validate after insert or update on public.profiles
  deferrable initially deferred
  for each row execute function app_private.validate_profile_trigger();
create constraint trigger profile_education_selections_validate
  after insert or update or delete on public.profile_education_selections
  deferrable initially deferred
  for each row execute function app_private.validate_profile_trigger();

create function app_private.check_role_assignment()
returns trigger language plpgsql set search_path = '' as $$
declare
  r public.roles;
begin
  select * into r from public.roles where code = new.role_code;
  if r.assignment_blocked then
    raise exception 'El rol % no se asigna en esta fase', new.role_code using errcode = '23514';
  end if;
  if tg_table_name = 'user_roles' and not r.platform_assignable then
    raise exception 'El rol % no es de plataforma', new.role_code using errcode = '23514';
  end if;
  if tg_table_name = 'memberships' and not r.institution_assignable then
    raise exception 'El rol % no es institucional', new.role_code using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger user_roles_check before insert or update on public.user_roles
  for each row execute function app_private.check_role_assignment();
create trigger memberships_check before insert or update on public.memberships
  for each row execute function app_private.check_role_assignment();

-- Nunca dejar el sistema sin superadmin (incluida la eliminación en cascada).
create function app_private.protect_last_superadmin()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.role_code = 'superadmin' and (tg_op = 'DELETE' or new.role_code <> 'superadmin')
     and not exists (
       select 1 from public.user_roles
       where role_code = 'superadmin' and user_id <> old.user_id
     ) then
    raise exception 'No se puede retirar al último superadmin' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;
create trigger user_roles_last_superadmin before update or delete on public.user_roles
  for each row execute function app_private.protect_last_superadmin();

create function app_private.workspace_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.kind is distinct from old.kind
     or new.owner_user_id is distinct from old.owner_user_id
     or new.organization_id is distinct from old.organization_id then
    raise exception 'El propietario de un workspace no puede cambiar' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger workspaces_immutable before update on public.workspaces
  for each row execute function app_private.workspace_immutable();

create function app_private.append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Registro append-only' using errcode = '42501';
end
$$;
create trigger consent_records_append_only before update on public.consent_records
  for each row execute function app_private.append_only();
create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function app_private.append_only();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function app_private.append_only();

create function app_private.create_org_workspace()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.workspaces (kind, organization_id) values ('institutional', new.id);
  return new;
end
$$;
create trigger organizations_workspace after insert on public.organizations
  for each row execute function app_private.create_org_workspace();

-- Alta desde Supabase Auth: User, Profile vacío, workspace personal y rol docente.
create function app_private.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id) values (new.id) on conflict do nothing;
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  insert into public.workspaces (kind, owner_user_id) values ('personal', new.id) on conflict do nothing;
  insert into public.user_roles (user_id, role_code) values (new.id, 'docente') on conflict do nothing;
  return new;
end
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app_private.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Operaciones expuestas (RPC)
-- ---------------------------------------------------------------------------

-- Reemplaza las selecciones educativas propias y, opcionalmente, completa el onboarding,
-- en una sola transacción. Security invoker: RLS y privilegios del usuario se aplican.
create function public.save_education_selection(p_catalog_ids uuid[], p_complete boolean default false)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;
  delete from public.profile_education_selections where user_id = v_uid;
  insert into public.profile_education_selections (user_id, catalog_id)
  select v_uid, id from unnest(coalesce(p_catalog_ids, '{}')) as t (id)
  on conflict do nothing;
  if p_complete then
    update public.profiles
    set onboarding_step = 3, onboarding_completed_at = coalesce(onboarding_completed_at, now())
    where user_id = v_uid;
    if not found then
      raise exception 'Perfil no disponible' using errcode = '42501';
    end if;
  end if;
  set constraints all immediate;
end
$$;

-- Paso 1 de la eliminación: exige reautenticación reciente y bloquea el acceso.
create function public.request_account_deletion()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from public.users where id = v_uid and status <> 'deletion_pending') then
    raise exception 'Cuenta no disponible' using errcode = '42501';
  end if;
  if not app_private.authenticated_recently() then
    raise exception 'Vuelve a iniciar sesión para confirmar la eliminación' using errcode = '42501';
  end if;
  if exists (select 1 from public.user_roles where user_id = v_uid and role_code = 'superadmin')
     and not exists (select 1 from public.user_roles where role_code = 'superadmin' and user_id <> v_uid) then
    raise exception 'Designa otro superadmin antes de eliminar esta cuenta' using errcode = '23514';
  end if;
  update public.users set status = 'deletion_pending', deletion_requested_at = now() where id = v_uid;
  perform app_private.audit('user', 'account.deletion_requested', 'user', v_uid::text, 'success');
end
$$;

-- Paso 2: borra datos propios e identidad Auth en una transacción idempotente.
-- Si falla, la cuenta queda bloqueada en deletion_pending y se puede reintentar.
-- No borra organizaciones compartidas: solo retira las membresías propias.
create function public.perform_account_deletion()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Cuenta no disponible' using errcode = '42501';
  end if;
  if not exists (select 1 from public.users where id = v_uid) then
    return; -- ya eliminada: repetir no tiene efectos
  end if;
  if not exists (select 1 from public.users where id = v_uid and status = 'deletion_pending') then
    raise exception 'La eliminación no fue solicitada' using errcode = '42501';
  end if;
  perform app_private.audit('user', 'account.deleted', 'user', v_uid::text, 'success');
  delete from auth.users where id = v_uid;
end
$$;

create function public.admin_set_user_status(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_admin('admin.users.suspend');
  if p_status not in ('active', 'suspended') then
    raise exception 'Estado no permitido' using errcode = '22023';
  end if;
  if p_user = auth.uid() then
    raise exception 'No puedes cambiar tu propio estado' using errcode = '42501';
  end if;
  if exists (select 1 from public.user_roles where user_id = p_user and role_code in ('admin', 'superadmin'))
     and not app_private.has_platform_permission('admin.roles.grant_privileged') then
    raise exception 'Solo un superadmin puede cambiar el estado de un administrador' using errcode = '42501';
  end if;
  update public.users set status = p_status where id = p_user and status <> 'deletion_pending';
  if not found then
    raise exception 'Usuario no disponible' using errcode = 'P0002';
  end if;
  perform app_private.audit('admin', 'user.status_changed', 'user', p_user::text, 'success',
    jsonb_build_object('status', p_status));
end
$$;

create function public.admin_grant_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_admin('admin.roles.grant');
  if p_role in ('admin', 'superadmin') and not app_private.has_platform_permission('admin.roles.grant_privileged') then
    raise exception 'Solo un superadmin puede otorgar roles administrativos' using errcode = '42501';
  end if;
  if not exists (select 1 from public.users where id = p_user and status = 'active') then
    raise exception 'Usuario no disponible' using errcode = 'P0002';
  end if;
  insert into public.user_roles (user_id, role_code, granted_by) values (p_user, p_role, auth.uid())
  on conflict do nothing;
  perform app_private.audit('admin', 'user.role_granted', 'user', p_user::text, 'success',
    jsonb_build_object('role', p_role));
end
$$;

create function public.admin_revoke_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_admin('admin.roles.grant');
  if p_role in ('admin', 'superadmin') and not app_private.has_platform_permission('admin.roles.grant_privileged') then
    raise exception 'Solo un superadmin puede retirar roles administrativos' using errcode = '42501';
  end if;
  delete from public.user_roles where user_id = p_user and role_code = p_role;
  perform app_private.audit('admin', 'user.role_revoked', 'user', p_user::text, 'success',
    jsonb_build_object('role', p_role));
end
$$;

-- Bootstrap del primer superadmin: sin correo ni contraseña en el código. Lo ejecuta el
-- propietario en el SQL Editor del entorno con el UUID de una cuenta Auth confirmada.
create function app_private.bootstrap_superadmin(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.user_roles where role_code = 'superadmin') then
    raise exception 'Ya existe un superadmin; usa admin_grant_role' using errcode = '23514';
  end if;
  if not exists (select 1 from auth.users where id = p_user and email_confirmed_at is not null) then
    raise exception 'La cuenta Auth no existe o su correo no está confirmado' using errcode = '23514';
  end if;
  if not exists (select 1 from public.users where id = p_user and status = 'active') then
    raise exception 'Usuario no activo' using errcode = '23514';
  end if;
  insert into public.user_roles (user_id, role_code) values (p_user, 'superadmin');
  insert into public.audit_logs (actor_user_id, actor_context, action, resource_type, resource_id, result)
  values (null, 'system', 'user.superadmin_bootstrapped', 'user', p_user::text, 'success');
end
$$;

-- ---------------------------------------------------------------------------
-- Privilegios explícitos y RLS
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema app_private from public, anon, authenticated;

grant execute on function
  app_private.permission_matrix(),
  app_private.is_active_user(),
  app_private.has_platform_permission(text),
  app_private.is_mfa_session(),
  app_private.is_active_member(uuid),
  app_private.has_org_permission(uuid, text)
to authenticated;

grant execute on function
  public.save_education_selection(uuid[], boolean),
  public.request_account_deletion(),
  public.perform_account_deletion(),
  public.admin_set_user_status(uuid, text),
  public.admin_grant_role(uuid, text),
  public.admin_revoke_role(uuid, text)
to authenticated;

alter table public.countries enable row level security;
alter table public.roles enable row level security;
alter table public.territory_units enable row level security;
alter table public.education_catalog enable row level security;
alter table public.education_catalog_relations enable row level security;
alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_education_selections enable row level security;
alter table public.user_roles enable row level security;
alter table public.consent_records enable row level security;
alter table public.organizations enable row level security;
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.audit_logs enable row level security;

-- Catálogos: lectura para usuarios autenticados; sin escritura desde el cliente.
grant select on public.countries, public.roles, public.territory_units,
  public.education_catalog, public.education_catalog_relations to authenticated;
grant select on public.regions, public.ugels to authenticated;
create policy countries_read on public.countries for select to authenticated using (true);
create policy roles_read on public.roles for select to authenticated using (true);
create policy territory_units_read on public.territory_units for select to authenticated using (true);
create policy education_catalog_read on public.education_catalog for select to authenticated using (true);
create policy education_catalog_relations_read on public.education_catalog_relations for select to authenticated using (true);

-- User: solo lectura propia, incluso suspendido (para conocer su estado y ejercer derechos).
grant select on public.users to authenticated;
create policy users_read_own on public.users for select to authenticated
  using (id = auth.uid());

-- Profile: lectura y actualización propias de usuarios activos, por columnas.
grant select on public.profiles to authenticated;
grant update (display_name, country_code, region_id, ugel_id, employment_status,
  institution_name, onboarding_step, onboarding_completed_at) on public.profiles to authenticated;
create policy profiles_read_own on public.profiles for select to authenticated
  using (user_id = auth.uid() and app_private.is_active_user());
create policy profiles_update_own on public.profiles for update to authenticated
  using (user_id = auth.uid() and app_private.is_active_user())
  with check (user_id = auth.uid() and app_private.is_active_user());

grant select, insert, delete on public.profile_education_selections to authenticated;
create policy selections_read_own on public.profile_education_selections for select to authenticated
  using (user_id = auth.uid() and app_private.is_active_user());
create policy selections_insert_own on public.profile_education_selections for insert to authenticated
  with check (user_id = auth.uid() and app_private.is_active_user());
create policy selections_delete_own on public.profile_education_selections for delete to authenticated
  using (user_id = auth.uid() and app_private.is_active_user());

-- UserRole: lectura propia; asignaciones solo mediante funciones administrativas.
grant select on public.user_roles to authenticated;
create policy user_roles_read_own on public.user_roles for select to authenticated
  using (user_id = auth.uid() and app_private.is_active_user());

-- ConsentRecord: alta y lectura propias; accepted_at lo fija la base.
grant select on public.consent_records to authenticated;
grant insert (user_id, document, version) on public.consent_records to authenticated;
create policy consent_read_own on public.consent_records for select to authenticated
  using (user_id = auth.uid() and app_private.is_active_user());
create policy consent_insert_own on public.consent_records for insert to authenticated
  with check (user_id = auth.uid() and app_private.is_active_user());

-- Organización, workspace y membresía: lectura por membresía activa y permiso.
grant select on public.organizations, public.workspaces, public.memberships to authenticated;
create policy organizations_read_member on public.organizations for select to authenticated
  using (app_private.has_org_permission(id, 'org.read'));
create policy workspaces_read on public.workspaces for select to authenticated
  using (
    (kind = 'personal' and owner_user_id = auth.uid() and app_private.is_active_user())
    or (kind = 'institutional' and app_private.has_org_permission(organization_id, 'org.read'))
  );
create policy memberships_read on public.memberships for select to authenticated
  using (
    (user_id = auth.uid() and app_private.is_active_user())
    or app_private.has_org_permission(organization_id, 'org.members.read')
  );

-- audit_logs: sin privilegios para anon/authenticated (lectura administrativa en etapa 4).

-- Los objetos futuros creados por este rol no heredan privilegios para la Data API:
-- cada migración debe conceder explícitamente lo necesario.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
