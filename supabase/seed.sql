-- Seed de desarrollo y staging. NO aplicar en producción ni con usuarios reales.
--
-- 1. Territorio SINTÉTICO: marcado is_synthetic y source 'sintetico'. Sustituye al padrón
--    oficial MINEDU–ESCALE solo mientras se completa su importación (docs/catalogs/README.md),
--    requisito de cierre antes de usuarios reales.
-- 2. Catálogo educativo PRELIMINAR: estructura general de niveles y grados de la Educación
--    Básica Regular, pendiente de revisión del propietario. Sin áreas curriculares todavía.
-- 3–4. Etapa 3: demo con derecho requerido y aviso de prueba (ver al final).
-- Idempotente: se puede ejecutar varias veces.

insert into public.territory_units (country_code, kind, official_code, name, source, is_synthetic) values
  ('PE', 'region', 'SIN-R01', 'Región sintética Norte', 'sintetico', true),
  ('PE', 'region', 'SIN-R02', 'Región sintética Sur', 'sintetico', true)
on conflict (country_code, kind, official_code) do nothing;

insert into public.territory_units (country_code, kind, official_code, name, parent_id, source, is_synthetic)
select 'PE', 'ugel', v.code, v.name, r.id, 'sintetico', true
from (values
  ('SIN-U01', 'UGEL sintética Norte 1', 'SIN-R01'),
  ('SIN-U02', 'UGEL sintética Norte 2', 'SIN-R01'),
  ('SIN-U03', 'UGEL sintética Sur 1', 'SIN-R02')
) as v (code, name, region_code)
join public.territory_units r
  on r.country_code = 'PE' and r.kind = 'region' and r.official_code = v.region_code
on conflict (country_code, kind, official_code) do nothing;

insert into public.education_catalog (country_code, kind, code, name, sort_order, source) values
  ('PE', 'level', 'inicial', 'Inicial', 1, 'preliminar-pendiente-revision'),
  ('PE', 'level', 'primaria', 'Primaria', 2, 'preliminar-pendiente-revision'),
  ('PE', 'level', 'secundaria', 'Secundaria', 3, 'preliminar-pendiente-revision'),
  ('PE', 'grade', 'inicial-3', '3 años', 11, 'preliminar-pendiente-revision'),
  ('PE', 'grade', 'inicial-4', '4 años', 12, 'preliminar-pendiente-revision'),
  ('PE', 'grade', 'inicial-5', '5 años', 13, 'preliminar-pendiente-revision'),
  ('PE', 'grade', 'primaria-1', '1.º de primaria', 21, 'preliminar-pendiente-revision'),
  ('PE', 'grade', 'primaria-2', '2.º de primaria', 22, 'preliminar-pendiente-revision'),
  ('PE', 'grade', 'primaria-3', '3.º de primaria', 23, 'preliminar-pendiente-revision'),
  ('PE', 'grade', 'primaria-4', '4.º de primaria', 24, 'preliminar-pendiente-revision'),
  ('PE', 'grade', 'primaria-5', '5.º de primaria', 25, 'preliminar-pendiente-revision'),
  ('PE', 'grade', 'primaria-6', '6.º de primaria', 26, 'preliminar-pendiente-revision'),
  ('PE', 'grade', 'secundaria-1', '1.º de secundaria', 31, 'preliminar-pendiente-revision'),
  ('PE', 'grade', 'secundaria-2', '2.º de secundaria', 32, 'preliminar-pendiente-revision'),
  ('PE', 'grade', 'secundaria-3', '3.º de secundaria', 33, 'preliminar-pendiente-revision'),
  ('PE', 'grade', 'secundaria-4', '4.º de secundaria', 34, 'preliminar-pendiente-revision'),
  ('PE', 'grade', 'secundaria-5', '5.º de secundaria', 35, 'preliminar-pendiente-revision')
on conflict (country_code, kind, code) do nothing;

insert into public.education_catalog_relations (from_id, to_id)
select l.id, g.id
from public.education_catalog l
join public.education_catalog g
  on g.country_code = l.country_code and g.kind = 'grade' and g.code like l.code || '-%'
where l.country_code = 'PE' and l.kind = 'level'
on conflict do nothing;

-- 3. Etapa 3 (SOLO dev y staging): el módulo demo queda disponible en PE pero exige
--    demo.access, que ningún usuario tiene hasta la etapa 5 (resultado: requires_entitlement).
--    En producción no existe esta fila, así que el resolvedor lo oculta.
insert into public.module_availability (module_id, country_code, required_entitlement)
values ('demo', 'PE', 'demo.access')
on conflict (module_id, country_code) do nothing;

-- 4. Aviso SINTÉTICO de prueba, publicado y sin restricción de audiencia.
insert into public.announcements (title, body, status)
select 'Aviso de prueba',
  'Aviso sintético de desarrollo y staging para probar el panel. No contiene información real.',
  'published'
where not exists (select 1 from public.announcements where title = 'Aviso de prueba');

-- 5. Etapa 5 (SOLO dev y staging): habilita la pasarela de prueba (sandbox). La migración
--    20261006000100_stage5_billing.sql deja app_private.sandbox_enabled() en false
--    (fail-closed); como este seed nunca se aplica en producción, allí no se puede iniciar
--    un checkout ni resolver un pago de prueba. create or replace conserva propietario y
--    privilegios. Idempotente.
create or replace function app_private.sandbox_enabled()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select true
$$;
