-- Etapa 3: registro de módulos, interés («Avísame»), avisos, notificaciones in-app y
-- actividad mínima.
--
-- Contrato: docs/architecture/etapa-3-contrato.md (plan: etapa-3-plan.md; prevalece
-- approved-scope.md). No modifica la migración de la etapa 2.
-- Reglas:
-- * El estado de cada módulo lo decide solo app_private.module_access; la app lee el
--   resultado (list_my_modules) y únicamente añade la regla de entorno (demo fuera de producción).
-- * Ninguna tabla depende de la exposición automática: se revoca todo y se concede
--   explícitamente lo mínimo. Escrituras del cliente solo donde el contrato lo prevé.
-- * Funciones auxiliares en app_private con security definer y search_path vacío.

-- ---------------------------------------------------------------------------
-- Registro de módulos y disponibilidad
-- ---------------------------------------------------------------------------

-- Los textos visibles (nombre, descripción, icono) viven en el código: manifiestos + i18n.
create table public.modules (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  status text not null check (status in ('hidden', 'coming_soon', 'active')),
  implementation_available boolean not null default false,
  -- Único flag permitido: apagado global por módulo (sin flags por usuario ni prioridades).
  emergency_disabled boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger modules_touch before update on public.modules
  for each row execute function app_private.touch_updated_at();

-- Derechos (entitlements). Planes, derechos por plan y suscripciones llegan en la etapa 5.
create table public.entitlements (
  code text primary key check (code ~ '^[a-z0-9_.-]+$'),
  value_type text not null check (value_type in ('boolean'))
);

create table public.module_availability (
  module_id text not null references public.modules (id) on delete cascade,
  country_code text not null references public.countries (code),
  required_entitlement text references public.entitlements (code),
  primary key (module_id, country_code)
);

insert into public.modules (id, status, implementation_available, sort_order) values
  ('generador-ia', 'coming_soon', false, 10),
  ('biblioteca', 'coming_soon', false, 20),
  ('marketplace', 'coming_soon', false, 30),
  ('cursos-simulacros', 'coming_soon', false, 40),
  -- Demo: solo dev y staging. Su disponibilidad (con demo.access) la añade el seed; sin
  -- fila de disponibilidad el resolvedor lo oculta, y la app lo oculta en producción.
  ('demo', 'active', true, 50);

insert into public.entitlements (code, value_type) values ('demo.access', 'boolean');

insert into public.module_availability (module_id, country_code, required_entitlement) values
  ('generador-ia', 'PE', null),
  ('biblioteca', 'PE', null),
  ('marketplace', 'PE', null),
  ('cursos-simulacros', 'PE', null);

-- ---------------------------------------------------------------------------
-- Interés («Avísame»), notificaciones y actividad
-- ---------------------------------------------------------------------------

create table public.module_interests (
  user_id uuid not null references public.users (id) on delete cascade,
  module_id text not null references public.modules (id) on delete cascade,
  -- País del perfil al registrarse; lo fija el trigger, nunca el cliente.
  country_code text not null references public.countries (code),
  created_at timestamptz not null default now(),
  primary key (user_id, module_id)
);
create index module_interests_module_idx on public.module_interests (module_id);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  -- Texto plano: sin caracteres de control (el título en una sola línea). La app lo
  -- muestra siempre como texto, nunca como HTML.
  title text not null check (
    char_length(btrim(title)) between 1 and 120 and title !~ '[\x01-\x1F\x7F]'
  ),
  body text not null check (
    char_length(btrim(body)) between 1 and 2000 and body !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]'
  ),
  status text not null default 'draft' check (status in ('draft', 'published')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  author_user_id uuid references public.users (id) on delete set null,
  -- Audiencia: lista vacía = todos; AND entre dimensiones (sin AnnouncementAudience).
  country_codes text[] not null default '{}',
  role_codes text[] not null default '{}',
  plan_codes text[] not null default '{}'
    check (plan_codes <@ array['gratis', 'individual', 'institucional']::text[]),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index announcements_published_idx on public.announcements (starts_at) where status = 'published';

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null check (kind in ('welcome', 'module_available')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  -- Enlace interno: ruta relativa; se rechaza '//' para impedir URLs relativas al protocolo.
  link_path text not null check (link_path ~ '^/[a-z0-9/_-]*$' and position('//' in link_path) = 0),
  read_at timestamptz,
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

-- Actividad mínima autenticada (métricas en la etapa 4). Sin acceso del cliente.
create table public.activity_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null check (kind in (
    'session.started', 'onboarding.completed', 'module.interest_added', 'module.interest_removed'
  )),
  module_id text references public.modules (id),
  created_at timestamptz not null default now(),
  check ((module_id is not null) = (kind in ('module.interest_added', 'module.interest_removed')))
);
create index activity_events_user_idx on public.activity_events (user_id);

-- ---------------------------------------------------------------------------
-- Funciones auxiliares
-- ---------------------------------------------------------------------------

-- Siempre false hasta la etapa 5: aún no existen planes ni suscripciones, así que ningún
-- derecho está vigente. Un módulo que requiere derecho queda bloqueado, nunca abierto.
create function app_private.has_entitlement(p_code text)
returns boolean
language sql stable
set search_path = ''
as $$
  select false
$$;

-- 'gratis' hasta la etapa 5: gratis es la ausencia de suscripción vigente.
create function app_private.current_plan_code()
returns text
language sql stable
set search_path = ''
as $$
  select 'gratis'::text
$$;

-- Resolvedor único del estado de un módulo para el usuario actual.
-- Devuelve: hidden | disabled | coming_soon | requires_entitlement | available.
create function app_private.module_access(p_module text)
returns text
language plpgsql stable security definer
set search_path = ''
as $$
declare
  m public.modules;
  v_country text;
  v_required text;
begin
  -- 1. Usuario no activo (sin sesión, suspendido o con eliminación pendiente).
  if not app_private.is_active_user() then
    return 'hidden';
  end if;

  -- 2. Módulo inexistente u oculto.
  select * into m from public.modules where id = p_module;
  if not found or m.status = 'hidden' then
    return 'hidden';
  end if;

  -- 3. Sin disponibilidad para el país del perfil (país nulo incluido).
  select p.country_code into v_country from public.profiles p where p.user_id = auth.uid();
  select a.required_entitlement into v_required
  from public.module_availability a
  where a.module_id = p_module and a.country_code = v_country;
  if not found then
    return 'hidden';
  end if;

  -- 4. Apagado de emergencia.
  if m.emergency_disabled then
    return 'disabled';
  end if;

  -- 5. Próximamente.
  if m.status = 'coming_soon' then
    return 'coming_soon';
  end if;

  -- 6. Derecho requerido y no vigente.
  if v_required is not null and not app_private.has_entitlement(v_required) then
    return 'requires_entitlement';
  end if;

  -- 7. Activo pero sin implementación.
  if not m.implementation_available then
    return 'coming_soon';
  end if;

  -- 8. Disponible.
  return 'available';
end
$$;

-- Audiencia de un aviso para el usuario actual: país del perfil, roles de plataforma y plan.
create function app_private.announcement_audience_matches(
  p_country_codes text[], p_role_codes text[], p_plan_codes text[]
)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app_private.is_active_user()
    and (
      cardinality(p_country_codes) = 0
      or exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid() and p.country_code = any (p_country_codes)
      )
    )
    and (
      cardinality(p_role_codes) = 0
      or exists (
        select 1 from public.user_roles ur
        where ur.user_id = auth.uid() and ur.role_code = any (p_role_codes)
      )
    )
    and (
      cardinality(p_plan_codes) = 0
      or app_private.current_plan_code() = any (p_plan_codes)
    )
