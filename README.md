# [NOMBRE] · Plataforma docente

Base de la etapa 1 para docentes peruanos. Next.js App Router, TypeScript y Tailwind, con navegación responsive, temas claro/oscuro y demostraciones de componentes sin persistencia.

## Alcance

Solo etapa 1 autorizada. No hay cuentas, pagos ni datos del producto. No avanzar a etapa 2 sin demo, reporte de CI y aprobación del propietario.

Desarrollo y staging: servicios gratuitos. El propietario confirmó Vercel Hobby y conectará este repositorio mediante la integración GitHub de Vercel. No usar la API de Vercel ni contratar servicios pagados.

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

La nueva ejecución remota debe comprobarse en GitHub Actions; los resultados locales no prueban por sí solos CI verde. El harness PostgreSQL usa únicamente una base temporal local del runner, no Supabase ni datos reales.

La etapa 1 no está cerrada: pendientes staging verificado, dos proyectos Supabase Free, recepción de errores Sentry y CI remoto.

Documentación:

- [Alcance aprobado](docs/architecture/approved-scope.md)
- [Entornos y variables](docs/runbooks/environments.md)
- [Reporte de etapa 1](docs/reports/etapa-1-verificacion.md)
- [Procedencia de catálogos, para etapa posterior](docs/catalogs/README.md)