# [NOMBRE] · Plataforma docente

Plataforma para docentes peruanos. Next.js App Router, TypeScript, Tailwind y Supabase (Auth + PostgreSQL con RLS).

## Alcance

Las 5 etapas están cerradas ([reporte etapa 2](docs/reports/etapa-2-verificacion.md), [reporte etapa 3](docs/reports/etapa-3-verificacion.md), [reporte etapa 4](docs/reports/etapa-4-verificacion.md), [reporte etapa 5](docs/reports/etapa-5-verificacion.md)). El [plan de lanzamiento](docs/architecture/lanzamiento-plan.md) está propuesto y pendiente de aprobación del propietario. La etapa 2 incluye: registro e ingreso por correo y Google, recuperación, onboarding, perfil, consentimiento, eliminación de cuenta, MFA administrativo y esquema institucional con RLS. La etapa 3 añade el panel, módulos «Próximamente» con «Avísame», avisos, notificaciones y manifiesto PWA. Pagos solo de prueba (sandbox), sin cobros reales. Cada etapa se cierra con demo, reporte de CI y aprobación del propietario.

Desarrollo y staging: servicios gratuitos. El propietario desplegó staging en Vercel Hobby: https://plataforma-docentesstaging.vercel.app/. No usar la API de Vercel ni contratar servicios pagados.

## Ejecutar

Requisitos: Node.js 24 y pnpm 10.26.1.

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/docente dev
```

El servidor usa `PORT` si está definida; de lo contrario, puerto 3000.

```sh
pnpm --filter @workspace/docente lint
pnpm --filter @workspace/docente typecheck
pnpm --filter @workspace/docente test
pnpm --filter @workspace/docente build
```

Usar comandos filtrados al paquete docente. Las bibliotecas compartidas heredadas se conservan para resolver referencias del workspace, pero no son un backend del producto ni sustituyen Supabase.

## Vercel staging

- Framework: Next.js.
- Root Directory: `artifacts/docente`.
- Incluir archivos fuera de Root Directory: activado.
- Install Command: `pnpm install --frozen-lockfile`.
- Build Command: `pnpm run build`.
- Output Directory: valor predeterminado de Next.js.
- Node.js: 24.x.

Variables actuales:

| Variable | Valor | Visibilidad |
|---|---|---|
| NEXT_PUBLIC_APP_ENV | staging | Pública |
| NEXT_PUBLIC_SENTRY_DSN | DSN real del proyecto Sentry Free de pruebas | Pública; omitirla desactiva entrega de errores |

No hay secretos de servidor requeridos en etapa 1. No subir `.env` ni claves. Noindex no equivale a protección privada del despliegue.

## Verificación y pendientes

Lint, TypeScript, build y tres pruebas unitarias pasaron localmente. Las capturas se revisaron en escritorio y a 360 px.

El propietario añadió el workflow `.github/workflows/foundation.yml` al remoto. La ejecución inicial pasó las comprobaciones previas y detectó fallos de contraste y ancho móvil en humo. Estos se corrigieron en la interfaz: los dos proyectos Playwright pasan localmente, sin cambiar la prueba ni el workflow. Ver [reporte de corrección](docs/reports/correccion-smoke-accesibilidad.md).

El [CI del arreglo](https://github.com/Roypro5/plataforma-docentes/actions/runs/37080506638) terminó con éxito: lint, TypeScript, unitarias, harness SQL/RLS, build y humo/axe aprobados. El harness PostgreSQL usa únicamente una base temporal local del runner, no Supabase ni datos reales.

**Etapa 1 cerrada formalmente por solicitud del propietario:** staging, CI remoto y recepción/indexación del error sintético en Sentry verificados. El propietario confirmó dos proyectos Supabase Free independientes en `us-east-2` y revisión en iPhone 17 «todo bien»; la revisión en el Redmi 15C quedó pendiente y se resolvió el 03/10/2026 en la etapa 3. Ver detalles y límites de verificación en el reporte y runbook.

Documentación:

- [Alcance aprobado](docs/architecture/approved-scope.md)
- [Entornos y variables](docs/runbooks/environments.md)
- [Reporte de etapa 1](docs/reports/etapa-1-verificacion.md)
- [Procedencia de catálogos, para etapa posterior](docs/catalogs/README.md)