$$;

-- Inserción de actividad: solo desde funciones y triggers autorizados. Se descarta un
-- evento igual (usuario, tipo y módulo) dentro de la ventana, para que repetir una RPC en
-- bucle no haga crecer la tabla sin límite ni contamine las métricas: 30 minutos para
-- sesiones y 24 horas para intereses.
create function app_private.record_activity(p_user uuid, p_kind text, p_module text default null)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.activity_events (user_id, kind, module_id)
  select p_user, p_kind, p_module
  where not exists (
    select 1 from public.activity_events e
    where e.user_id = p_user and e.kind = p_kind and e.module_id is not distinct from p_module
      and e.created_at > now() - case when p_kind = 'session.started' then interval '30 minutes' else interval '24 hours' end
  )
$$;

-- ---------------------------------------------------------------------------
-- Integridad y eventos
-- ---------------------------------------------------------------------------

-- El país del interés se copia del perfil; se ignora cualquier valor enviado.
create function app_private.set_interest_country()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.country_code := (select p.country_code from public.profiles p where p.user_id = new.user_id);
  return new;
end
$$;
create trigger module_interests_country before insert or update on public.module_interests
  for each row execute function app_private.set_interest_country();

-- Países y roles de la audiencia deben existir (los planes se validan con un check).
create function app_private.check_announcement_audience()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from unnest(new.country_codes) c
    where c is null or not exists (select 1 from public.countries x where x.code = c)
  ) then
    raise exception 'País de audiencia no válido' using errcode = '23514';
  end if;
  if exists (
    select 1 from unnest(new.role_codes) r
    where r is null or not exists (select 1 from public.roles x where x.code = r)
  ) then
    raise exception 'Rol de audiencia no válido' using errcode = '23514';
  end if;
  if array_position(new.plan_codes, null) is not null then
    raise exception 'Plan de audiencia no válido' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger announcements_audience before insert or update on public.announcements
  for each row execute function app_private.check_announcement_audience();

