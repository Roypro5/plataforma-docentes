-- Verificación de PRODUCCIÓN (lanzamiento, fase A, punto 4). SOLO LECTURA.
--
-- Uso: después de aplicar en producción todas las migraciones de supabase/migrations/ en
-- orden y SIN supabase/seed.sql, pegar este archivo completo en el SQL Editor del proyecto
-- de producción y ejecutarlo. Devuelve una sola fila. Cada columna debe tener el valor
-- esperado de la tabla de abajo. Si alguna difiere, no abrir producción y revisar.
--
-- Es una única consulta SELECT: no escribe ni cambia el esquema. El SQL Editor la ejecuta
-- con el rol postgres, que puede leer app_private y todas las tablas. No sirve con las
-- claves anon o authenticated, y no debe exponerse por la Data API.
--
-- Columna                  Esperado  Qué comprueba
-- -----------------------  --------  ------------------------------------------------------
-- tablas_publicas          26        tablas del esquema public creadas por las migraciones
-- tablas_sin_rls           0         toda tabla de public tiene RLS activada
-- sandbox_activo           false     app_private.sandbox_enabled(): pasarela de prueba apagada
-- territorio_sintetico     0         sin regiones ni UGEL sintéticas del seed
-- territorio_total         0         sin regiones ni UGEL mientras no se importe el padrón
--                                    oficial (decisión 6: piloto sin región ni UGEL)
-- aviso_de_prueba          0         sin el aviso 'Aviso de prueba' del seed
-- demo_disponible          0         sin filas de module_availability del módulo demo
-- usuarios_seed            0         ningún usuario marcado is_seed
-- niveles                  3         Inicial, Primaria y Secundaria
-- grados                   14        3 de Inicial + 6 de Primaria + 5 de Secundaria
-- relaciones_nivel_grado   14        cada grado enlazado con su nivel
-- grados_sin_nivel         0         ningún grado queda sin nivel (el onboarding lo exige)
-- fuente_catalogo          preliminar-pendiente-revision
--                                    etiqueta source del catálogo. Si el propietario confirma
--                                    la lista con otra etiqueta, se espera esa etiqueta
-- precios_activos          individual PE PEN 1990/month
--                                    único precio activo que crean las migraciones (precio de
--                                    prueba de la etapa 5; Planes está oculto en producción y
--                                    sin sandbox no se puede cobrar)
-- superadmins_activos      0 antes del bootstrap del superadmin
--                          1 después del bootstrap (app_private.bootstrap_superadmin)
-- superadmins_con_mfa      0 antes de que el superadmin inscriba su factor TOTP
--                          1 después: superadmins activos con al menos un factor TOTP
--                          verificado en auth.mfa_factors
-- admins_activos           0         usuarios activos con el rol admin (en el lanzamiento
--                                    solo existe el superadmin)
-- privilegios_anon         0         tablas, vistas, secuencias o columnas de public en las
--                                    que anon tiene algún privilegio (directo o vía PUBLIC),
--                                    más funciones de public y app_private que anon puede
--                                    ejecutar. Requiere la migración 20261006000200, que
--                                    revoca el último caso (reject_duplicate_consent). Si da
--                                    1, falta esa migración. Cualquier otro valor: revisar
--
-- REQUISITO PARA ABRIR PRODUCCIÓN: superadmins_activos = 1 y superadmins_con_mfa = 1, además
-- de todos los demás valores de la tabla. Con superadmins_con_mfa = 0 no se abre.

select
  (select count(*)::int
     from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p'))                  as tablas_publicas,
  (select count(*)::int
     from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and not c.relrowsecurity)                                               as tablas_sin_rls,
  app_private.sandbox_enabled()                                               as sandbox_activo,
  (select count(*)::int from public.territory_units
    where is_synthetic or source = 'sintetico')                               as territorio_sintetico,
  (select count(*)::int from public.territory_units)                          as territorio_total,
  (select count(*)::int from public.announcements
    where title = 'Aviso de prueba')                                          as aviso_de_prueba,
  (select count(*)::int from public.module_availability
    where module_id = 'demo')                                                 as demo_disponible,
  (select count(*)::int from public.users where is_seed)                      as usuarios_seed,
  (select count(*)::int from public.education_catalog
    where country_code = 'PE' and kind = 'level' and active)                  as niveles,
  (select count(*)::int from public.education_catalog
    where country_code = 'PE' and kind = 'grade' and active)                  as grados,
  (select count(*)::int
     from public.education_catalog_relations r
     join public.education_catalog l on l.id = r.from_id and l.kind = 'level'
     join public.education_catalog g on g.id = r.to_id and g.kind = 'grade'
    where l.country_code = 'PE')                                              as relaciones_nivel_grado,
  (select count(*)::int from public.education_catalog g
    where g.country_code = 'PE' and g.kind = 'grade'
      and not exists (select 1 from public.education_catalog_relations r
                       where r.to_id = g.id))                                 as grados_sin_nivel,
  (select string_agg(distinct source, ', ' order by source)
     from public.education_catalog where country_code = 'PE')                 as fuente_catalogo,
  (select coalesce(string_agg(
            format('%s %s %s %s/%s', plan_code, country_code, currency, amount_minor, period),
            ', ' order by plan_code, country_code), 'ninguno')
     from public.plan_prices where active)                                    as precios_activos,
  (select count(*)::int
     from public.user_roles ur
     join public.users u on u.id = ur.user_id
    where ur.role_code = 'superadmin' and u.status = 'active')                as superadmins_activos,
  (select count(*)::int
     from public.user_roles ur
     join public.users u on u.id = ur.user_id
    where ur.role_code = 'superadmin' and u.status = 'active'
      and exists (select 1 from auth.mfa_factors f
                   where f.user_id = ur.user_id
                     and f.factor_type = 'totp' and f.status = 'verified'))   as superadmins_con_mfa,
  (select count(*)::int
     from public.user_roles ur
     join public.users u on u.id = ur.user_id
    where ur.role_code = 'admin' and u.status = 'active')                     as admins_activos,
  -- has_*_privilege incluye lo concedido a PUBLIC y no depende de los roles del usuario que
  -- ejecuta la consulta (las vistas de information_schema solo muestran los roles activos).
  (select count(*)::int
     from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and case when c.relkind = 'S'
            then pg_catalog.has_sequence_privilege('anon', c.oid, 'USAGE, SELECT, UPDATE')
          when c.relkind in ('r', 'p', 'v', 'm', 'f')
            then pg_catalog.has_table_privilege('anon', c.oid,
                   'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
                 or pg_catalog.has_any_column_privilege('anon', c.oid,
                   'SELECT, INSERT, UPDATE, REFERENCES')
          else false end)
  + (select count(*)::int
       from pg_catalog.pg_proc p
       join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'app_private')
        and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE'))      as privilegios_anon;
