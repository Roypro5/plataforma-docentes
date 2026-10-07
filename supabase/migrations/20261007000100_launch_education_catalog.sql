-- Lanzamiento, fase A, punto 2: catálogo educativo como migración.
--
-- Lista CONFIRMADA por el propietario el 07/10/2026 (decisión 8 de
-- docs/architecture/lanzamiento-plan.md), sin cambios de códigos, nombres ni orden respecto a
-- la lista preliminar. Se aplica en dev, staging y producción. Una vez aplicada en cualquier
-- proyecto Supabase, este archivo no se edita: cualquier cambio irá en una migración nueva.
--
-- Por qué: supabase/seed.sql nunca se aplica en producción y el onboarding exige al menos un
-- nivel. Sin estas filas ningún docente podría terminar el registro en producción.
--
-- Contenido: estructura general de niveles y grados de la Educación Básica Regular de Perú
-- (Inicial 3, 4 y 5 años; Primaria 1.º a 6.º; Secundaria 1.º a 5.º). Sin áreas curriculares.
-- Es la única fuente de estas filas: el seed ya no las inserta.
--
-- source: 'confirmado-propietario-2026-10-07'. La columna es texto libre (sin check ni enum)
-- y se muestra en Administración › Catálogos.
--
-- Idempotente y segura en dev y staging, donde una versión anterior del seed ya creó estas
-- 17 filas con source 'preliminar-pendiente-revision':
-- 1. inserta solo lo que falta (on conflict do nothing) y no toca name, sort_order ni active
--    de las filas existentes, así que se conserva cualquier renombrado o desactivación hecha
--    desde Administración;
-- 2. reetiqueta (solo la columna source) las filas de Perú de estos 17 pares tipo/código que
--    aún tienen la etiqueta preliminar. Ninguna otra fila cambia.
-- El harness (test:rls) comprueba ambos órdenes, la idempotencia y que nada más cambia.

insert into public.education_catalog (country_code, kind, code, name, sort_order, source) values
  ('PE', 'level', 'inicial', 'Inicial', 1, 'confirmado-propietario-2026-10-07'),
  ('PE', 'level', 'primaria', 'Primaria', 2, 'confirmado-propietario-2026-10-07'),
  ('PE', 'level', 'secundaria', 'Secundaria', 3, 'confirmado-propietario-2026-10-07'),
  ('PE', 'grade', 'inicial-3', '3 años', 11, 'confirmado-propietario-2026-10-07'),
  ('PE', 'grade', 'inicial-4', '4 años', 12, 'confirmado-propietario-2026-10-07'),
  ('PE', 'grade', 'inicial-5', '5 años', 13, 'confirmado-propietario-2026-10-07'),
  ('PE', 'grade', 'primaria-1', '1.º de primaria', 21, 'confirmado-propietario-2026-10-07'),
  ('PE', 'grade', 'primaria-2', '2.º de primaria', 22, 'confirmado-propietario-2026-10-07'),
  ('PE', 'grade', 'primaria-3', '3.º de primaria', 23, 'confirmado-propietario-2026-10-07'),
  ('PE', 'grade', 'primaria-4', '4.º de primaria', 24, 'confirmado-propietario-2026-10-07'),
  ('PE', 'grade', 'primaria-5', '5.º de primaria', 25, 'confirmado-propietario-2026-10-07'),
  ('PE', 'grade', 'primaria-6', '6.º de primaria', 26, 'confirmado-propietario-2026-10-07'),
  ('PE', 'grade', 'secundaria-1', '1.º de secundaria', 31, 'confirmado-propietario-2026-10-07'),
  ('PE', 'grade', 'secundaria-2', '2.º de secundaria', 32, 'confirmado-propietario-2026-10-07'),
  ('PE', 'grade', 'secundaria-3', '3.º de secundaria', 33, 'confirmado-propietario-2026-10-07'),
  ('PE', 'grade', 'secundaria-4', '4.º de secundaria', 34, 'confirmado-propietario-2026-10-07'),
  ('PE', 'grade', 'secundaria-5', '5.º de secundaria', 35, 'confirmado-propietario-2026-10-07')
on conflict (country_code, kind, code) do nothing;

-- Dev y staging: reetiqueta las filas que creó el seed preliminar. Empareja país, tipo y
-- código (no solo código) y exige la etiqueta preliminar; solo cambia source.
update public.education_catalog c
   set source = 'confirmado-propietario-2026-10-07'
  from (values
    ('level', 'inicial'),
    ('level', 'primaria'),
    ('level', 'secundaria'),
    ('grade', 'inicial-3'),
    ('grade', 'inicial-4'),
    ('grade', 'inicial-5'),
    ('grade', 'primaria-1'),
    ('grade', 'primaria-2'),
    ('grade', 'primaria-3'),
    ('grade', 'primaria-4'),
    ('grade', 'primaria-5'),
    ('grade', 'primaria-6'),
    ('grade', 'secundaria-1'),
    ('grade', 'secundaria-2'),
    ('grade', 'secundaria-3'),
    ('grade', 'secundaria-4'),
    ('grade', 'secundaria-5')
  ) as v (kind, code)
 where c.country_code = 'PE'
   and c.kind = v.kind
   and c.code = v.code
   and c.source = 'preliminar-pendiente-revision';

-- Relaciones nivel → grado, explícitas para no depender de un patrón de códigos.
-- El trigger education_catalog_relations_check exige nivel → grado del mismo país.
insert into public.education_catalog_relations (from_id, to_id)
select l.id, g.id
from (values
  ('inicial', 'inicial-3'),
  ('inicial', 'inicial-4'),
  ('inicial', 'inicial-5'),
  ('primaria', 'primaria-1'),
  ('primaria', 'primaria-2'),
  ('primaria', 'primaria-3'),
  ('primaria', 'primaria-4'),
  ('primaria', 'primaria-5'),
  ('primaria', 'primaria-6'),
  ('secundaria', 'secundaria-1'),
  ('secundaria', 'secundaria-2'),
  ('secundaria', 'secundaria-3'),
  ('secundaria', 'secundaria-4'),
  ('secundaria', 'secundaria-5')
) as v (level_code, grade_code)
join public.education_catalog l
  on l.country_code = 'PE' and l.kind = 'level' and l.code = v.level_code
join public.education_catalog g
  on g.country_code = 'PE' and g.kind = 'grade' and g.code = v.grade_code
on conflict do nothing;
