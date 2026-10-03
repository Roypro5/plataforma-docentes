# Etapa 3 — Demo y reporte de verificación

**Autorización:** el propietario autorizó la etapa 3 y aprobó su [plan](../architecture/etapa-3-plan.md), con las 5 decisiones de la sección 11 tal como se recomendaron, el 03/10/2026. Detalle técnico en el [contrato](../architecture/etapa-3-contrato.md).
**Estado:** **etapa 3 cerrada** por aprobación del propietario el 03/10/2026, con todas las pruebas aprobadas en staging. El propietario autorizó iniciar la etapa 4 a partir de un plan que debe aprobar antes de implementarse.

**Demo:** https://plataforma-docentesstaging.vercel.app (`/panel`, `/notificaciones`, `/modulos/demo`).

## Implementado

- Migración `supabase/migrations/20261004000100_stage3_modules.sql`: 7 tablas nuevas (`modules`, `entitlements`, `module_availability`, `module_interests`, `announcements`, `notifications`, `activity_events`) con RLS y privilegios explícitos; con las 14 de la etapa 2 suman 21. Funciones `app_private.module_access` (única fuente de verdad del estado de cada módulo), `list_my_modules`, `register_module_interest`, `withdraw_module_interest`, `mark_notifications_read` y `record_session_started`, y triggers de bienvenida y de «módulo disponible».
- Seed de desarrollo/staging: disponibilidad del módulo demo (requiere `demo.access`) y un aviso marcado «Aviso de prueba». Nunca debe cargarse en producción.
- Registro de módulos en la app (`artifacts/docente/src/modules/registry.ts`): generador de materiales con IA, biblioteca personal, marketplace y cursos y simulacros en «Próximamente»; módulo demo solo en desarrollo y staging, bloqueado hasta la etapa 5. Sin IA ni módulos futuros ejecutables.
- `/panel` (destino tras ingresar y tras el onboarding): saludo con nombre, niveles y grados, tarjetas de módulos con «Avísame» retirable, avisos vigentes por audiencia y estados vacíos.
- `/notificaciones` (lista, marcar una o todas como leídas), campana con contador de no leídas y `/modulos/[id]`, que vuelve a comprobar el acceso en el servidor.
- Manifiesto PWA e iconos 192 y 512, sin service worker ni caché de datos privados.

## Criterios de cierre del plan (§10)

| Criterio | Estado | Evidencia |
|---|---|---|
| Menú, tarjetas y servidor coinciden para cada estado, país y apagado | ✅ | Una sola regla en SQL (`app_private.module_access`) usada por tarjetas y servidor; harness SQL/RLS y Vitest. El «menú» coincide de forma trivial: el menú lateral no tiene entradas por módulo (solo Panel) |
| «Avísame» es idempotente y se puede retirar | ✅ | Harness SQL/RLS; el propietario comprobó en staging que persiste y se retira |
| Avisos respetan audiencia y vigencia; notificaciones privadas e insertadas directamente | ✅ | Harness SQL/RLS (país, rol, plan, borrador, vigencia, aislamiento entre usuarios); en staging se vio el «Aviso de prueba» y la notificación de bienvenida |
| No hay IA ni módulos futuros ejecutables | ✅ | Los 4 módulos futuros quedan en «Próximamente»; el demo está bloqueado por derecho |
| El perfil personaliza el saludo y la selección visual sin inventar contenido | ✅ | Verificado por el propietario en staging (saludo, niveles y grados) |
| No se cachean respuestas privadas ni credenciales; el logout limpia el estado local | ✅ | Build con todas las rutas privadas dinámicas y `Cache-Control: private, no-store`; la campana no consulta al servidor sin cookie de sesión |
| Las pruebas cubren país no habilitado, módulo oculto, próximo y apagado | ✅ | Harness SQL/RLS y matriz del resolvedor en Vitest |
| Contratos de entitlements preparados para la etapa 5 | ✅ | `entitlements` y `module_availability.required_entitlement` creados; `has_entitlement` devuelve siempre `false` hasta la etapa 5, así que un módulo con derecho requerido queda bloqueado, nunca abierto |

## Verificación automatizada

