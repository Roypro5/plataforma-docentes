-- Lanzamiento, fase A, punto 6 (endurecimiento): revoca el execute por defecto de PUBLIC en
-- la función de trigger app_private.reject_duplicate_consent().
--
-- La etapa 3 (20261004000100_stage3_modules.sql) la creó sin incluirla en su lista de
-- revoke, así que anon y authenticated la podían ejecutar por herencia de PUBLIC. No era
-- invocable (anon no tiene USAGE en app_private y una función de trigger no se puede llamar
-- directamente), pero supabase/checks/produccion.sql exige privilegios_anon = 0.
--
-- El trigger consent_records_no_duplicates sigue funcionando: PostgreSQL no comprueba el
-- privilegio EXECUTE de la función de un trigger para el rol que hace el INSERT (lo cubre
-- el harness). Independiente del catálogo pendiente: se puede aplicar ya.

revoke execute on function app_private.reject_duplicate_consent() from public, anon, authenticated;
