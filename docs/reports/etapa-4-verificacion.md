# Etapa 4 — Demo y reporte de verificación

**Autorización:** el propietario autorizó la etapa 4 y aprobó su [plan](../architecture/etapa-4-plan.md), con las 6 decisiones de la sección 8 tal como se recomendaron, el 03/10/2026. Detalle técnico en el [contrato](../architecture/etapa-4-contrato.md), incluida su sección «Correcciones de la auditoría».
**Estado:** **etapa 4 cerrada** por aprobación del propietario el 03/10/2026, con todas las pruebas aprobadas en staging. El propietario autorizó iniciar la etapa 5 a partir de un plan que debe aprobar antes de implementarse.

**Demo:** https://plataforma-docentesstaging.vercel.app (`/admin`, accesible solo para admin y superadmin con MFA, desde «Mi cuenta»).

## Implementado

- Migración `supabase/migrations/20261005000100_stage4_admin.sql`, **sin tablas nuevas**:
  - 29 funciones `admin_*`, cada una con permiso de la matriz, usuario activo, sesión aal2 y registro en la auditoría;
  - matriz de permisos ampliada con los 7 permisos de la sección 4 del plan (24 filas en total);
  - 2 triggers nuevos: `profiles_territory_active` y `profile_education_selections_active`.
- Panel `/admin` con menú propio (desplegable en el celular) y siete secciones:
  - **Usuarios:** búsqueda por correo o nombre, filtros por estado y rol, paginación de 20, suspender y reactivar, otorgar y retirar roles. Solo muestra correo, nombre, país, estado, roles y fecha de alta, y no ofrece acciones sobre la propia cuenta.
  - **Módulos:** estado, países habilitados y apagado de emergencia. No permite activar un módulo sin código ni el demo en producción.
  - **Avisos:** borradores, audiencia (países, roles de plataforma, planes), vigencia, vista previa en texto plano, publicar y despublicar.
  - **Catálogos:** activar, desactivar y renombrar regiones, UGEL, niveles y grados; sin crear códigos nuevos.
  - **Organizaciones de prueba:** crear y desactivar organizaciones con su workspace, y agregar o retirar miembros existentes con rol docente o director.
  - **Métricas:** registros por día, usuarios activos (1, 7 y 30 días), distribución por región, nivel y grado, e interés por módulo; la conversión se muestra como «Sin datos hasta la etapa 5». Son funciones con control de permiso, no vistas.
  - **Auditoría:** consulta de las acciones administrativas con filtros y paginación.
- Confirmación accesible antes de suspender, retirar roles, apagar un módulo o despublicar un aviso.
- Textos públicos actualizados a la etapa 4 (portada, hoja de ruta, ayuda y `product.stage = 4`), con la aclaración de que, hasta la etapa 5, todas las cuentas tienen el plan Gratis.
- Decisión del propietario: se probó un enlace «Administración» en el menú lateral y se quitó antes de publicar. El acceso sigue siendo desde «Mi cuenta».

## Criterios de cierre del plan (§7)

| Criterio | Estado | Evidencia |
|---|---|---|
| Búsqueda, filtros y paginación funcionan; la suspensión se aplica en servidor | ✅ | Harness SQL/RLS; el propietario probó búsqueda, filtros, suspensión y reactivación en staging |
| Admin no puede otorgar admin ni superadmin; creador y revisor siguen sin asignaciones | ✅ | Harness SQL/RLS (`admin.roles.grant_privileged` solo de superadmin) |
| Se pueden crear organizaciones de prueba y sus workspaces, sin invitaciones ni interfaz de director | ✅ | Harness; el propietario creó una organización de prueba y agregó y retiró a un miembro por correo en staging |
| El admin cambia estado, país y apagado de módulos sin tocar código; no activa código inexistente ni el demo en producción | ✅ | Harness; el propietario comprobó el apagado de emergencia de un módulo y su efecto en `/panel` |
| Las consultas de métricas se validan contra un dataset conocido y respetan permisos | ✅ | Harness con cifras esperadas exactas, excluyendo el seed; en staging se vieron las métricas sin el seed |
| Los cambios administrativos relevantes quedan auditados | ✅ | Harness (cada acción deja su registro); el propietario vio en staging la auditoría con las acciones realizadas |
| No hay tablas agregadas, flags por usuario ni acceso excepcional de soporte | ✅ | La migración no crea tablas; el admin no ve perfiles completos ni entra como otro usuario |

## Verificación automatizada

Comprobaciones locales en Windows con PostgreSQL 17 portable:

