# Instrucciones para Claude Code

Las reglas del proyecto viven en `replit.md` (heredado de Replit) y se aplican igual aquí:

@replit.md

## Notas adicionales

- Responder al propietario en español.
- Fuente de verdad del alcance: `docs/architecture/approved-scope.md`. Estado de etapas y pendientes: `docs/reports/` y `docs/runbooks/environments.md`.
- No inventar datos (tablas, textos legales, URLs de catálogos, responsables). Si falta información, pedirla y documentar el bloqueo.
- Credenciales y claves solo en los gestores seguros de cada proveedor; nunca en chat, archivos versionados ni logs.
- Entorno local: Windows. CI corre en Ubuntu con PostgreSQL efímero (`EPHEMERAL_DATABASE_URL`).

## Agentes y skills del proyecto

Agentes en `.claude/agents/` (pueden correr en segundo plano y en paralelo):

- `db-engineer`: migraciones Supabase, GRANT/RLS y pruebas del harness.
- `ui-builder`: pantallas Next.js con i18n, accesibilidad y 360 px.
- `rls-auditor`: auditoría de seguridad de solo lectura.
- `scope-guardian`: control de alcance por etapa, de solo lectura.
- `verifier`: batería completa de comprobaciones.
- `stage-reporter`: reporte de cierre de etapa.

Skills en `.claude/skills/`: `verificar`, `aplicar-sql-supabase`, `publicar` (solo con autorización del propietario) y `cerrar-etapa`, que orquesta a los agentes anteriores.

Orquestación: para cambios independientes se pueden lanzar agentes en paralelo (por ejemplo `db-engineer` y `ui-builder`) y revisar con `rls-auditor` y `scope-guardian` antes de publicar. Cada subagente y cada workflow consumen tokens adicionales: usarlos cuando el trabajo lo justifique.
