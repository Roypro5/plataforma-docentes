# Etapa 1 — Demo y reporte de verificación

**Fecha:** 02/10/2026  
**Estado:** **etapa 1 cerrada**, con demo, CI y recepción de errores verificados, y confirmaciones del propietario registradas. La etapa 2 no está iniciada y requiere aprobación explícita.

## Demo disponible

**Demo pública:** https://plataforma-docentesstaging.vercel.app/

Proyecto Vercel `plataforma-docentes.staging`, equipo Hobby, rama `main`, Root Directory `artifacts/docente`. Despliegue realizado por el propietario y comprobado sobre su URL pública; no se utilizó la API de Vercel.

- Inicio: visión y alcance explícito de la etapa 1.
- Sistema visual: paleta, tipografía, botones, controles y validación local sin guardar datos.
- Hoja de ruta: las cinco etapas aprobadas; sin funciones IA, biblioteca o comunidad añadidas al alcance.
- Ayuda: preguntas frecuentes y contacto pendiente, sin datos inventados.
- Navegación lateral en escritorio e inferior en celular.
- Tema claro, oscuro y del sistema; solo se persiste esa preferencia.
- Next.js App Router, fuentes de sistema, traducciones/configuración centralizadas, movimiento reducido y foco visible.

## Resultados ejecutados en el entorno de desarrollo

| Comprobación | Resultado | Alcance real |
|---|---|---|
| ESLint | Aprobado | Código Next propio e instrumentación; componentes heredados no usados fuera del alcance |
| TypeScript | Aprobado | Paquete de aplicación |
| Unitarias Vitest | 3/3 aprobadas | Sanitización de telemetría, evento vacío e inmutabilidad |
| Build producción Next.js | Aprobado | Rutas de aplicación pre-renderizadas |
| Arranque del servicio | Aprobado | Next responde en vista previa |
| Rutas HTTP | Aprobado | `/`, `/sistema`, `/ayuda`, `/hoja-de-ruta`, icono: 200; ruta inexistente: 404 |
| Revisión visual escritorio | Realizada | Inicio a 1440×1000 |
| Revisión visual móvil | Realizada | Sistema visual a 360×800; primer viewport sin desbordamiento visible |

Las capturas no prueban interacciones, lectura de pantalla ni accesibilidad WCAG completa. La preferencia de tema y el comportamiento de formularios tienen implementación, pero no se declara una verificación E2E realizada.

En la primera captura aparecieron errores del WebSocket de recarga de desarrollo y del icono. Se añadió ruta explícita `/_next` al servicio e icono propio. El icono devuelve 200. La reconexión WebSocket no se ha comprobado mediante una interacción de navegador; la navegación HTTP y el render inicial funcionan.

## CI remoto aprobado

**Ejecución:** https://github.com/Roypro5/plataforma-docentes/actions/runs/37080506638  
**Commit de aplicación:** `bf8b3a4b5cbd9ce0ee7839a5eeb71363b7b0f9f0`  
**Resultado consultado:** `completed / success`, job `foundation`, todas las comprobaciones indicadas abajo aprobadas.

Archivo `.github/workflows/foundation.yml`:

1. Instalación con lockfile congelado.
2. Lint, typecheck y unitarias.
3. PostgreSQL efímero y prueba de infraestructura SQL/RLS con rol limitado.
4. Build.
5. Humo Playwright con axe en escritorio y móvil.
6. Reporte HTML de humo como artefacto de CI.

El harness no representa las políticas del producto: esas pertenecen a etapa 2. El reporte de humo fue cargado como artefacto de GitHub Actions.

**Carga al repositorio:** código y documentación subidos a `main`; el propietario añadió el workflow. La primera ejecución encontró fallos de contraste/ancho, corregidos sin modificar la prueba ni el workflow. La ejecución enlazada confirma el arreglo remotamente.

## Verificación del despliegue