-- Onboarding completado: notificación de bienvenida (deduplicada) y actividad, una vez.
create function app_private.on_onboarding_completed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, kind, title, body, link_path, dedupe_key)
  values (
    new.user_id, 'welcome', 'Te damos la bienvenida',
    'Tu perfil docente está listo. Desde el panel puedes ver los módulos que estamos preparando.',
    '/panel', 'welcome'
  )
  on conflict (user_id, dedupe_key) do nothing;
  if found then
    perform app_private.record_activity(new.user_id, 'onboarding.completed');
  end if;
  return null;
end
$$;
create trigger profiles_onboarding_completed after update of onboarding_completed_at on public.profiles
  for each row
  when (old.onboarding_completed_at is null and new.onboarding_completed_at is not null)
  execute function app_private.on_onboarding_completed();

-- Módulo que pasa a utilizable (activo, implementado y sin apagado): aviso in-app
-- deduplicado solo a los interesados para quienes de verdad queda disponible: usuario
-- activo, disponibilidad en el país de su perfil y sin derecho requerido (hasta la etapa 5
-- ningún derecho está vigente). Así nunca se anuncia algo que el resolvedor bloquearía.
create function app_private.on_module_activated()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, kind, title, body, link_path, dedupe_key)
  select i.user_id, 'module_available', 'Módulo disponible',
    'Un módulo por el que pediste aviso ya está disponible.',
    '/modulos/' || new.id, 'module_available:' || new.id
  from public.module_interests i
  join public.users u on u.id = i.user_id and u.status = 'active'
  join public.profiles p on p.user_id = i.user_id
  join public.module_availability a
    on a.module_id = new.id and a.country_code = p.country_code and a.required_entitlement is null
  where i.module_id = new.id
  on conflict (user_id, dedupe_key) do nothing;
  return null;
end
$$;
create trigger modules_activated
  after update of status, implementation_available, emergency_disabled on public.modules
  for each row
  when (
    new.status = 'active' and new.implementation_available and not new.emergency_disabled
    and not (old.status = 'active' and old.implementation_available and not old.emergency_disabled)
  )
  execute function app_private.on_module_activated();

-- Etapa 2: ConsentRecord admitía inserciones repetidas de la misma versión. Se rechazan
-- duplicados (usuario, documento, versión) sin tocar registros existentes (append-only).
create function app_private.reject_duplicate_consent()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.consent_records c
    where c.user_id = new.user_id and c.document = new.document and c.version = new.version
  ) then
    raise exception 'Esa versión ya fue aceptada' using errcode = '23505';
  end if;
  return new;
end
$$;
create trigger consent_records_no_duplicates before insert on public.consent_records
  for each row execute function app_private.reject_duplicate_consent();

-- ---------------------------------------------------------------------------
-- Operaciones expuestas (RPC)
-- ---------------------------------------------------------------------------

-- Módulos visibles para el usuario actual (excluye 'hidden'). Security invoker.
create function public.list_my_modules()
returns table (module_id text, access text, sort_order integer, interested boolean)
language sql stable security invoker set search_path = '' as $$
  select x.module_id, x.access, x.sort_order, x.interested
  from (
    select
      m.id as module_id,
      app_private.module_access(m.id) as access,
      m.sort_order,
      exists (
        select 1 from public.module_interests i
        where i.user_id = auth.uid() and i.module_id = m.id
      ) as interested
    from public.modules m
  ) x
  where x.access <> 'hidden'
  order by x.sort_order, x.module_id
$$;

