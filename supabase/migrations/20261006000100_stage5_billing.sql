-- Etapa 5: planes sandbox, checkout de prueba, Mi plan, módulo demo e inspección
-- administrativa de solo lectura.
--
-- Contrato: docs/architecture/etapa-5-contrato.md (plan: etapa-5-plan.md; reglas de fondo:
-- fase-0-rev-0.2.md §2–§3; prevalece approved-scope.md). No modifica las migraciones de las
-- etapas 2, 3 y 4: usa create or replace, alter table y triggers nuevos.
-- Reglas:
-- * La base decide: precio, contexto, estados y derechos los calcula SQL. El navegador nunca
--   envía importes ni estados; la app solo llama a las funciones public.* de abajo.
-- * Sandbox fail-closed: app_private.sandbox_enabled() devuelve false aquí. Solo
--   supabase/seed.sql (dev y staging, nunca producción) la reemplaza por true. Sin ella no
--   se inicia un checkout ni se resuelve un pago.
-- * Gratis es la ausencia de suscripción vigente: no hay suscripción ni precio de Gratis.
-- * Vigente = status 'active' y now() < current_period_end. Sin cron: cada autorización
--   compara fechas y las funciones que escriben marcan lo caducado al consultarlo.
-- * Solo contexto personal: has_entitlement y current_plan_code leen únicamente el
--   workspace personal del usuario. Derechos institucionales y personales nunca se suman.
-- * subscriptions y payments no tienen ningún privilegio de tabla para el cliente.
-- * Funciones con security definer y search_path vacío; se revoca execute a public, anon y
--   authenticated en cada una y se concede solo lo necesario a authenticated.

-- ---------------------------------------------------------------------------
-- Planes, precios y derechos por plan
-- ---------------------------------------------------------------------------

create table public.plans (
  code text primary key check (code in ('gratis', 'individual', 'institucional')),
  scope text not null check (scope in ('personal', 'institutional')),
  active boolean not null,
  visible boolean not null,
  sort_order integer not null default 0
);

insert into public.plans (code, scope, active, visible, sort_order) values
  ('gratis', 'personal', true, true, 10),
  ('individual', 'personal', true, true, 20),
  -- Institucional existe pero queda inactivo y oculto: sin compras para organizaciones.
  ('institucional', 'institutional', false, false, 30);

create table public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  -- Gratis no tiene precio: es la ausencia de suscripción vigente.
  plan_code text not null references public.plans (code) check (plan_code <> 'gratis'),
  country_code text not null references public.countries (code),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor integer not null check (amount_minor > 0),
  period text not null check (period in ('month')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index plan_prices_one_active_idx on public.plan_prices (plan_code, country_code) where active;

-- Precio sandbox de Individual (approved-scope.md): PEN 1990 unidades menores por mes,
-- equivalente a S/ 19.90. Precio de prueba, no comercial.
insert into public.plan_prices (plan_code, country_code, currency, amount_minor, period)
values ('individual', 'PE', 'PEN', 1990, 'month');

create table public.plan_entitlements (
  plan_code text not null references public.plans (code),
  entitlement_code text not null references public.entitlements (code),
  primary key (plan_code, entitlement_code)
);

-- Gratis e Institucional no conceden derechos.
insert into public.plan_entitlements (plan_code, entitlement_code) values ('individual', 'demo.access');

-- ---------------------------------------------------------------------------
-- Suscripciones y pagos (sin privilegios de tabla para el cliente)
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Gratis no crea suscripción.
  plan_code text not null references public.plans (code) check (plan_code <> 'gratis'),
  plan_price_id uuid not null references public.plan_prices (id),
  status text not null default 'incomplete'
    check (status in ('incomplete', 'active', 'expired', 'incomplete_expired')),
  -- Periodo y activación: solo si está o estuvo activa.
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  -- Snapshot de las condiciones con las que se contrató: un cambio futuro de precio o de
  -- derechos no reescribe la suscripción (lo impide el trigger subscriptions_check).
  price_amount_minor integer not null check (price_amount_minor > 0),
  price_currency text not null check (price_currency ~ '^[A-Z]{3}$'),
  price_period text not null check (price_period in ('month')),
  entitlement_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((current_period_start is null) = (current_period_end is null)),
  check ((current_period_start is not null) = (status in ('active', 'expired'))),
  check ((activated_at is not null) = (status in ('active', 'expired'))),
  check (current_period_end > current_period_start),
  check (cancel_at_period_end = (canceled_at is not null)),
  check (not cancel_at_period_end or status in ('active', 'expired'))
);
-- Una sola suscripción en curso (pendiente de pago o activa) por workspace.
create unique index subscriptions_one_open_idx on public.subscriptions (workspace_id)
  where status in ('incomplete', 'active');