- Las cuatro rutas responden HTTP 200.
- Escritorio (1280 px) y móvil (360 px): un `h1`, idioma `es-PE`, sin desbordamiento horizontal y cero violaciones en el análisis axe WCAG 2 A/AA y 2.1 AA de cada ruta.
- `noindex, nofollow` presente; no equivale a un sitio privado.
- Captura visual de inicio revisada sobre la URL real de staging.
- Error sintético emitido por el navegador del staging: ingestión Sentry HTTP 200, entorno `staging`, Event ID `1f8cfc95da1e4b708749e02280ef786d`, sin usuario, petición, contexto ni tags. Recepción e indexación confirmadas mediante búsqueda del ID exacto y entorno: issue [JAVASCRIPT-NEXTJS-1](https://proyectosderoy.sentry.io/issues/JAVASCRIPT-NEXTJS-1), proyecto `javascript-nextjs`, fecha `2026-10-03T00:36:12Z`. No se volvió a emitir el error ni se modificó el issue.

Estos resultados no certifican accesibilidad completa ni confirman la configuración interna del panel Vercel. No se cambió código ni se creó un endpoint público para provocar errores.

## Evidencias del cierre de etapa 1

| Requisito | Estado |
|---|---|
| Vercel Hobby staging | URL y funcionamiento verificados. No se usó la API de Vercel |
| Dos proyectos Supabase Free independientes | Organización `plataforma-docentes-free`; proyectos `plataforma-docentes-dev` y `plataforma-docentes-staging`, ambos `us-east-2` (Ohio), confirmados por el propietario. Sin inspección de bases ni prueba de RLS del producto; corresponden a etapa 2 |
| Sentry | Recepción/indexación verificadas en el issue enlazado; DSN manual en Vercel. Plan de facturación no inspeccionado |
| CI remoto | Aprobado; ejecución enlazada arriba |
| Prueba de humo con axe | Aprobada en CI y análisis de las cuatro rutas desplegadas a 1280/360 px; no es certificación WCAG |
| Revisión del propietario en celular | iPhone 17: «todo bien». Redmi 15C: resultado pendiente; el mensaje conserva texto de plantilla |

El propietario solicitó el cierre formal de etapa 1. El resultado del Redmi queda registrado como observación pendiente y no invalida ese cierre ni se presenta como prueba aprobada.

Supabase: Data API activada, exposición automática de tablas desactivada y RLS automático activado en ambos proyectos, según el propietario. Las futuras migraciones deberán incluir `GRANT` explícitos por tabla expuesta y políticas RLS. Staging fue recreado sin datos para alinear su región; se requerirá la URL vigente, no una referencia anterior.

No se contrató ningún servicio pagado ni se creó infraestructura de producción real del producto. No se publicaron cuentas/credenciales. La demo enlazada sí es el staging Vercel, no la vista previa local.

## Ajustes del usuario incorporados

- Gratis = ausencia de suscripción vigente.
- Role/UserRole en PostgreSQL; permisos versionados en código, sin dos tablas adicionales.
- NotificationPreference postergada.
- Audiencia en columnas de Announcement, sin tabla puente.
- Precio sandbox Individual documentado: S/ 19.90 mensual.
- El manifiesto del catálogo exigirá URL exacta del archivo oficial; no se ha importado ningún padrón.
- Lista objetivo: 26 tablas, ninguna implementada todavía.

## Qué se necesita del propietario para etapa 2

1. Aprobación explícita para iniciar etapa 2; las confirmaciones de infraestructura y revisión móvil no se interpretan como esa autorización.
2. URLs actuales de los dos proyectos Supabase Free ya confirmados, especialmente del staging recreado, y configuración mediante gestores seguros; no enviar claves ni contraseñas por chat.
3. Preparar correo y Google en Supabase Auth y sus URLs autorizadas; cualquier credencial se carga en el gestor seguro correspondiente.
4. Identidad verificada del superadmin, sin asignar roles privilegiados antes de verificarla; mantener MFA para administración.
5. Validar responsable de datos, canal de soporte y textos mínimos de consentimiento antes de habilitar registros y capturar perfiles.

El alcance ya aprobado de etapa 2 sigue siendo Auth, perfil, onboarding y esquema institucional/RLS con pruebas negativas. No se añadieron tablas, cuentas ni políticas del producto en esta verificación.