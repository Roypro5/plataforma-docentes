# Etapa 1 — Demo y reporte de verificación

**Fecha:** 02/10/2026  
**Estado:** base local implementada; etapa 1 **no cerrada**, pendiente de servicios externos y CI remoto. No se ha iniciado etapa 2.

## Demo disponible

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

## CI preparado, todavía no ejecutado remotamente

Archivo `.github/workflows/foundation.yml`:

1. Instalación con lockfile congelado.
2. Lint, typecheck y unitarias.
3. PostgreSQL efímero y prueba de infraestructura SQL/RLS con rol limitado.
4. Build.
5. Humo Playwright con axe en escritorio y móvil.
6. Reporte HTML de humo como artefacto de CI.

**No hay URL de ejecución ni resultado remoto verde.** Las pruebas de humo/axe y el harness SQL/RLS están escritos, pero no se ejecutaron en este primer build. El harness no representa las políticas del producto: esas pertenecen a etapa 2.

## Pendientes para cerrar etapa 1

| Requisito | Estado |
|---|---|
| Vercel Hobby staging | Hobby confirmado por el propietario; despliegue pendiente vía integración GitHub que conectará el propietario. No usar la API de Vercel |
| Dos proyectos Supabase Free independientes | Pendiente de configurar/verificar proyectos y acceso seguro; no se usa otra base como sustituto |
| Sentry Free | SDK y filtro preparados, sin DSN ni entrega al proveedor verificada |
| CI remoto | Workflow preparado; pendiente de repositorio autorizado y ejecución en cuota gratuita |
| Prueba de humo con axe | Pendiente de ejecución; no afirmar WCAG AA certificado |

No se contrató ningún servicio pagado, se creó infraestructura de producción ni se publicaron cuentas/credenciales. La vista previa no se presenta como un despliegue Vercel.

## Ajustes del usuario incorporados

- Gratis = ausencia de suscripción vigente.
- Role/UserRole en PostgreSQL; permisos versionados en código, sin dos tablas adicionales.
- NotificationPreference postergada.
- Audiencia en columnas de Announcement, sin tabla puente.
- Precio sandbox Individual documentado: S/ 19.90 mensual.
- El manifiesto del catálogo exigirá URL exacta del archivo oficial; no se ha importado ningún padrón.
- Lista objetivo: 26 tablas, ninguna implementada todavía.

**Siguiente acción:** conectar los servicios gratuitos necesarios y completar las verificaciones pendientes de etapa 1. No avanzar a etapa 2.