| Comprobación | Resultado |
|---|---|
| Lint y TypeScript | Aprobado |
| Vitest | 28/28 |
| Harness SQL/RLS sobre PostgreSQL efímero | 45/45 (incluye 13 comprobaciones de la etapa 3 del agente de base de datos y 1 de límites de abuso añadida tras la revisión) |
| Pruebas de mutación | 6 de 7 mutaciones iniciales detectadas; la no detectada (la condición `null → valor` del trigger de bienvenida) es redundante con la clave única de deduplicación. Además, 2 mutaciones sobre las defensas posteriores a la revisión fueron detectadas |
| Build Next.js | Aprobado; todas las rutas privadas dinámicas |
| Playwright + axe (escritorio y 360 px) | 10/10 |
| CI remoto | [Ejecución exitosa](https://github.com/Roypro5/plataforma-docentes/actions/runs/37135557380) del commit `c6c2baf` |

Qué no certifica: axe detecta una parte de los problemas de accesibilidad y no es una certificación WCAG; el harness usa una emulación de Supabase sobre PostgreSQL efímero, no el servicio real (eso lo cubre la prueba manual en staging); las mutaciones no prueban ausencia total de defectos.

## Verificación en Supabase real y staging, 03/10/2026

Realizada por el propietario sobre https://plataforma-docentesstaging.vercel.app.

| Prueba | Resultado |
|---|---|
| Migración `20261004000100_stage3_modules.sql` y `seed.sql` aplicados en `plataforma-docentes-dev` y `plataforma-docentes-staging`; consulta de comprobación: 21 tablas con RLS, 5 módulos, 5 filas de disponibilidad y 1 aviso, en ambos | ✅ |
| Panel: saludo, niveles y grados, 4 módulos «Próximamente», demo con «Requiere plan» y «Aviso de prueba» | ✅ |
| «Avísame»: se activa, persiste al recargar y se puede retirar | ✅ |
| `/modulos/demo` bloqueado | ✅ |
| Cuenta de prueba nueva: notificación de bienvenida, contador de la campana y «marcar todas como leídas» | ✅ |
| PWA instalada y mostrada correctamente en iPhone 17 y Redmi 15C | ✅ Resuelve también la revisión del Redmi 15C pendiente desde la etapa 1 |

Estas pruebas son confirmaciones del propietario («ya probé todo y está ok»), no una ejecución automatizada.

## Orquestación

| Trabajo | Agente y modelo |
|---|---|
| Contrato técnico | Orquestador (Opus 5.5) |
| Base de datos y RLS | Agente DB/RLS (Opus 5.5) |
| Registro de módulos y PWA | Agente (Sonnet 5.5) |
| Interfaz | Agente UI (Sonnet 5.5) |
| Revisión en paralelo | Auditoría de seguridad (Opus 5.5): 0 críticos o altos, 1 medio, 4 bajos; revisión de alcance (Sonnet 5.5); verificador (Sonnet 5.5) |
| Correcciones | Orquestador (Opus 5.5) |

Commits de la etapa: `6c8adbe` (plan y contrato), `1f75f57` (registro de módulos, regla de entorno, textos y manifiesto PWA), `da60c73` (esquema), `912364d` (panel, notificaciones, páginas de módulo y navegación) y `c6c2baf` (correcciones de la revisión).

## Hallazgos y correcciones

Corregidos en `c6c2baf`:

- `activity_events` podía crecer sin límite repitiendo las RPC: ahora hay ventana de deduplicación (30 min para sesiones, 24 h para intereses).
- Registros de consentimiento duplicados: un trigger rechaza el mismo usuario, documento y versión. Afecta a una tabla de la etapa 2 sin modificar filas existentes.
- La notificación `module_available` se envía solo cuando el módulo es realmente utilizable para cada usuario interesado y activo en un país habilitado.
- `announcements`: privilegio por columna; `author_user_id` queda oculto al cliente.
- `/modulos/[id]` oculta los módulos solo de desarrollo en producción aunque falle la RPC.
- La campana no llama al servidor sin cookie de sesión y devuelve vacío para usuarios inactivos.
- Textos visibles de la etapa, insignia y metadatos del layout actualizados.
- `NEXT_PUBLIC_APP_ENV` y el seed quedan documentados como sensibles en producción en los runbooks.

## Pendientes no bloqueantes de la etapa 3

- Configurar Auth del proyecto **dev** (Site URL `http://localhost:3000`, Redirect URLs y Google) cuando se necesite desarrollo local contra Supabase.
- Pantalla de consentimiento de Google en modo *Testing*: publicarla requiere revisión de Google antes del lanzamiento.
- La gestión de módulos y avisos desde un panel pertenece a la etapa 4; hoy se hace por SQL o seed.

## Pendientes antes de usuarios reales

SMTP propio (el integrado envía unos 2 correos por hora), importación del padrón oficial MINEDU, revisión del catálogo educativo, textos legales, responsable de datos y canal de soporte.

## Aprobación

La etapa 3 quedó **cerrada** el 03/10/2026 con la aprobación explícita del propietario.
