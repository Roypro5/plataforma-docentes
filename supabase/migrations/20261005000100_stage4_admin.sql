-- Etapa 4: administración mínima (usuarios, módulos, avisos, catálogos, organizaciones de
-- prueba, métricas y auditoría).
--
-- Contrato: docs/architecture/etapa-4-contrato.md (plan: etapa-4-plan.md; prevalece
-- approved-scope.md). No modifica las migraciones de las etapas 2 y 3 ni crea tablas.
-- Reglas:
-- * La base decide: cada acción y consulta administrativa es una función public.admin_*
--   con security definer y search_path vacío, cuya primera instrucción es
--   app_private.require_admin(permiso) (usuario activo, permiso de la matriz y aal2).
-- * Toda mutación se audita con app_private.audit('admin', …). Los details solo llevan
--   identificadores y códigos, nunca correos, nombres ni textos. Entre las lecturas solo se
--   auditan las que exponen datos personales (búsqueda de usuarios y miembros de una
--   organización); por eso esas funciones son volátiles.
-- * Paginación fija de 20 filas con total_count (count(*) over ()); p_page empieza en 1.
-- * El módulo demo queda fuera del panel: solo lo gestionan la migración y el seed.
-- * Se revoca execute a public, anon y authenticated en cada función nueva y se concede
--   solo a authenticated: ninguna depende de los privilegios por defecto.

-- ---------------------------------------------------------------------------
-- Matriz rol→permiso (espejo de permission-matrix.json)
-- ---------------------------------------------------------------------------

create or replace function app_private.permission_matrix()
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
    ('admin', 'admin.users.read'),
    ('admin', 'admin.modules.manage'),
    ('admin', 'admin.announcements.manage'),
    ('admin', 'admin.catalogs.manage'),
    ('admin', 'admin.orgs.manage'),
    ('admin', 'admin.metrics.read'),
    ('admin', 'admin.audit.read'),
    ('superadmin', 'admin.access'),
    ('superadmin', 'admin.users.suspend'),
    ('superadmin', 'admin.roles.grant'),
    ('superadmin', 'admin.roles.grant_privileged'),
    ('superadmin', 'admin.users.read'),
    ('superadmin', 'admin.modules.manage'),
    ('superadmin', 'admin.announcements.manage'),
    ('superadmin', 'admin.catalogs.manage'),
    ('superadmin', 'admin.orgs.manage'),
    ('superadmin', 'admin.metrics.read'),
    ('superadmin', 'admin.audit.read')
$$;

-- ---------------------------------------------------------------------------
-- Auxiliares (solo los usan las funciones administrativas, que son security definer)
-- ---------------------------------------------------------------------------

-- Desplazamiento de la página fija de 20 filas. p_page empieza en 1.
create function app_private.admin_page_offset(p_page integer)
returns bigint
language plpgsql immutable
set search_path = ''
as $$
begin
  if p_page is null or p_page < 1 then
    raise exception 'Página no válida' using errcode = '22023';
  end if;
  return (p_page::bigint - 1) * 20;
end
$$;