-- «Avísame»: solo para módulos en 'coming_soon' para el usuario; idempotente.
create function public.register_module_interest(p_module text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_rows integer;
begin
  if v_uid is null or app_private.module_access(p_module) <> 'coming_soon' then
    raise exception 'Este módulo no admite avisos' using errcode = '42501';
  end if;
  insert into public.module_interests (user_id, module_id) values (v_uid, p_module)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    perform app_private.record_activity(v_uid, 'module.interest_added', p_module);
  end if;
end
$$;

-- Retira el interés propio; idempotente.
create function public.withdraw_module_interest(p_module text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not app_private.is_active_user() then
    raise exception 'Cuenta no disponible' using errcode = '42501';
  end if;
  delete from public.module_interests where user_id = v_uid and module_id = p_module;
  if found then
    perform app_private.record_activity(v_uid, 'module.interest_removed', p_module);
  end if;
end
$$;

-- Marca como leídas las notificaciones propias indicadas; null = todas las propias.
create function public.mark_notifications_read(p_ids uuid[] default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not app_private.is_active_user() then
    raise exception 'Cuenta no disponible' using errcode = '42501';
  end if;
  update public.notifications
  set read_at = now()
  where user_id = v_uid and read_at is null and (p_ids is null or id = any (p_ids));
end
$$;

-- Registra el inicio de sesión del usuario activo.
create function public.record_session_started()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not app_private.is_active_user() then
    raise exception 'Cuenta no disponible' using errcode = '42501';
  end if;
  perform app_private.record_activity(v_uid, 'session.started');
end
$$;

-- ---------------------------------------------------------------------------
-- Privilegios explícitos y RLS
-- ---------------------------------------------------------------------------

revoke all on public.modules, public.entitlements, public.module_availability,
  public.module_interests, public.announcements, public.notifications, public.activity_events
  from anon, authenticated;
revoke all on sequence public.activity_events_id_seq from anon, authenticated;

revoke all on function
  app_private.has_entitlement(text),
  app_private.current_plan_code(),
  app_private.module_access(text),
  app_private.announcement_audience_matches(text[], text[], text[]),
  app_private.record_activity(uuid, text, text),
  app_private.set_interest_country(),
  app_private.check_announcement_audience(),
  app_private.on_onboarding_completed(),
  app_private.on_module_activated(),
  public.list_my_modules(),
  public.register_module_interest(text),
  public.withdraw_module_interest(text),
  public.mark_notifications_read(uuid[]),
  public.record_session_started()
from public, anon, authenticated;

-- Auxiliares que evalúan las políticas RLS.
grant execute on function
  app_private.module_access(text),
  app_private.announcement_audience_matches(text[], text[], text[])
to authenticated;

grant execute on function
  public.list_my_modules(),
  public.register_module_interest(text),
  public.withdraw_module_interest(text),
  public.mark_notifications_read(uuid[]),
  public.record_session_started()
to authenticated;

alter table public.modules enable row level security;
alter table public.entitlements enable row level security;
alter table public.module_availability enable row level security;
alter table public.module_interests enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_events enable row level security;

-- Registro de módulos: lectura para autenticados (sin módulos ocultos); sin escritura.
grant select on public.modules, public.entitlements, public.module_availability to authenticated;
create policy modules_read on public.modules for select to authenticated
  using (status <> 'hidden');
create policy entitlements_read on public.entitlements for select to authenticated using (true);
create policy module_availability_read on public.module_availability for select to authenticated using (true);

-- Interés: lectura y retirada propias; alta propia solo si el módulo está 'coming_soon'
-- para el usuario. El país lo fija el trigger (sin privilegio sobre la columna).
grant select, delete on public.module_interests to authenticated;
grant insert (user_id, module_id) on public.module_interests to authenticated;
create policy module_interests_read_own on public.module_interests for select to authenticated
  using (user_id = auth.uid() and app_private.is_active_user());
create policy module_interests_insert_own on public.module_interests for insert to authenticated
  with check (
    user_id = auth.uid() and app_private.is_active_user()
    and app_private.module_access(module_id) = 'coming_soon'
  );
create policy module_interests_delete_own on public.module_interests for delete to authenticated
  using (user_id = auth.uid() and app_private.is_active_user());

-- Avisos: publicados, vigentes y de la audiencia propia; sin escritura del cliente
-- (formulario de administración en la etapa 4).
grant select (id, title, body, status, starts_at, ends_at, created_at) on public.announcements to authenticated;
create policy announcements_read_audience on public.announcements for select to authenticated
  using (
    status = 'published'
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
    and app_private.announcement_audience_matches(country_codes, role_codes, plan_codes)
  );

-- Notificaciones: lectura propia de usuarios activos; escritura solo mediante funciones.
grant select on public.notifications to authenticated;
create policy notifications_read_own on public.notifications for select to authenticated
  using (user_id = auth.uid() and app_private.is_active_user());

-- activity_events: sin privilegios para anon/authenticated (métricas SQL en la etapa 4).
