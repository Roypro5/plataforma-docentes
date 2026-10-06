-- Lanzamiento, fase A, punto 2: catálogo educativo como migración.
--
-- ATENCIÓN: NO APLICAR EN NINGÚN ENTORNO (dev, staging ni producción) hasta que el
-- propietario confirme la lista (decisión 8 de docs/architecture/lanzamiento-plan.md).
-- La lista de abajo es la PRELIMINAR que hoy está en supabase/seed.sql; NO está aprobada.
-- Si el propietario la corrige, se edita ESTE archivo antes de aplicarlo por primera vez
-- (permitido solo porque todavía no se ha aplicado en ningún proyecto Supabase). Una vez
-- aplicado, cualquier cambio irá en una migración nueva.
--
-- Por qué: supabase/seed.sql nunca se aplica en producción y el onboarding exige al menos un
-- nivel. Sin estas filas ningún docente podría terminar el registro en producción.
--
-- Contenido: estructura general de niveles y grados de la Educación Básica Regular de Perú
-- (Inicial 3, 4 y 5 años; Primaria 1.º a 6.º; Secundaria 1.º a 5.º), con los mismos códigos,
-- nombres y sort_order que el seed. Sin áreas curriculares.
--
-- source: 'preliminar-pendiente-revision', la misma etiqueta que el seed. La columna es texto
-- libre (sin check ni enum) y se muestra en Administración › Catálogos. Al confirmar la lista,
-- el propietario decide la etiqueta definitiva y se cambia aquí antes de aplicar.
--
-- Idempotente y segura en dev y staging, donde el seed ya creó estas filas: solo inserta lo
-- que falta (on conflict do nothing sobre las mismas claves que el seed) y no modifica filas
-- existentes. Consecuencia: en dev y staging las filas del seed conservan su name, sort_order
-- y source aunque aquí cambien. El harness (test:rls) comprueba que migración y seed no
-- duplican filas y que el seed no añade nada distinto de esta lista.

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