create index subscriptions_workspace_idx on public.subscriptions (workspace_id, created_at desc);

create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function app_private.touch_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  -- Importe y moneda congelados: copia del snapshot de la suscripción.
  amount_minor integer not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  provider text not null default 'sandbox' check (provider in ('sandbox')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'canceled', 'expired')),
  -- Clave fijada por el servidor ('checkout:' || suscripción): un solo pago por suscripción.
  idempotency_key text not null unique check (char_length(idempotency_key) between 1 and 200),
  -- Referencia única del resultado ('sandbox-' || id); sin PaymentEvent.
  provider_reference text unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((status = 'pending') = (provider_reference is null)),
  check ((status = 'pending') = (resolved_at is null))
);
create index payments_subscription_idx on public.payments (subscription_id);

-- ---------------------------------------------------------------------------
-- Integridad
-- ---------------------------------------------------------------------------

-- Un precio ya publicado no cambia: solo se activa o desactiva. Un precio nuevo es una fila
-- nueva, y las suscripciones conservan su snapshot.
create function app_private.plan_price_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.id, new.plan_code, new.country_code, new.currency, new.amount_minor, new.period, new.created_at)
     is distinct from
     (old.id, old.plan_code, old.country_code, old.currency, old.amount_minor, old.period, old.created_at) then
    raise exception 'Un precio no se modifica: crea uno nuevo' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger plan_prices_immutable before update on public.plan_prices
  for each row execute function app_private.plan_price_immutable();

-- Alta: el precio pertenece al plan y el ámbito del plan coincide con el del workspace
-- (personal ↔ personal, institutional ↔ institutional).
-- Cambio: el snapshot y el contexto son inmutables, y solo se admiten las transiciones
-- incomplete → active | incomplete_expired y active → expired.
create function app_private.check_subscription()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.plan_prices pp where pp.id = new.plan_price_id and pp.plan_code = new.plan_code
    ) then
      raise exception 'El precio no corresponde al plan' using errcode = '23514';
    end if;
    if not exists (
      select 1
      from public.plans p
      join public.workspaces w on w.id = new.workspace_id
      where p.code = new.plan_code and p.scope = w.kind
    ) then
      raise exception 'El plan no corresponde al tipo de workspace' using errcode = '23514';
    end if;
    return new;
  end if;

  if (new.id, new.workspace_id, new.plan_code, new.plan_price_id, new.price_amount_minor, new.price_currency,
      new.price_period, new.entitlement_codes, new.created_at)
     is distinct from
     (old.id, old.workspace_id, old.plan_code, old.plan_price_id, old.price_amount_minor, old.price_currency,
      old.price_period, old.entitlement_codes, old.created_at) then
    raise exception 'Las condiciones de una suscripción no cambian' using errcode = '23514';
  end if;
  if new.status is distinct from old.status and not (
    (old.status = 'incomplete' and new.status in ('active', 'incomplete_expired'))
    or (old.status = 'active' and new.status = 'expired')
  ) then
    raise exception 'Transición de suscripción no válida' using errcode = '23514';
  end if;
  if old.activated_at is not null and new.activated_at is distinct from old.activated_at then
    raise exception 'La fecha de activación no cambia' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger subscriptions_check before insert or update on public.subscriptions
  for each row execute function app_private.check_subscription();

-- Alta: importe y moneda iguales al snapshot de la suscripción.
-- Cambio: solo un pago pendiente cambia (a un estado final, o su vencimiento); un pago
-- resuelto es inmutable. Así ni una repetición ni un resultado tardío revierten nada.
create function app_private.check_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.subscriptions s
      where s.id = new.subscription_id
        and s.price_amount_minor = new.amount_minor and s.price_currency = new.currency
    ) then
      raise exception 'El importe no corresponde a la suscripción' using errcode = '23514';
    end if;
    return new;
  end if;

  if old.status <> 'pending' then
    raise exception 'Un pago resuelto no se modifica' using errcode = '23514';
  end if;
  if (new.id, new.subscription_id, new.amount_minor, new.currency, new.provider, new.idempotency_key, new.created_at)
     is distinct from
     (old.id, old.subscription_id, old.amount_minor, old.currency, old.provider, old.idempotency_key, old.created_at) then
    raise exception 'Los datos de un pago no cambian' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger payments_check before insert or update on public.payments
  for each row execute function app_private.check_payment();