-- Patrón ILIKE de búsqueda por contenido: se recorta; vacío o null = sin filtro (null);
-- más de 100 caracteres → 22023. \, % y _ se escapan para tratarse como literales.
create function app_private.admin_search_pattern(p_query text)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v text := btrim(p_query);
begin
  if v is null or v = '' then
    return null;
  end if;
  if char_length(v) > 100 then
    raise exception 'Búsqueda demasiado larga' using errcode = '22023';
  end if;
  return '%' || replace(replace(replace(v, '\', '\\'), '%', '\%'), '_', '\_') || '%';
end
$$;

-- ---------------------------------------------------------------------------
-- Usuarios (admin.users.read)
-- ---------------------------------------------------------------------------

-- Datos mínimos: correo, nombre, país, estado, roles y fecha de alta. Auditada.
create function public.admin_list_users(
  p_query text default null, p_status text default null, p_role text default null, p_page integer default 1
)
returns table (
  user_id uuid, email text, display_name text, country_code text, status text,
  roles text[], created_at timestamptz, total_count bigint
)
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_pattern text;
  v_offset bigint;
begin
  perform app_private.require_admin('admin.users.read');
  v_pattern := app_private.admin_search_pattern(p_query);
  v_offset := app_private.admin_page_offset(p_page);
  if p_status is not null and p_status not in ('active', 'suspended', 'deletion_pending') then
    raise exception 'Estado no válido' using errcode = '22023';
  end if;
  if p_role is not null and not exists (select 1 from public.roles r where r.code = p_role) then
    raise exception 'Rol no válido' using errcode = '22023';
  end if;

  perform app_private.audit('admin', 'users.searched', 'user', null, 'success',
    jsonb_build_object('has_query', v_pattern is not null, 'status', p_status, 'role', p_role, 'page', p_page));

  return query
  select
    u.id,
    au.email::text,
    p.display_name,
    p.country_code,
    u.status,
    coalesce(
      (select array_agg(ur.role_code order by ur.role_code) from public.user_roles ur where ur.user_id = u.id),
      '{}'::text[]
    ),
    u.created_at,
    count(*) over ()
  from public.users u
  join auth.users au on au.id = u.id
  left join public.profiles p on p.user_id = u.id
  where (
      v_pattern is null
      or au.email ilike v_pattern escape '\'
      or p.display_name ilike v_pattern escape '\'
    )
    and (p_status is null or u.status = p_status)
    and (p_role is null or exists (
      select 1 from public.user_roles ur where ur.user_id = u.id and ur.role_code = p_role
    ))
  order by u.created_at desc, u.id
  limit 20 offset v_offset;
end
$$;

-- ---------------------------------------------------------------------------
-- Módulos (admin.modules.manage). El demo queda fuera del panel.
-- ---------------------------------------------------------------------------

create function public.admin_list_modules()
returns table (
  module_id text, status text, implementation_available boolean, emergency_disabled boolean,
  sort_order integer, country_codes text[], interest_count bigint, updated_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform app_private.require_admin('admin.modules.manage');
  return query
  select
    m.id,
    m.status,
    m.implementation_available,
    m.emergency_disabled,
    m.sort_order,
    coalesce(
      (select array_agg(a.country_code order by a.country_code) from public.module_availability a where a.module_id = m.id),
      '{}'::text[]
    ),
    (select count(*) from public.module_interests i where i.module_id = m.id),
    m.updated_at
  from public.modules m
  where m.id <> 'demo'
  order by m.sort_order, m.id;
end
$$;

-- Bloquea la fila del módulo editable; demo → 42501, inexistente → P0002.
create function app_private.admin_lock_module(p_module text)
returns public.modules
language plpgsql
set search_path = ''
as $$
declare
  m public.modules;
begin
  if p_module = 'demo' then
    raise exception 'El módulo demo no se gestiona desde el panel' using errcode = '42501';
  end if;
  select * into m from public.modules where id = p_module for update;
  if not found then
    raise exception 'Módulo no encontrado' using errcode = 'P0002';
  end if;
  return m;
end
$$;

create function public.admin_set_module_status(p_module text, p_status text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  m public.modules;
begin
  perform app_private.require_admin('admin.modules.manage');
  if p_status is null or p_status not in ('hidden', 'coming_soon', 'active') then
    raise exception 'Estado no válido' using errcode = '22023';
  end if;
  m := app_private.admin_lock_module(p_module);
  if p_status = 'active' and not m.implementation_available then
    raise exception 'El módulo no tiene implementación disponible' using errcode = '23514';
  end if;
  update public.modules set status = p_status where id = m.id;
  perform app_private.audit('admin', 'module.status_changed', 'module', m.id, 'success',
    jsonb_build_object('status', p_status, 'previous', m.status));
end
$$;

create function public.admin_set_module_emergency(p_module text, p_disabled boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  m public.modules;
begin
  perform app_private.require_admin('admin.modules.manage');
  if p_disabled is null then
    raise exception 'Valor no válido' using errcode = '22023';
  end if;
  m := app_private.admin_lock_module(p_module);
  update public.modules set emergency_disabled = p_disabled where id = m.id;
  perform app_private.audit('admin', 'module.emergency_changed', 'module', m.id, 'success',
    jsonb_build_object('disabled', p_disabled));
end
$$;

-- Habilitar crea la disponibilidad sin derecho requerido; deshabilitar la borra.
create function public.admin_set_module_country(p_module text, p_country text, p_enabled boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  m public.modules;
begin
  perform app_private.require_admin('admin.modules.manage');
  if p_enabled is null
     or not exists (select 1 from public.countries c where c.code = p_country and c.active) then
    raise exception 'País no válido' using errcode = '22023';
  end if;
  m := app_private.admin_lock_module(p_module);
  if p_enabled then
    insert into public.module_availability (module_id, country_code, required_entitlement)
    values (m.id, p_country, null)
    on conflict do nothing;
  else
    -- Las filas con derecho requerido se gestionan en la etapa 5: el panel no las borra.
    if exists (
      select 1 from public.module_availability a
      where a.module_id = m.id and a.country_code = p_country and a.required_entitlement is not null
    ) then
      raise exception 'Disponibilidad con derecho requerido: no se gestiona desde el panel' using errcode = '23514';
    end if;
    delete from public.module_availability where module_id = m.id and country_code = p_country;
  end if;
  perform app_private.audit('admin', 'module.country_changed', 'module', m.id, 'success',
    jsonb_build_object('country', p_country, 'enabled', p_enabled));
end
$$;

-- ---------------------------------------------------------------------------
-- Avisos (admin.announcements.manage). No se borran: se despublican.
-- ---------------------------------------------------------------------------

create function public.admin_list_announcements(p_status text default null, p_page integer default 1)
returns table (
  id uuid, title text, status text, starts_at timestamptz, ends_at timestamptz,
  country_codes text[], role_codes text[], plan_codes text[], created_at timestamptz, total_count bigint
)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_offset bigint;
begin
  perform app_private.require_admin('admin.announcements.manage');
  v_offset := app_private.admin_page_offset(p_page);
  if p_status is not null and p_status not in ('draft', 'published') then
    raise exception 'Estado no válido' using errcode = '22023';
  end if;
  return query
  select a.id, a.title, a.status, a.starts_at, a.ends_at, a.country_codes, a.role_codes, a.plan_codes,
    a.created_at, count(*) over ()
  from public.announcements a
  where p_status is null or a.status = p_status
  order by a.created_at desc, a.id
  limit 20 offset v_offset;
end
$$;

create function public.admin_get_announcement(p_id uuid)
returns table (
  id uuid, title text, status text, starts_at timestamptz, ends_at timestamptz,
  country_codes text[], role_codes text[], plan_codes text[], created_at timestamptz, body text
)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform app_private.require_admin('admin.announcements.manage');
  return query
  select a.id, a.title, a.status, a.starts_at, a.ends_at, a.country_codes, a.role_codes, a.plan_codes,
    a.created_at, a.body
  from public.announcements a
  where a.id = p_id;
  if not found then
    raise exception 'Aviso no encontrado' using errcode = 'P0002';
  end if;
end
$$;

-- Crea (p_id null) o edita un borrador. Las restricciones de la tabla y el trigger de
-- audiencia validan el contenido. El texto nunca va a la auditoría.
create function public.admin_save_announcement(
  p_id uuid, p_title text, p_body text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_country_codes text[], p_role_codes text[], p_plan_codes text[]
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_status text;
begin
  perform app_private.require_admin('admin.announcements.manage');
  -- Longitud sin recortar: la tabla solo limita el texto recortado.
  if p_title is null or p_body is null
     or char_length(p_title) > 120 or char_length(p_body) > 2000 then
    raise exception 'Título o texto no válidos' using errcode = '22023';
  end if;
  -- La audiencia por rol solo mira user_roles: solo roles de plataforma asignables
  -- (un aviso para director no llegaría a nadie).
  if exists (
    select 1 from unnest(coalesce(p_role_codes, '{}')) as r (code)
    where r.code is null or not exists (
      select 1 from public.roles x
      where x.code = r.code and x.platform_assignable and not x.assignment_blocked
    )
  ) then
    raise exception 'Rol de audiencia no válido' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.announcements (
      title, body, status, starts_at, ends_at, author_user_id, country_codes, role_codes, plan_codes
    ) values (
      p_title, p_body, 'draft', coalesce(p_starts_at, now()), p_ends_at, auth.uid(),
      coalesce(p_country_codes, '{}'), coalesce(p_role_codes, '{}'), coalesce(p_plan_codes, '{}')
    )
    returning id into v_id;
    perform app_private.audit('admin', 'announcement.created', 'announcement', v_id::text, 'success');
    return v_id;
  end if;

  select a.status into v_status from public.announcements a where a.id = p_id for update;
  if not found then
    raise exception 'Aviso no encontrado' using errcode = 'P0002';
  end if;
  if v_status <> 'draft' then
    raise exception 'Solo se editan borradores' using errcode = '23514';
  end if;
  update public.announcements
  set title = p_title,
      body = p_body,
      starts_at = coalesce(p_starts_at, now()),
      ends_at = p_ends_at,
      country_codes = coalesce(p_country_codes, '{}'),
      role_codes = coalesce(p_role_codes, '{}'),
      plan_codes = coalesce(p_plan_codes, '{}')
  where id = p_id;
  perform app_private.audit('admin', 'announcement.updated', 'announcement', p_id::text, 'success');
  return p_id;
end
$$;

create function public.admin_publish_announcement(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  perform app_private.require_admin('admin.announcements.manage');
  select a.status into v_status from public.announcements a where a.id = p_id for update;
  if not found then
    raise exception 'Aviso no encontrado' using errcode = 'P0002';
  end if;
  if v_status <> 'draft' then
    raise exception 'El aviso ya está publicado' using errcode = '23514';
  end if;
  update public.announcements set status = 'published' where id = p_id;
  perform app_private.audit('admin', 'announcement.published', 'announcement', p_id::text, 'success');
end
$$;

create function public.admin_unpublish_announcement(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  perform app_private.require_admin('admin.announcements.manage');
  select a.status into v_status from public.announcements a where a.id = p_id for update;
  if not found then
    raise exception 'Aviso no encontrado' using errcode = 'P0002';
  end if;
  if v_status <> 'published' then
    raise exception 'El aviso no está publicado' using errcode = '23514';
  end if;
  update public.announcements set status = 'draft' where id = p_id;
  perform app_private.audit('admin', 'announcement.unpublished', 'announcement', p_id::text, 'success');
end
$$;

-- ---------------------------------------------------------------------------
-- Catálogos (admin.catalogs.manage): region y ugel en territory_units; level y grade en
-- education_catalog. Solo activar/desactivar y renombrar; sin códigos nuevos.
-- ---------------------------------------------------------------------------

create function app_private.admin_check_catalog_kind(p_kind text)
returns void
language plpgsql immutable
set search_path = ''
as $$
begin
  if p_kind is null or p_kind not in ('region', 'ugel', 'level', 'grade') then
    raise exception 'Tipo de catálogo no válido' using errcode = '22023';
  end if;
end
$$;

create function public.admin_list_catalog(
  p_kind text, p_parent uuid default null, p_query text default null, p_page integer default 1
)
returns table (
  id uuid, kind text, code text, name text, active boolean, parent_id uuid, parent_name text,
  is_synthetic boolean, source text, total_count bigint
)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_pattern text;
  v_offset bigint;
begin
  perform app_private.require_admin('admin.catalogs.manage');
  perform app_private.admin_check_catalog_kind(p_kind);
  if p_parent is not null and p_kind in ('region', 'level') then
    raise exception 'Este tipo no admite filtro por padre' using errcode = '22023';
  end if;
  v_pattern := app_private.admin_search_pattern(p_query);
  v_offset := app_private.admin_page_offset(p_page);

  if p_kind in ('region', 'ugel') then
    return query
    select t.id, t.kind, t.official_code, t.name, t.active, t.parent_id, r.name, t.is_synthetic, t.source,
      count(*) over ()
    from public.territory_units t
    left join public.territory_units r on r.id = t.parent_id
    where t.kind = p_kind
      and (p_parent is null or t.parent_id = p_parent)
      and (v_pattern is null or t.name ilike v_pattern escape '\' or t.official_code ilike v_pattern escape '\')
    order by t.name, t.id
    limit 20 offset v_offset;
  else
    return query
    select c.id, c.kind, c.code, c.name, c.active, null::uuid, null::text, false, c.source,
      count(*) over ()
    from public.education_catalog c
    where c.kind = p_kind
      and (p_parent is null or exists (
        select 1 from public.education_catalog_relations rel where rel.from_id = p_parent and rel.to_id = c.id
      ))
      and (v_pattern is null or c.name ilike v_pattern escape '\' or c.code ilike v_pattern escape '\')
    order by c.sort_order, c.name, c.id
    limit 20 offset v_offset;
  end if;
end
$$;

create function public.admin_rename_catalog_item(p_kind text, p_id uuid, p_name text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
  v_max integer;
  v_code text;
begin
  perform app_private.require_admin('admin.catalogs.manage');
  perform app_private.admin_check_catalog_kind(p_kind);
  v_max := case when p_kind in ('region', 'ugel') then 200 else 120 end;
  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > v_max then
    raise exception 'Nombre no válido' using errcode = '22023';
  end if;

  if p_kind in ('region', 'ugel') then
    update public.territory_units set name = v_name
    where id = p_id and kind = p_kind
    returning official_code into v_code;
  else
    update public.education_catalog set name = v_name
    where id = p_id and kind = p_kind
    returning code into v_code;
  end if;
  if not found then
    raise exception 'Elemento no encontrado' using errcode = 'P0002';
  end if;

  perform app_private.audit('admin', 'catalog.renamed',
    case when p_kind in ('region', 'ugel') then 'territory_unit' else 'education_catalog' end,
    p_id::text, 'success', jsonb_build_object('kind', p_kind, 'code', v_code));
end
$$;

-- Desactivar no toca perfiles existentes (validate_profile no exige active); el
-- onboarding ya ofrece solo elementos activos.
create function public.admin_set_catalog_item_active(p_kind text, p_id uuid, p_active boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  perform app_private.require_admin('admin.catalogs.manage');
  perform app_private.admin_check_catalog_kind(p_kind);
  if p_active is null then
    raise exception 'Valor no válido' using errcode = '22023';
  end if;

  if p_kind in ('region', 'ugel') then
    update public.territory_units set active = p_active
    where id = p_id and kind = p_kind
    returning official_code into v_code;
  else
    update public.education_catalog set active = p_active
    where id = p_id and kind = p_kind
    returning code into v_code;
  end if;
  if not found then
    raise exception 'Elemento no encontrado' using errcode = 'P0002';
  end if;

  perform app_private.audit('admin', 'catalog.status_changed',
    case when p_kind in ('region', 'ugel') then 'territory_unit' else 'education_catalog' end,
    p_id::text, 'success', jsonb_build_object('kind', p_kind, 'code', v_code, 'active', p_active));
end
$$;

-- ---------------------------------------------------------------------------
-- Organizaciones de prueba (admin.orgs.manage). Sin invitaciones ni interfaz de director.
-- ---------------------------------------------------------------------------

create function public.admin_list_orgs(p_status text default null, p_page integer default 1)
returns table (
  id uuid, name text, country_code text, status text, is_test boolean, member_count bigint,
  created_at timestamptz, total_count bigint
)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_offset bigint;
begin
  perform app_private.require_admin('admin.orgs.manage');
  v_offset := app_private.admin_page_offset(p_page);
  if p_status is not null and p_status not in ('active', 'inactive') then
    raise exception 'Estado no válido' using errcode = '22023';
  end if;
  return query
  select o.id, o.name, o.country_code, o.status, o.is_test,
    (select count(*) from public.memberships m where m.organization_id = o.id and m.status = 'active'),
    o.created_at, count(*) over ()
  from public.organizations o
  where p_status is null or o.status = p_status
  order by o.created_at desc, o.id
  limit 20 offset v_offset;
end
$$;

-- Una organización (cualquiera, de prueba o no). No se audita: no expone datos personales.
create function public.admin_get_org(p_org uuid)
returns table (
  id uuid, name text, country_code text, status text, is_test boolean, member_count bigint,
  created_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform app_private.require_admin('admin.orgs.manage');
  return query
  select o.id, o.name, o.country_code, o.status, o.is_test,
    (select count(*) from public.memberships m where m.organization_id = o.id and m.status = 'active'),
    o.created_at
  from public.organizations o
  where o.id = p_org;
  if not found then
    raise exception 'Organización no encontrada' using errcode = 'P0002';
  end if;
end
$$;

-- El workspace institucional lo crea el trigger organizations_workspace.
create function public.admin_create_test_org(p_name text, p_country text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
  v_id uuid;
begin
  perform app_private.require_admin('admin.orgs.manage');
  if v_name is null or char_length(v_name) not between 1 and 200 then
    raise exception 'Nombre no válido' using errcode = '22023';
  end if;
  if not exists (select 1 from public.countries c where c.code = p_country and c.active) then
    raise exception 'País no válido' using errcode = '22023';
  end if;
  insert into public.organizations (name, country_code, is_test)
  values (v_name, p_country, true)
  returning id into v_id;
  perform app_private.audit('admin', 'org.created', 'organization', v_id::text, 'success',
    jsonb_build_object('country', p_country));
  return v_id;
end
$$;

-- Bloquea una organización de prueba; inexistente → P0002, no de prueba → 23514.
create function app_private.admin_lock_test_org(p_org uuid)
returns public.organizations
language plpgsql
set search_path = ''
as $$
declare
  o public.organizations;
begin
  select * into o from public.organizations where id = p_org for update;
  if not found then
    raise exception 'Organización no encontrada' using errcode = 'P0002';
  end if;
  if not o.is_test then
    raise exception 'Solo se gestionan organizaciones de prueba' using errcode = '23514';
  end if;
  return o;
end
$$;

create function public.admin_set_org_status(p_org uuid, p_status text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  o public.organizations;
begin
  perform app_private.require_admin('admin.orgs.manage');
  if p_status is null or p_status not in ('active', 'inactive') then
    raise exception 'Estado no válido' using errcode = '22023';
  end if;
  o := app_private.admin_lock_test_org(p_org);
  update public.organizations set status = p_status where id = o.id;
  perform app_private.audit('admin', 'org.status_changed', 'organization', o.id::text, 'success',
    jsonb_build_object('status', p_status));
end
$$;

-- Incluye las membresías retiradas; máximo 200 filas. Auditada (expone correos).
create function public.admin_list_org_members(p_org uuid)
returns table (
  user_id uuid, email text, display_name text, role_code text, status text,
  created_at timestamptz, removed_at timestamptz
)
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform app_private.require_admin('admin.orgs.manage');
  if not exists (select 1 from public.organizations o where o.id = p_org) then
    raise exception 'Organización no encontrada' using errcode = 'P0002';
  end if;
  perform app_private.audit('admin', 'org.members_listed', 'organization', p_org::text, 'success');
  return query
  select m.user_id, au.email::text, p.display_name, m.role_code, m.status, m.created_at, m.removed_at
  from public.memberships m
  left join auth.users au on au.id = m.user_id
  left join public.profiles p on p.user_id = m.user_id
  where m.organization_id = p_org
  order by m.status, m.created_at, m.id
  limit 200;
end
$$;

-- Solo usuarios existentes y activos, buscados por correo exacto (sin distinguir
-- mayúsculas). Una membresía retirada se reactiva con el rol nuevo.
create function public.admin_add_org_member(p_org uuid, p_email text, p_role text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  o public.organizations;
  v_users uuid[];
  v_user uuid;
  v_status text;
begin
  perform app_private.require_admin('admin.orgs.manage');
  if p_role is null or p_role not in ('docente', 'director') then
    raise exception 'Rol no válido' using errcode = '22023';
  end if;
  o := app_private.admin_lock_test_org(p_org);
  if o.status <> 'active' then
    raise exception 'La organización no está activa' using errcode = '23514';
  end if;

  select array_agg(au.id) into v_users
  from auth.users au
  join public.users u on u.id = au.id and u.status = 'active'
  where lower(au.email) = lower(btrim(p_email));
  if coalesce(cardinality(v_users), 0) <> 1 then
    raise exception 'Usuario no encontrado' using errcode = 'P0002';
  end if;
  v_user := v_users[1];
  if v_user = auth.uid() then
    raise exception 'No puedes agregarte a ti mismo' using errcode = '42501';
  end if;

  select m.status into v_status
  from public.memberships m
  where m.organization_id = o.id and m.user_id = v_user
  for update;
  if v_status = 'active' then
    raise exception 'Ya es miembro' using errcode = '23505';
  elsif v_status = 'removed' then
    update public.memberships
    set status = 'active', removed_at = null, role_code = p_role
    where organization_id = o.id and user_id = v_user;
  else
    insert into public.memberships (user_id, organization_id, role_code)
    values (v_user, o.id, p_role);
  end if;

  perform app_private.audit('admin', 'org.member_added', 'organization', o.id::text, 'success',
    jsonb_build_object('user_id', v_user, 'role', p_role));
end
$$;

create function public.admin_remove_org_member(p_org uuid, p_user uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  o public.organizations;
begin
  perform app_private.require_admin('admin.orgs.manage');
  o := app_private.admin_lock_test_org(p_org);
  update public.memberships
  set status = 'removed', removed_at = now()
  where organization_id = o.id and user_id = p_user and status = 'active';
  if not found then
    raise exception 'Membresía activa no encontrada' using errcode = 'P0002';
  end if;
  perform app_private.audit('admin', 'org.member_removed', 'organization', o.id::text, 'success',
    jsonb_build_object('user_id', p_user));
end
$$;

-- ---------------------------------------------------------------------------
-- Métricas (admin.metrics.read). Funciones, no vistas. Población: public.users con
-- is_seed = false. Días en America/Lima (zona de PE, el único país activo).
-- ---------------------------------------------------------------------------

create function public.admin_metric_overview()
returns table (total_users bigint, active_users bigint, suspended_users bigint, onboarded_users bigint)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform app_private.require_admin('admin.metrics.read');
  return query
  select
    count(*),
    count(*) filter (where u.status = 'active'),
    count(*) filter (where u.status = 'suspended'),
    count(*) filter (where u.status = 'active' and p.onboarding_completed_at is not null)
  from public.users u
  left join public.profiles p on p.user_id = u.id
  where not u.is_seed;
end
$$;

-- Una fila por día, de hoy − (p_days − 1) a hoy, con ceros incluidos.
create function public.admin_metric_signups(p_days integer default 30)
returns table (day date, signups bigint)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_today date;
begin
  perform app_private.require_admin('admin.metrics.read');
  if p_days is null or p_days < 1 or p_days > 90 then
    raise exception 'Rango de días no válido' using errcode = '22023';
  end if;
  v_today := (now() at time zone 'America/Lima')::date;
  return query
  select d.day, count(u.id)
  from (select v_today - g as day from generate_series(p_days - 1, 0, -1) as g) d
  left join public.users u
    on not u.is_seed and (u.created_at at time zone 'America/Lima')::date = d.day
  group by d.day
  order by d.day;
end
$$;

-- Usuarios distintos con actividad en las últimas 24 horas × window_days.
create function public.admin_metric_active_users()
returns table (window_days integer, active_users bigint)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform app_private.require_admin('admin.metrics.read');
  return query
  select w.n, (
    select count(distinct e.user_id)
    from public.activity_events e
    join public.users u on u.id = e.user_id and not u.is_seed
    where e.created_at >= now() - interval '24 hours' * w.n
  )
  from (values (1), (7), (30)) as w (n)
  order by w.n;
end
$$;

-- Población: usuarios activos con onboarding completo. region incluye una fila sin
-- región (item_id null); level y grade cuentan selecciones.
create function public.admin_metric_distribution(p_dimension text)
returns table (item_id uuid, name text, users bigint)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform app_private.require_admin('admin.metrics.read');
  if p_dimension is null or p_dimension not in ('region', 'level', 'grade') then
    raise exception 'Dimensión no válida' using errcode = '22023';
  end if;

  if p_dimension = 'region' then
    return query
    select t.id, t.name, count(*)
    from public.users u
    join public.profiles p on p.user_id = u.id
    left join public.territory_units t on t.id = p.region_id
    where not u.is_seed and u.status = 'active' and p.onboarding_completed_at is not null
    group by t.id, t.name
    order by 3 desc, 2, 1;
  else
    return query
    select c.id, c.name, count(*)
    from public.users u
    join public.profiles p on p.user_id = u.id
    join public.profile_education_selections s on s.user_id = u.id
    join public.education_catalog c on c.id = s.catalog_id and c.kind = p_dimension
    where not u.is_seed and u.status = 'active' and p.onboarding_completed_at is not null
    group by c.id, c.name
    order by 3 desc, 2, 1;
  end if;
end
$$;

create function public.admin_metric_module_interest()
returns table (module_id text, interested bigint)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform app_private.require_admin('admin.metrics.read');
  return query
  select m.id, (
    select count(*)
    from public.module_interests i
    join public.users u on u.id = i.user_id and not u.is_seed
    where i.module_id = m.id
  )
  from public.modules m
  where m.id <> 'demo'
  order by m.sort_order, m.id;
end
$$;

-- ---------------------------------------------------------------------------
-- Auditoría (admin.audit.read). No se audita a sí misma (evita ruido recursivo).
-- ---------------------------------------------------------------------------

create function public.admin_list_audit(
  p_action text default null, p_actor uuid default null, p_resource_type text default null,
  p_resource_id text default null, p_from timestamptz default null, p_to timestamptz default null,
  p_page integer default 1
)
returns table (
  id bigint, occurred_at timestamptz, actor_user_id uuid, actor_email text, actor_context text,
  action text, resource_type text, resource_id text, result text, details jsonb, total_count bigint
)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_offset bigint;
begin
  perform app_private.require_admin('admin.audit.read');
  v_offset := app_private.admin_page_offset(p_page);
  if p_from is not null and p_to is not null and p_from >= p_to then
    raise exception 'Rango de fechas no válido' using errcode = '22023';
  end if;
  return query
  select a.id, a.occurred_at, a.actor_user_id, au.email::text, a.actor_context, a.action,
    a.resource_type, a.resource_id, a.result, a.details, count(*) over ()
  from public.audit_logs a
  left join auth.users au on au.id = a.actor_user_id
  where (p_action is null or a.action = p_action)
    and (p_actor is null or a.actor_user_id = p_actor)
    and (p_resource_type is null or a.resource_type = p_resource_type)
    and (p_resource_id is null or a.resource_id = p_resource_id)
    and (p_from is null or a.occurred_at >= p_from)
    and (p_to is null or a.occurred_at < p_to)
  order by a.occurred_at desc, a.id desc
  limit 20 offset v_offset;
end
$$;

-- ---------------------------------------------------------------------------
-- Correcciones de la auditoría de seguridad sobre funciones de la etapa 2
-- (create or replace: misma firma, se conservan propietario y privilegios)
-- ---------------------------------------------------------------------------

-- M1. Siempre debe quedar otro superadmin ACTIVO (no basta con que exista). El lock
-- transaccional serializa las comprobaciones concurrentes: la consulta posterior al lock
-- ve lo que confirmó la transacción anterior, así que dos superadmins no pueden
-- suspenderse el uno al otro a la vez.
create function app_private.assert_other_active_superadmin(p_user uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('app_private.assert_other_active_superadmin', 0));
  if not exists (
    select 1
    from public.user_roles ur
    join public.users u on u.id = ur.user_id
    where ur.role_code = 'superadmin' and u.status = 'active' and ur.user_id is distinct from p_user
  ) then
    raise exception 'Debe quedar otro superadmin activo' using errcode = '23514';
  end if;
end
$$;

-- Respaldo a nivel de tabla (incluida la eliminación en cascada de la cuenta).
create or replace function app_private.protect_last_superadmin()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.role_code = 'superadmin'
     and (tg_op = 'DELETE' or new.role_code <> 'superadmin' or new.user_id <> old.user_id) then
    perform app_private.assert_other_active_superadmin(old.user_id);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

-- Igual que en la etapa 2, salvo la comprobación de superadmin activo (mismo código 23514,
-- que la app muestra como «Eres el último superadmin…»).
create or replace function public.request_account_deletion()
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
  if exists (select 1 from public.user_roles where user_id = v_uid and role_code = 'superadmin') then
    perform app_private.assert_other_active_superadmin(v_uid);
  end if;
  update public.users set status = 'deletion_pending', deletion_requested_at = now() where id = v_uid;
  perform app_private.audit('user', 'account.deletion_requested', 'user', v_uid::text, 'success');
end
$$;

create or replace function public.admin_set_user_status(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_admin('admin.users.suspend');
  if p_status is null or p_status not in ('active', 'suspended') then
    raise exception 'Estado no permitido' using errcode = '22023';
  end if;
  if p_user = auth.uid() then
    raise exception 'No puedes cambiar tu propio estado' using errcode = '42501';
  end if;
  if exists (select 1 from public.user_roles where user_id = p_user and role_code in ('admin', 'superadmin'))
     and not app_private.has_platform_permission('admin.roles.grant_privileged') then
    raise exception 'Solo un superadmin puede cambiar el estado de un administrador' using errcode = '42501';
  end if;
  if p_status <> 'active'
     and exists (select 1 from public.user_roles where user_id = p_user and role_code = 'superadmin') then
    perform app_private.assert_other_active_superadmin(p_user);
  end if;
  update public.users set status = p_status where id = p_user and status <> 'deletion_pending';
  if not found then
    raise exception 'Usuario no disponible' using errcode = 'P0002';
  end if;
  perform app_private.audit('admin', 'user.status_changed', 'user', p_user::text, 'success',
    jsonb_build_object('status', p_status));
end
$$;

-- M1/B1. Sin autoasignación, rol existente (22023) y auditoría como en la etapa 2.
create or replace function public.admin_grant_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_admin('admin.roles.grant');
  if p_user = auth.uid() then
    raise exception 'No puedes cambiar tus propios roles' using errcode = '42501';
  end if;
  if p_role is null or not exists (select 1 from public.roles r where r.code = p_role) then
    raise exception 'Rol no válido' using errcode = '22023';
  end if;
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

-- M1/B1. Sin autorretiro, rol existente (22023), superadmin activo garantizado y
-- auditoría solo si se retiró una asignación.
create or replace function public.admin_revoke_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_admin('admin.roles.grant');
  if p_user = auth.uid() then
    raise exception 'No puedes cambiar tus propios roles' using errcode = '42501';
  end if;
  if p_role is null or not exists (select 1 from public.roles r where r.code = p_role) then
    raise exception 'Rol no válido' using errcode = '22023';
  end if;
  if p_role in ('admin', 'superadmin') and not app_private.has_platform_permission('admin.roles.grant_privileged') then
    raise exception 'Solo un superadmin puede retirar roles administrativos' using errcode = '42501';
  end if;
  if p_role = 'superadmin' then
    perform app_private.assert_other_active_superadmin(p_user);
  end if;
  delete from public.user_roles where user_id = p_user and role_code = p_role;
  if found then
    perform app_private.audit('admin', 'user.role_revoked', 'user', p_user::text, 'success',
      jsonb_build_object('role', p_role));
  end if;
end
$$;

-- M2. Un elemento de catálogo inactivo no se puede elegir. Solo se exige al cambiar el
-- valor: los perfiles existentes conservan lo que ya tenían.
create function app_private.check_profile_territory_active()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.region_id is not null
     and (tg_op = 'INSERT' or new.region_id is distinct from old.region_id)
     and not exists (select 1 from public.territory_units t where t.id = new.region_id and t.active) then
    raise exception 'La región no está disponible' using errcode = '23514';
  end if;
  if new.ugel_id is not null
     and (tg_op = 'INSERT' or new.ugel_id is distinct from old.ugel_id)
     and not exists (select 1 from public.territory_units t where t.id = new.ugel_id and t.active) then
    raise exception 'La UGEL no está disponible' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger profiles_territory_active before insert or update of region_id, ugel_id on public.profiles
  for each row execute function app_private.check_profile_territory_active();

create function app_private.check_selection_active()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.education_catalog c where c.id = new.catalog_id and c.active) then
    raise exception 'El elemento del catálogo no está disponible' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger profile_education_selections_active before insert on public.profile_education_selections
  for each row execute function app_private.check_selection_active();

-- M2. Igual que en la etapa 2, pero por diferencia: borra solo lo que ya no está e inserta
-- solo lo nuevo, así una selección antigua ya inactiva se conserva sin reinsertarse (el
-- trigger BEFORE INSERT se dispara antes de ON CONFLICT, por eso se filtran las existentes).
create or replace function public.save_education_selection(p_catalog_ids uuid[], p_complete boolean default false)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[] := coalesce(p_catalog_ids, '{}');
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;
  delete from public.profile_education_selections s
  where s.user_id = v_uid and not (s.catalog_id = any (array_remove(v_ids, null)));
  insert into public.profile_education_selections (user_id, catalog_id)
  select distinct v_uid, t.id
  from unnest(v_ids) as t (id)
  where not exists (
    select 1 from public.profile_education_selections s where s.user_id = v_uid and s.catalog_id = t.id
  )
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

-- ---------------------------------------------------------------------------
-- Privilegios explícitos
-- ---------------------------------------------------------------------------

-- Auxiliares: solo las invocan las funciones administrativas (security definer, como
-- propietario), así que nadie más necesita execute.
revoke all on function
  app_private.admin_page_offset(integer),
  app_private.admin_search_pattern(text),
  app_private.admin_lock_module(text),
  app_private.admin_check_catalog_kind(text),
  app_private.admin_lock_test_org(uuid),
  app_private.assert_other_active_superadmin(uuid)
from public, anon, authenticated;

-- Funciones de trigger nuevas: no se invocan directamente.
revoke all on function
  app_private.check_profile_territory_active(),
  app_private.check_selection_active()
from public, anon, authenticated;

revoke all on function
  public.admin_list_users(text, text, text, integer),
  public.admin_list_modules(),
  public.admin_set_module_status(text, text),
  public.admin_set_module_emergency(text, boolean),
  public.admin_set_module_country(text, text, boolean),
  public.admin_list_announcements(text, integer),
  public.admin_get_announcement(uuid),
  public.admin_save_announcement(uuid, text, text, timestamptz, timestamptz, text[], text[], text[]),
  public.admin_publish_announcement(uuid),
  public.admin_unpublish_announcement(uuid),
  public.admin_list_catalog(text, uuid, text, integer),
  public.admin_rename_catalog_item(text, uuid, text),
  public.admin_set_catalog_item_active(text, uuid, boolean),
  public.admin_list_orgs(text, integer),
  public.admin_get_org(uuid),
  public.admin_create_test_org(text, text),
  public.admin_set_org_status(uuid, text),
  public.admin_list_org_members(uuid),
  public.admin_add_org_member(uuid, text, text),
  public.admin_remove_org_member(uuid, uuid),
  public.admin_metric_overview(),
  public.admin_metric_signups(integer),
  public.admin_metric_active_users(),
  public.admin_metric_distribution(text),
  public.admin_metric_module_interest(),
  public.admin_list_audit(text, uuid, text, text, timestamptz, timestamptz, integer)
from public, anon, authenticated;

grant execute on function
  public.admin_list_users(text, text, text, integer),
  public.admin_list_modules(),
  public.admin_set_module_status(text, text),
  public.admin_set_module_emergency(text, boolean),
  public.admin_set_module_country(text, text, boolean),
  public.admin_list_announcements(text, integer),
  public.admin_get_announcement(uuid),
  public.admin_save_announcement(uuid, text, text, timestamptz, timestamptz, text[], text[], text[]),
  public.admin_publish_announcement(uuid),
  public.admin_unpublish_announcement(uuid),
  public.admin_list_catalog(text, uuid, text, integer),
  public.admin_rename_catalog_item(text, uuid, text),
  public.admin_set_catalog_item_active(text, uuid, boolean),
  public.admin_list_orgs(text, integer),
  public.admin_get_org(uuid),
  public.admin_create_test_org(text, text),
  public.admin_set_org_status(uuid, text),
  public.admin_list_org_members(uuid),
  public.admin_add_org_member(uuid, text, text),
  public.admin_remove_org_member(uuid, uuid),
  public.admin_metric_overview(),
  public.admin_metric_signups(integer),
  public.admin_metric_active_users(),
  public.admin_metric_distribution(text),
  public.admin_metric_module_interest(),
  public.admin_list_audit(text, uuid, text, text, timestamptz, timestamptz, integer)
to authenticated;