| Comprobación | Resultado |
|---|---|
| Lint y TypeScript | Sin errores |
| Vitest | 116/116 (14 archivos) |
| Harness SQL/RLS (`test:rls`) | 67/67 (45 al cerrar la etapa 3) |
| Pruebas de mutación del harness | Funciones iniciales: 15/15 detectadas. Correcciones de la auditoría: 17/17 detectadas; tres solo las detecta un control estático del cuerpo de las funciones, porque el caso concurrente no se puede ejecutar en una sola transacción |
| Build Next.js | Aprobado: 34 páginas, 10 rutas `/admin` dinámicas |
| Playwright + axe (escritorio y 360 px) | 10/10; ahora cubre que las 8 rutas nuevas de `/admin` redirigen a `/ingresar` sin sesión |
| CI remoto (Foundation CI) | [Ejecución exitosa](https://github.com/Roypro5/plataforma-docentes/actions/runs/37162784299) (37162784299) del commit `d437a7e`, en 2 min 1 s |

Qué no certifica: axe detecta una parte de los problemas de accesibilidad y no es una certificación WCAG; el harness usa una emulación de Supabase sobre PostgreSQL efímero, no el servicio real (eso lo cubre la prueba manual en staging); las mutaciones no prueban ausencia total de defectos; el control estático de tres mutaciones no reemplaza una prueba concurrente.

## Verificación en Supabase real y staging, 03/10/2026

La migración fue aplicada por el propietario en el SQL Editor de Supabase, primero en `plataforma-docentes-dev` y luego en `plataforma-docentes-staging`. La consulta de comprobación dio en ambos proyectos: **29** funciones `admin_*`, **24** filas de la matriz de permisos y **2** triggers nuevos (`profiles_territory_active` y `profile_education_selections_active`).

Pruebas manuales del propietario sobre https://plataforma-docentesstaging.vercel.app, desde PC y Redmi 15C, con resultado «todo ok». Acceso a `/admin` con MFA y las 7 tarjetas visibles, más:

| # | Prueba | Resultado |
|---|---|---|
| 1 | Usuarios: búsqueda y filtros, sin acciones sobre la propia cuenta | ✅ |
| 2 | Suspender y reactivar una cuenta docente | ✅ |
| 3 | Apagado de emergencia de un módulo, reflejado en `/panel` | ✅ |
| 4 | Aviso: borrador, vista previa, publicación visible para el docente y despublicación | ✅ |
| 5 | Desactivar y reactivar una región sintética, con efecto en el onboarding | ✅ |
| 6 | Crear una organización de prueba, y agregar y retirar a un miembro por correo | ✅ |
| 7 | Métricas sin el seed, y conversión «Sin datos hasta la etapa 5» | ✅ |
| 8 | Auditoría con las acciones realizadas | ✅ |
| 9 | Celular: menú desplegable y sin desplazamiento lateral | ✅ |

Estas pruebas son confirmaciones del propietario («todo ok»), no una ejecución automatizada.

## Orquestación

| Trabajo | Agente y modelo |
|---|---|
| Contrato técnico | Orquestador (Opus 5.5) |
| Funciones SQL, permisos y harness | `db-engineer` (Opus 5.5) |
| Pantallas de usuarios, módulos y auditoría | `ui-builder` (Sonnet 5.5) |
| Pantallas de avisos, catálogos, organizaciones y métricas | `ui-builder`, en paralelo (Sonnet 5.5) |
| Revisión en paralelo | `rls-auditor` (Opus): 0 críticos, 0 altos, 2 medios y 7 bajos; `scope-guardian` (Sonnet): sin bloqueantes; `verifier` (Sonnet): todas las comprobaciones pasaron |
| Correcciones | Orquestador (Opus 5.5) |
| Reporte de cierre | `stage-reporter` |

Commits de la etapa, publicados en `main`:

- `c48c778`: esquema, funciones administrativas y harness.
- `d437a7e`: panel `/admin` con las 7 secciones.

Se publicaron junto con `9a9599e` y `ba6fa14`, que pertenecen a la etapa 3.

## Hallazgos y correcciones

**scope-guardian:** sin bloqueantes. Se corrigieron dos textos inexactos del panel y los textos públicos que seguían en la etapa 3 (portada, hoja de ruta, ayuda y `product.stage = 4`). Se añadió la aclaración de que, hasta la etapa 5, todas las cuentas tienen el plan Gratis.

**rls-auditor:** 0 críticos, 0 altos, 2 medios y 7 bajos. Corregidos en la misma migración, antes de aplicarla (detalle en el contrato):

- M1: siempre queda un superadmin activo, con lock que serializa las llamadas concurrentes. Además, otorgar o retirar roles sobre uno mismo devuelve `42501`.
- M2: un catálogo inactivo no se puede elegir (triggers sobre `profiles` y `profile_education_selections`); `save_education_selection` guarda por diferencia para conservar selecciones antiguas.
- B1: se validan los códigos de rol, y retirar un rol audita solo si hubo cambio.
- B2: un administrador no puede agregarse a sí mismo a una organización.
- B3: no se deshabilita una disponibilidad con derecho requerido.
- B4: la audiencia de avisos acepta solo roles de plataforma (sin «director»).
- B5: las longitudes de título y texto no se recortan; si exceden el límite se rechazan.

Aceptados con motivo:

- B6: el término de búsqueda de usuarios queda en la URL y, por tanto, en el historial del navegador. Solo lo ven administradores con MFA.
- B7: las métricas por región no tienen umbral mínimo. Solo las ven administradores con MFA y el dataset de staging es pequeño; conviene revisar un umbral cuando haya usuarios reales.

## Fuera de alcance, sin cambios

- Planes, pagos y conversión (etapa 5).
- Invitaciones e interfaz de director.
- Acceso de soporte a datos privados.
- Tablas nuevas (ninguna).
- Importar el padrón MINEDU.

## Pendientes no bloqueantes de la etapa 4

- B6 y B7, aceptados como se indica arriba.
- Pantalla de consentimiento de Google en modo *Testing*: publicarla requiere revisión de Google antes del lanzamiento.

## Pendientes antes de usuarios reales

Se arrastran de etapas anteriores: SMTP propio (el integrado envía unos 2 correos por hora), importación del padrón oficial MINEDU, revisión del catálogo educativo, textos legales, responsable del tratamiento de datos, canal de soporte y pantalla de consentimiento de Google en modo *Testing*.

## Aprobación

La etapa 4 quedó **cerrada** el 03/10/2026 con la aprobación explícita del propietario.
