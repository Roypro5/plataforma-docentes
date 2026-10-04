# [NOMBRE] — plataforma docente

Producto para docentes peruanos, preparado para otros países. Respetar el alcance aprobado en `docs/architecture/approved-scope.md`.

## Reglas del proyecto

- Etapas 1, 2, 3 y 4 cerradas (`docs/reports/`). **Etapa 5 autorizada el 03/10/2026** (planes sandbox, demo y pruebas finales), con plan aprobado: `docs/architecture/etapa-5-plan.md` y contrato técnico `docs/architecture/etapa-5-contrato.md`. Mostrar demo y reporte de CI al cerrar cada etapa; esperar aprobación antes de seguir.
- Stack aprobado: Next.js App Router + TypeScript + Supabase. No usar la base integrada ni cambiar a Express/Vite.
- Desarrollo y staging: presupuesto US$0; no contratar servicios pagados.
- No simular autenticación, pagos, guardado ni conectividad con terceros.
- No publicar sin confirmación. Documentar bloqueos de integraciones explícitamente.
- El usuario confirma Vercel Hobby. No usar la API de Vercel: el staging se desplegará mediante GitHub, que el usuario conectará cuando esté listo el repositorio de etapa 1.

## Ejecución

- App: `artifacts/docente`, servicio `artifacts/docente: web`.
- `pnpm --filter @workspace/docente lint`
- `pnpm --filter @workspace/docente typecheck`
- `pnpm --filter @workspace/docente test`
- `pnpm --filter @workspace/docente build`
- E2E contra staging (etapa 5): `pnpm --filter @workspace/docente test:e2e`, normalmente desde el workflow manual `.github/workflows/e2e-staging.yml`; guía en `docs/runbooks/e2e-staging.md`.
- CI: `.github/workflows/foundation.yml`.

API Server y Canvas son scaffolds preexistentes y no se usan en la app. No crear APIs CRUD allí: las operaciones del producto serán Server Actions, `/api/v1` solo callbacks.

## Documentación

- Alcance y ajustes de datos: `docs/architecture/approved-scope.md` (prevalece sobre `docs/architecture/fase-0-rev-0.2.md`).
- Migraciones SQL: `supabase/migrations/`; seed solo dev/staging: `supabase/seed.sql`; pruebas SQL/RLS: `pnpm --filter @workspace/docente test:rls`.
- Conexión Supabase de etapa 2: `docs/runbooks/supabase-etapa-2.md`.
- Variables, CI y entornos: `docs/runbooks/environments.md`.
- Reglas de procedencia de catálogos: `docs/catalogs/README.md`.