-- Notificaciones nuevas: plan activado (enlace /mi-plan) y pago rechazado (enlace /planes).
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'welcome', 'module_available', 'subscription_activated', 'payment_rejected'
));

-- ---------------------------------------------------------------------------
-- Matriz rol→permiso (espejo de permission-matrix.json): + admin.billing.read
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
    ('admin', 'admin.billing.read'),
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
    ('superadmin', 'admin.audit.read'),
    ('superadmin', 'admin.billing.read')
$$;

-- ---------------------------------------------------------------------------
-- Funciones privadas
-- ---------------------------------------------------------------------------

-- FAIL-CLOSED: false en la migración, y por tanto en producción. Solo supabase/seed.sql
-- (dev y staging) la reemplaza por true. No cambiar este valor aquí.
create function app_private.sandbox_enabled()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select false
$$;

create function app_private.personal_workspace_id(p_user uuid default auth.uid())
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select w.id from public.workspaces w where w.kind = 'personal' and w.owner_user_id = p_user
$$;

-- Usuario activo o 42501; devuelve auth.uid().
create function app_private.require_active_user()
returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not app_private.is_active_user() then
    raise exception 'Cuenta no disponible' using errcode = '42501';
  end if;
  return auth.uid();
end
$$;

-- Vencimiento perezoso (sin cron) de un workspace:
-- * pagos pendientes con expires_at <= now() → expired (referencia y fecha de resolución);
-- * suscripciones incompletas sin pago pendiente vivo → incomplete_expired;
-- * suscripciones activas con current_period_end <= now() → expired.
-- Orden único de bloqueo (evita esperas en cruz): quien llama bloquea PRIMERO el workspace
-- (select … from public.workspaces where id = … for update) y solo después pagos y
-- suscripciones. Todas las funciones de esta migración que la llaman lo cumplen.
create function app_private.expire_stale(p_workspace uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.payments p
  set status = 'expired', resolved_at = now(), provider_reference = 'sandbox-' || p.id::text
  from public.subscriptions s
  where s.id = p.subscription_id and s.workspace_id = p_workspace
    and p.status = 'pending' and p.expires_at <= now();

  update public.subscriptions s
  set status = 'incomplete_expired'
  where s.workspace_id = p_workspace and s.status = 'incomplete'
    and not exists (
      select 1 from public.payments p where p.subscription_id = s.id and p.status = 'pending'
    );

  update public.subscriptions s
  set status = 'expired'
  where s.workspace_id = p_workspace and s.status = 'active' and s.current_period_end <= now();
end
$$;

-- Etapa 5: deja de ser fija. Derecho vigente solo en el workspace PERSONAL del usuario
-- activo, comparando fechas (no depende del vencimiento perezoso). Nunca suma derechos de
-- workspaces institucionales.
create or replace function app_private.has_entitlement(p_code text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app_private.is_active_user() and exists (
    select 1
    from public.subscriptions s
    join public.workspaces w on w.id = s.workspace_id
    where w.kind = 'personal' and w.owner_user_id = auth.uid()
      and s.status = 'active' and now() < s.current_period_end
      and p_code = any (s.entitlement_codes)
  )
$$;

-- Plan de la suscripción personal vigente, o 'gratis'.
create or replace function app_private.current_plan_code()
returns text
language sql stable security definer
set search_path = ''
as $$
  select coalesce((
    select s.plan_code
    from public.subscriptions s
    join public.workspaces w on w.id = s.workspace_id
    where app_private.is_active_user()
      and w.kind = 'personal' and w.owner_user_id = auth.uid()
      and s.status = 'active' and now() < s.current_period_end
    order by s.current_period_end desc
    limit 1
  ), 'gratis')
$$;

-- ---------------------------------------------------------------------------
-- Operaciones del usuario (RPC)
-- ---------------------------------------------------------------------------

-- Permite a la interfaz explicar cuándo el checkout de prueba no está habilitado.
create function public.sandbox_available()
returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform app_private.require_active_user();
  return app_private.sandbox_enabled();
end
$$;

-- Planes activos y visibles con el precio activo del país del perfil. Gratis (y un plan sin
-- precio en ese país) devuelve los campos de precio en null.
create function public.list_plans()
returns table (
  plan_code text, scope text, price_id uuid, amount_minor integer, currency text, period text,
  entitlement_codes text[], sort_order integer
)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid;
  v_country text;
begin
  v_uid := app_private.require_active_user();
  select p.country_code into v_country from public.profiles p where p.user_id = v_uid;
  return query
  select
    pl.code,
    pl.scope,
    pp.id,
    pp.amount_minor,
    pp.currency,
    pp.period,
    coalesce(
      (select array_agg(pe.entitlement_code order by pe.entitlement_code)
       from public.plan_entitlements pe where pe.plan_code = pl.code),
      '{}'::text[]
    ),
    pl.sort_order
  from public.plans pl
  left join public.plan_prices pp
    on pp.plan_code = pl.code and pp.active and pp.country_code = v_country
  where pl.active and pl.visible
  order by pl.sort_order, pl.code;
end
$$;

-- Inicia el checkout de prueba del plan en el workspace personal. El servidor fija precio,
-- moneda, periodo y derechos. Devuelve el id del pago pendiente.
create function public.start_checkout(p_plan text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_ws uuid;
  v_country text;
  v_price public.plan_prices;
  v_entitlements text[];
  v_open public.subscriptions;
  v_payment uuid;
  v_sub uuid;
begin
  v_uid := app_private.require_active_user();
  if not app_private.sandbox_enabled() then
    raise exception 'Los pagos de prueba no están habilitados en este entorno' using errcode = '42501';
  end if;

  select p.country_code into v_country from public.profiles p where p.user_id = v_uid;
  select pp.* into v_price
  from public.plans pl
  join public.plan_prices pp on pp.plan_code = pl.code and pp.active and pp.country_code = v_country
  where pl.code = p_plan and pl.code <> 'gratis' and pl.active and pl.visible and pl.scope = 'personal';
  if not found then
    raise exception 'Plan no disponible' using errcode = '22023';
  end if;

  v_ws := app_private.personal_workspace_id(v_uid);
  if v_ws is null then
    raise exception 'Cuenta no disponible' using errcode = '42501';
  end if;
  -- Orden único de bloqueo: primero el workspace. Serializa además los checkouts del mismo
  -- workspace (doble clic concurrente).
  perform 1 from public.workspaces w where w.id = v_ws for update;
  perform app_private.expire_stale(v_ws);

  select s.* into v_open
  from public.subscriptions s
  where s.workspace_id = v_ws and s.status in ('incomplete', 'active')
  for update;
  if found then
    if v_open.status = 'active' then
      raise exception 'Ya tienes un plan vigente' using errcode = '23514';
    end if;
    -- Tras expire_stale, una suscripción incompleta siempre tiene un pago pendiente vivo.
    if v_open.plan_code <> p_plan then
      raise exception 'Hay otro checkout en curso' using errcode = '23514';
    end if;
    select p.id into v_payment
    from public.payments p
    where p.subscription_id = v_open.id and p.status = 'pending' and p.expires_at > now();
    if v_payment is null then
      raise exception 'Checkout en un estado no válido' using errcode = '23514';
    end if;
    return v_payment; -- doble clic: el mismo pago, sin efectos nuevos
  end if;

  select coalesce(array_agg(pe.entitlement_code order by pe.entitlement_code), '{}'::text[])
  into v_entitlements
  from public.plan_entitlements pe where pe.plan_code = v_price.plan_code;

  insert into public.subscriptions (
    workspace_id, plan_code, plan_price_id, status,
    price_amount_minor, price_currency, price_period, entitlement_codes
  ) values (
    v_ws, v_price.plan_code, v_price.id, 'incomplete',
    v_price.amount_minor, v_price.currency, v_price.period, v_entitlements
  )
  returning id into v_sub;

  insert into public.payments (subscription_id, amount_minor, currency, provider, idempotency_key, expires_at)
  values (v_sub, v_price.amount_minor, v_price.currency, 'sandbox', 'checkout:' || v_sub::text, now() + interval '30 minutes')
  returning id into v_payment;

  perform app_private.audit('user', 'checkout.started', 'subscription', v_sub::text, 'success',
    jsonb_build_object('plan', v_price.plan_code, 'payment_id', v_payment));
  return v_payment;
end
$$;

-- Adaptador sandbox: la página de pasarela de prueba lo llama en nombre del usuario.
-- Solo un pago pendiente cambia; repetir o enviar un resultado tardío devuelve el estado
-- actual sin efectos. Devuelve el estado final del pago.
create function public.sandbox_resolve_payment(p_payment uuid, p_result text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_status text;
  v_expires timestamptz;
  v_sub uuid;
  v_ws uuid;
  v_plan text;
begin
  v_uid := app_private.require_active_user();
  if not app_private.sandbox_enabled() then
    raise exception 'Los pagos de prueba no están habilitados en este entorno' using errcode = '42501';
  end if;
  if p_result is null or p_result not in ('approved', 'rejected', 'pending', 'canceled') then
    raise exception 'Resultado no válido' using errcode = '22023';
  end if;

  -- Orden único de bloqueo: primero el workspace personal (como en todas las funciones que
  -- llaman a expire_stale), después el pago y su suscripción. Las resoluciones concurrentes
  -- se serializan y la segunda ve el estado final de la primera.
  v_ws := app_private.personal_workspace_id(v_uid);
  perform 1 from public.workspaces w where w.id = v_ws for update;

  -- Solo pagos del workspace personal del usuario (propiedad).
  select p.status, p.expires_at, s.id, s.plan_code
  into v_status, v_expires, v_sub, v_plan
  from public.payments p
  join public.subscriptions s on s.id = p.subscription_id
  where p.id = p_payment and s.workspace_id = v_ws
  for update of p, s;
  if not found then
    raise exception 'Pago no encontrado' using errcode = 'P0002';
  end if;

  if v_status = 'pending' and v_expires <= now() then
    perform app_private.expire_stale(v_ws);
    select p.status into v_status from public.payments p where p.id = p_payment;
  end if;

  -- Ya resuelto (mismo resultado u otro) o se deja pendiente: sin cambios.
  if v_status <> 'pending' or p_result = 'pending' then
    return v_status;
  end if;

  update public.payments
  set status = p_result, resolved_at = now(), provider_reference = 'sandbox-' || id::text
  where id = p_payment and status = 'pending';

  if p_result = 'approved' then
    update public.subscriptions
    set status = 'active', current_period_start = now(), current_period_end = now() + interval '1 month',
        activated_at = now()
    where id = v_sub and status = 'incomplete';
    if not found then
      raise exception 'Suscripción en un estado no válido' using errcode = '23514';
    end if;
    insert into public.notifications (user_id, kind, title, body, link_path, dedupe_key)
    values (
      v_uid, 'subscription_activated',
      case when v_plan = 'individual' then 'Tu plan Individual de prueba está activo' else 'Tu plan de prueba está activo' end,
      'La pasarela de prueba aprobó el pago. Es una prueba: no se cobró dinero real. El acceso dura hasta el fin del periodo y no se renueva solo.',
      '/mi-plan', 'subscription_activated:' || v_sub::text
    )
    on conflict (user_id, dedupe_key) do nothing;
    perform app_private.audit('user', 'subscription.activated', 'subscription', v_sub::text, 'success',
      jsonb_build_object('plan', v_plan, 'payment_id', p_payment));
  else
    update public.subscriptions set status = 'incomplete_expired' where id = v_sub and status = 'incomplete';
    if not found then
      raise exception 'Suscripción en un estado no válido' using errcode = '23514';
    end if;
    if p_result = 'rejected' then
      insert into public.notifications (user_id, kind, title, body, link_path, dedupe_key)
      values (
        v_uid, 'payment_rejected', 'Pago de prueba rechazado',
        'La pasarela de prueba rechazó el pago. Es una prueba: no se cobró dinero real. Puedes intentarlo de nuevo desde Planes.',
        '/planes', 'payment_rejected:' || p_payment::text
      )
      on conflict (user_id, dedupe_key) do nothing;
    end if;
  end if;

  perform app_private.audit('user', 'payment.resolved', 'payment', p_payment::text, 'success',
    jsonb_build_object('result', p_result, 'payment_id', p_payment));
  return p_result;
end
$$;

-- Un pago propio (con vencimiento perezoso). La página de resultado solo lee esto.
create function public.get_payment(p_payment uuid)
returns table (
  id uuid, status text, plan_code text, amount_minor integer, currency text,
  expires_at timestamptz, created_at timestamptz, resolved_at timestamptz
)
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid;
  v_ws uuid;
begin
  v_uid := app_private.require_active_user();
  v_ws := app_private.personal_workspace_id(v_uid);
  -- Orden único de bloqueo: primero el workspace (ver app_private.expire_stale).
  perform 1 from public.workspaces w where w.id = v_ws for update;
  perform app_private.expire_stale(v_ws);
  return query
  select p.id, p.status, s.plan_code, p.amount_minor, p.currency, p.expires_at, p.created_at, p.resolved_at
  from public.payments p
  join public.subscriptions s on s.id = p.subscription_id
  where p.id = p_payment and s.workspace_id = v_ws;
  if not found then
    raise exception 'Pago no encontrado' using errcode = 'P0002';
  end if;
end
$$;

-- Plan actual: una fila. Sin suscripción vigente → plan 'gratis' y campos de suscripción en
-- null (cancel_at_period_end = false). pending_payment_id: pago pendiente no vencido.
create function public.my_plan()
returns table (
  plan_code text, subscription_id uuid, status text, current_period_start timestamptz,
  current_period_end timestamptz, cancel_at_period_end boolean, amount_minor integer, currency text,
  pending_payment_id uuid
)
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid;
  v_ws uuid;
begin
  v_uid := app_private.require_active_user();
  v_ws := app_private.personal_workspace_id(v_uid);
  -- Orden único de bloqueo: primero el workspace (ver app_private.expire_stale).
  perform 1 from public.workspaces w where w.id = v_ws for update;
  perform app_private.expire_stale(v_ws);
  return query
  select
    coalesce(s.plan_code, 'gratis'),
    s.id,
    s.status,
    s.current_period_start,
    s.current_period_end,
    coalesce(s.cancel_at_period_end, false),
    s.price_amount_minor,
    s.price_currency,
    (select p.id
     from public.payments p
     join public.subscriptions ps on ps.id = p.subscription_id
     where ps.workspace_id = v_ws and ps.status = 'incomplete'
       and p.status = 'pending' and p.expires_at > now()
     order by p.created_at desc, p.id
     limit 1)
  from (select 1) as one
  left join public.subscriptions s
    on s.workspace_id = v_ws and s.status = 'active' and now() < s.current_period_end;
end
$$;

-- Historial de pagos propios: 20 por página, más recientes primero.
create function public.list_my_payments(p_page integer default 1)
returns table (
  id uuid, created_at timestamptz, resolved_at timestamptz, status text, amount_minor integer,
  currency text, plan_code text, provider text, total_count bigint
)
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid;
  v_ws uuid;
  v_offset bigint;
begin
  v_uid := app_private.require_active_user();
  v_offset := app_private.admin_page_offset(p_page);
  v_ws := app_private.personal_workspace_id(v_uid);
  -- Orden único de bloqueo: primero el workspace (ver app_private.expire_stale).
  perform 1 from public.workspaces w where w.id = v_ws for update;
  perform app_private.expire_stale(v_ws);
  return query
  select p.id, p.created_at, p.resolved_at, p.status, p.amount_minor, p.currency, s.plan_code, p.provider,
    count(*) over ()
  from public.payments p
  join public.subscriptions s on s.id = p.subscription_id
  where s.workspace_id = v_ws
  order by p.created_at desc, p.id
  limit 20 offset v_offset;
end
$$;

-- Cancelar al final del periodo: conserva el acceso hasta current_period_end.
create function public.cancel_subscription()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_ws uuid;
  v_sub public.subscriptions;
begin
  v_uid := app_private.require_active_user();
  v_ws := app_private.personal_workspace_id(v_uid);
  -- Orden único de bloqueo: primero el workspace (ver app_private.expire_stale).
  perform 1 from public.workspaces w where w.id = v_ws for update;
  perform app_private.expire_stale(v_ws);
  select s.* into v_sub
  from public.subscriptions s
  where s.workspace_id = v_ws and s.status = 'active' and now() < s.current_period_end
  for update;
  if not found then
    raise exception 'No tienes un plan vigente' using errcode = 'P0002';
  end if;
  if v_sub.cancel_at_period_end then
    raise exception 'El plan ya está cancelado' using errcode = '23514';
  end if;
  update public.subscriptions set cancel_at_period_end = true, canceled_at = now() where id = v_sub.id;
  perform app_private.audit('user', 'subscription.canceled', 'subscription', v_sub.id::text, 'success',
    jsonb_build_object('plan', v_sub.plan_code));
end
$$;

-- Reanudar antes del fin del periodo, sin nuevo pago.
create function public.resume_subscription()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_ws uuid;
  v_sub public.subscriptions;
begin
  v_uid := app_private.require_active_user();
  v_ws := app_private.personal_workspace_id(v_uid);
  -- Orden único de bloqueo: primero el workspace (ver app_private.expire_stale).
  perform 1 from public.workspaces w where w.id = v_ws for update;
  perform app_private.expire_stale(v_ws);
  select s.* into v_sub
  from public.subscriptions s
  where s.workspace_id = v_ws and s.status = 'active' and now() < s.current_period_end
    and s.cancel_at_period_end
  for update;
  if not found then
    raise exception 'No hay un plan cancelado que reanudar' using errcode = '23514';
  end if;
  update public.subscriptions set cancel_at_period_end = false, canceled_at = null where id = v_sub.id;
  perform app_private.audit('user', 'subscription.resumed', 'subscription', v_sub.id::text, 'success',
    jsonb_build_object('plan', v_sub.plan_code));
end
$$;

-- ---------------------------------------------------------------------------
-- Inspección administrativa (admin.billing.read). Solo lectura: no hay funciones admin
-- que modifiquen suscripciones ni pagos. Los listados exponen correos: se auditan.
-- ---------------------------------------------------------------------------

-- status es el estado guardado; is_current compara fechas (vigente ahora).
create function public.admin_list_subscriptions(
  p_status text default null, p_plan text default null, p_page integer default 1
)
returns table (
  id uuid, user_id uuid, email text, plan_code text, status text, is_current boolean,
  current_period_start timestamptz, current_period_end timestamptz, cancel_at_period_end boolean,
  amount_minor integer, currency text, created_at timestamptz, activated_at timestamptz, total_count bigint
)
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_offset bigint;
begin
  perform app_private.require_admin('admin.billing.read');
  v_offset := app_private.admin_page_offset(p_page);
  if p_status is not null and p_status not in ('incomplete', 'active', 'expired', 'incomplete_expired') then
    raise exception 'Estado no válido' using errcode = '22023';
  end if;
  if p_plan is not null and not exists (select 1 from public.plans pl where pl.code = p_plan) then
    raise exception 'Plan no válido' using errcode = '22023';
  end if;

  perform app_private.audit('admin', 'billing.subscriptions_listed', 'subscription', null, 'success',
    jsonb_build_object('status', p_status, 'plan', p_plan, 'page', p_page));

  return query
  select
    s.id,
    w.owner_user_id,
    au.email::text,
    s.plan_code,
    s.status,
    s.status = 'active' and now() < s.current_period_end,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end,
    s.price_amount_minor,
    s.price_currency,
    s.created_at,
    s.activated_at,
    count(*) over ()
  from public.subscriptions s
  join public.workspaces w on w.id = s.workspace_id
  left join auth.users au on au.id = w.owner_user_id
  where (p_status is null or s.status = p_status)
    and (p_plan is null or s.plan_code = p_plan)
  order by s.created_at desc, s.id
  limit 20 offset v_offset;
end
$$;

-- status es el estado guardado: un pendiente con expires_at pasado aún no marcado se
-- reconoce por expires_at.
create function public.admin_list_payments(p_status text default null, p_page integer default 1)
returns table (
  id uuid, subscription_id uuid, user_id uuid, email text, amount_minor integer, currency text,
  provider text, status text, provider_reference text, created_at timestamptz, resolved_at timestamptz,
  expires_at timestamptz, total_count bigint
)
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_offset bigint;
begin
  perform app_private.require_admin('admin.billing.read');
  v_offset := app_private.admin_page_offset(p_page);
  if p_status is not null and p_status not in ('pending', 'approved', 'rejected', 'canceled', 'expired') then
    raise exception 'Estado no válido' using errcode = '22023';
  end if;

  perform app_private.audit('admin', 'billing.payments_listed', 'payment', null, 'success',
    jsonb_build_object('status', p_status, 'page', p_page));

  return query
  select
    p.id,
    p.subscription_id,
    w.owner_user_id,
    au.email::text,
    p.amount_minor,
    p.currency,
    p.provider,
    p.status,
    p.provider_reference,
    p.created_at,
    p.resolved_at,
    p.expires_at,
    count(*) over ()
  from public.payments p
  join public.subscriptions s on s.id = p.subscription_id
  join public.workspaces w on w.id = s.workspace_id
  left join auth.users au on au.id = w.owner_user_id
  where p_status is null or p.status = p_status
  order by p.created_at desc, p.id
  limit 20 offset v_offset;
end
$$;

-- Conversión de prueba: primera activación de Individual por usuario (activated_at mínimo
-- en su workspace personal). Población: public.users con is_seed = false.
create function public.admin_metric_conversion()
returns table (converted_users bigint, converted_last_30_days bigint)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform app_private.require_admin('admin.billing.read');
  return query
  select
    count(*),
    count(*) filter (where f.first_activated_at >= now() - interval '30 days')
  from (
    select w.owner_user_id, min(s.activated_at) as first_activated_at
    from public.subscriptions s
    join public.workspaces w on w.id = s.workspace_id and w.kind = 'personal'
    join public.users u on u.id = w.owner_user_id and not u.is_seed
    where s.plan_code = 'individual' and s.activated_at is not null
    group by w.owner_user_id
  ) f;
end
$$;

-- ---------------------------------------------------------------------------
-- Privilegios explícitos y RLS
-- ---------------------------------------------------------------------------

revoke all on public.plans, public.plan_prices, public.plan_entitlements,
  public.subscriptions, public.payments
  from anon, authenticated;

-- Auxiliares y funciones de trigger: solo las invocan funciones security definer (como
-- propietario) o el propio motor. Nadie más necesita execute. create or replace conserva
-- los privilegios de has_entitlement, current_plan_code y permission_matrix.
revoke all on function
  app_private.plan_price_immutable(),
  app_private.check_subscription(),
  app_private.check_payment(),
  app_private.sandbox_enabled(),
  app_private.personal_workspace_id(uuid),
  app_private.require_active_user(),
  app_private.expire_stale(uuid),
  app_private.has_entitlement(text),
  app_private.current_plan_code()
from public, anon, authenticated;

revoke all on function
  public.sandbox_available(),
  public.list_plans(),
  public.start_checkout(text),
  public.sandbox_resolve_payment(uuid, text),
  public.get_payment(uuid),
  public.my_plan(),
  public.list_my_payments(integer),
  public.cancel_subscription(),
  public.resume_subscription(),
  public.admin_list_subscriptions(text, text, integer),
  public.admin_list_payments(text, integer),
  public.admin_metric_conversion()
from public, anon, authenticated;

grant execute on function
  public.sandbox_available(),
  public.list_plans(),
  public.start_checkout(text),
  public.sandbox_resolve_payment(uuid, text),
  public.get_payment(uuid),
  public.my_plan(),
  public.list_my_payments(integer),
  public.cancel_subscription(),
  public.resume_subscription(),
  public.admin_list_subscriptions(text, text, integer),
  public.admin_list_payments(text, integer),
  public.admin_metric_conversion()
to authenticated;

alter table public.plans enable row level security;
alter table public.plan_prices enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

-- Catálogo de planes: lectura para autenticados, solo de planes activos y visibles (el
-- Institucional oculto no se lee); sin escritura.
grant select on public.plans, public.plan_prices, public.plan_entitlements to authenticated;
create policy plans_read on public.plans for select to authenticated
  using (active and visible);
create policy plan_prices_read on public.plan_prices for select to authenticated
  using (active and exists (
    select 1 from public.plans pl where pl.code = plan_prices.plan_code and pl.active and pl.visible
  ));
create policy plan_entitlements_read on public.plan_entitlements for select to authenticated
  using (exists (
    select 1 from public.plans pl where pl.code = plan_entitlements.plan_code and pl.active and pl.visible
  ));

-- subscriptions y payments: RLS activado, sin políticas ni privilegios para el cliente.
-- Lectura y escritura solo mediante las funciones de arriba.
