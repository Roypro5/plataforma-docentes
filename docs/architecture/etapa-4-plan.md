# Etapa 4 — Plan: administración mínima

**Estado:** propuesta para aprobación del propietario (03/10/2026). No se implementa nada hasta aprobarla.
**Fuentes:** [Fase 0 rev 0.2](fase-0-rev-0.2.md) §4 y §6 (etapa 4) y [alcance aprobado](approved-scope.md), que prevalece.

## 1. Qué se entrega

Un **panel de administración** en `/admin`, solo para admin y superadmin **con MFA** (ya existe el acceso y el enrolamiento TOTP de la etapa 2), con siete secciones:

| Sección | Qué permite |
|---|---|
| **Usuarios** | Buscar por correo o nombre, filtrar por estado y rol, paginar; suspender y reactivar; otorgar y retirar roles |
| **Módulos** | Cambiar estado (oculto, próximamente, activo), países habilitados y apagado de emergencia, sin tocar código |
| **Avisos** | Crear y editar borradores, definir audiencia (países, roles, planes) y vigencia, publicar y despublicar |
| **Catálogos** | Activar o desactivar y renombrar regiones, UGEL, niveles y grados |
| **Organizaciones de prueba** | Crear y desactivar organizaciones (con su workspace) y agregar o retirar miembros existentes con rol docente o director |
| **Métricas** | Registros por día, usuarios activos (1, 7 y 30 días), distribución por región, nivel y grado, e interés por módulo |
| **Auditoría** | Consultar las acciones administrativas con filtros y paginación |

## 2. Fuera de alcance

- Planes, precios, pagos y conversión: llegan en la etapa 5. La métrica de conversión aparece como «sin datos hasta la etapa 5».
- Invitaciones, interfaz de director o autoservicio de organizaciones.
- Acceso de soporte a datos privados: el admin no ve perfiles completos ni puede entrar como otro usuario.
- Importar el padrón MINEDU: requiere el archivo oficial y su manifiesto (docs/catalogs). La pantalla de catálogos solo mantiene lo que ya existe.
- Flags por usuario, tablas agregadas de métricas (DailyMetric) o cualquier tabla nueva: esta etapa no crea tablas.

## 3. Reglas de seguridad (rev 0.2 §4)

- Toda acción administrativa es una **función SQL autorizada**: exige el permiso de la matriz, usuario activo y sesión **aal2**, y queda **auditada**. Las pantallas solo llaman a esas funciones; esconder un botón nunca es la protección.
- **Admin no puede otorgar admin ni superadmin**; solo un superadmin puede hacerlo. Creador y revisor siguen sin asignarse. Ya está así desde la etapa 2.
- Las **métricas** son funciones con control explícito de permiso, no vistas: una vista podría saltarse RLS con los privilegios de su dueño.
- **Datos personales mínimos** en la lista de usuarios: correo, nombre, país, estado, roles y fecha de alta. Nada de región, UGEL, institución ni niveles individuales.
- El módulo **demo** no puede activarse en producción, y no se puede activar un módulo cuyo código no existe (`implementation_available = false`).
- La suspensión ya se aplica en servidor desde la etapa 2: RLS bloquea a la cuenta suspendida aunque su sesión siga vigente.

## 4. Cambios en la base de datos (una migración, sin tablas nuevas)

- **Matriz de permisos ampliada** (código y SQL a la vez):

  | Permiso | admin | superadmin |
  |---|---|---|
  | `admin.users.read` | ✅ | ✅ |
  | `admin.modules.manage` | ✅ | ✅ |
  | `admin.announcements.manage` | ✅ | ✅ |
  | `admin.catalogs.manage` | ✅ | ✅ |
  | `admin.orgs.manage` | ✅ | ✅ |
  | `admin.metrics.read` | ✅ | ✅ |
  | `admin.audit.read` | ✅ | ✅ |

  Se suman a los permisos de la etapa 2; `admin.roles.grant_privileged` sigue siendo solo de superadmin.
- **Funciones** `public.admin_*` para cada acción y consulta de la tabla anterior, todas auditadas. Las consultas de lectura solo auditan las que exponen datos personales: la búsqueda de usuarios.
- **Pruebas en el harness:**
  - Cada función rechaza a anon, a un docente, a un admin sin MFA y a un admin suspendido.
  - Admin no otorga roles privilegiados.
  - Las métricas se validan contra un **conjunto de datos conocido** con cifras esperadas exactas, excluyendo el seed.
  - Cada acción deja su registro en la auditoría.

## 5. Pantallas

- `/admin` con menú propio (las 7 secciones); en el celular, menú desplegable.
- Tablas con búsqueda, filtros y paginación del lado del servidor (20 por página).
- Confirmación antes de suspender, retirar roles, apagar un módulo o despublicar un aviso.
- Avisos: vista previa en texto plano antes de publicar.
- Métricas: tablas con cifras y barras simples, sin librerías nuevas, y con «ninguno» cuando no hay datos.
- Accesibilidad y 360 px igual que en etapas anteriores.

## 6. Orquestación con agentes

| Fase | Agente | Modelo |
|---|---|---|
| Contrato técnico (nombres de funciones y permisos) | Orquestador | Opus 5.5 |
| Funciones SQL, permisos y pruebas del harness | `db-engineer` | **Opus 5.5** (seguridad crítica) |
| Pantallas de usuarios, módulos y auditoría | `ui-builder` | Sonnet 5.5 |
| Pantallas de avisos, catálogos, organizaciones y métricas | `ui-builder` (en paralelo, en archivos distintos) | Sonnet 5.5 |
| Revisión en paralelo | `rls-auditor` / `scope-guardian` / `verifier` | **Opus** / Sonnet / Sonnet |
| Correcciones | Orquestador | Opus 5.5 |
| Reporte de cierre | `stage-reporter` | Sonnet 5.5 |

Después: un único push, la migración aplicada por el propietario en dev y staging con el SQL en el portapapeles, verificación manual en staging y reporte para aprobación.

## 7. Criterios de cierre (rev 0.2)

- Búsqueda, filtros y paginación funcionan; la suspensión se aplica en servidor.
- Admin no puede otorgar admin/superadmin; creador y revisor siguen sin asignaciones.
- Se pueden crear organizaciones de prueba y sus workspaces, sin interfaz de invitaciones ni de director.
- El admin cambia estado, país y apagado de módulos sin tocar código; no activa código inexistente ni el demo en producción.
- Las consultas de métricas se validan contra un dataset conocido y respetan permisos.
- Los cambios administrativos relevantes quedan auditados.
- No hay tablas agregadas, flags por usuario ni acceso excepcional de soporte.

Cierre: demo administrativa en staging y contraste de cifras con el seed.

## 8. Decisiones para el propietario

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿La lista de usuarios muestra solo correo, nombre, país, estado, roles y fecha de alta? | Sí: lo mínimo para administrar, sin datos docentes detallados |
| 2 | ¿Catálogos: solo activar/desactivar y renombrar, sin crear códigos nuevos? | Sí: los códigos oficiales llegan con la importación del padrón |
| 3 | ¿Organizaciones de prueba: crear y desactivar, más agregar o retirar miembros **existentes** con rol docente o director? | Sí: sirve para probar el aislamiento sin invitaciones |
| 4 | ¿Avisos: despublicar en lugar de borrar? | Sí: se conserva el historial y la auditoría |
| 5 | ¿Métricas: las 4 de rev 0.2, dejando la conversión para la etapa 5? | Sí: la conversión depende de los planes sandbox |
| 6 | ¿Admin y superadmin pueden ver toda la auditoría? | Sí; se puede restringir a superadmin si lo prefieres |
