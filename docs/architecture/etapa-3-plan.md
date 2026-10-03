# Etapa 3 — Plan: módulos y dashboard docente

**Estado:** propuesta para aprobación del propietario (03/10/2026). No se implementa nada hasta aprobarla.
**Fuentes:** [Fase 0 rev 0.2](fase-0-rev-0.2.md) §3 y §6 (etapa 3) y [alcance aprobado](approved-scope.md), que prevalece.

## 1. Qué se entrega

Al ingresar, el docente llega a un **panel** personal con:

- Un saludo con su nombre y sus niveles/grados, sin inventar contenido.
- **Tarjetas de módulos** según su país y el estado de cada módulo; en los módulos «Próximamente», un botón **«Avísame»** que se puede retirar.
- **Avisos** vigentes que le corresponden por país, rol y plan.
- **Notificaciones in-app** privadas, con contador de no leídas y marca de leído.
- Estados vacíos claros cuando no hay avisos, notificaciones ni módulos activos.

Además: manifiesto PWA e iconos para instalar la app en el celular, **sin** página offline ni caché de datos privados.

## 2. Fuera de alcance

- IA o cualquier módulo futuro ejecutable: todos quedan en «Próximamente».
- Panel de administración para módulos y avisos (etapa 4). En esta etapa se gestionan por SQL o con el seed.
- Planes, suscripciones, checkout y desbloqueo real por derechos (etapa 5).
- Correo o WhatsApp: «Avísame» solo promete un aviso dentro de la plataforma.
- Flags por usuario, prioridades de flags, cola u outbox.

## 3. Modelo de datos (migración nueva)

Siete tablas de la lista objetivo de 26: las seis que rev 0.2 asigna a esta etapa más `entitlements`, que se adelanta. Con las 14 de la etapa 2 suman 21; las 5 restantes (planes, precios, derechos por plan, suscripciones y pagos) son de la etapa 5.

| Tabla | Contenido | Acceso |
|---|---|---|
| `modules` | id (código estable), estado (`hidden` / `coming_soon` / `active`), `implementation_available`, `emergency_disabled` | Lectura para autenticados, excepto ocultos. Sin escritura del cliente |
| `entitlements` | Único derecho: `demo.access`, booleano | Lectura para autenticados |
| `module_availability` | módulo × país, derecho requerido opcional; pareja única | Lectura para autenticados |
| `module_interests` | usuario × módulo único, país al registrarse, fecha | Alta, lectura y retirada **propias** |
| `announcements` | título y texto seguros, borrador/publicado, vigencia, autor y listas de **países, roles y planes** (lista vacía = todos; AND entre dimensiones) | Lectura solo de publicados, vigentes y de la audiencia propia; sin escritura del cliente |
| `notifications` | destinatario, tipo, contenido mínimo, enlace interno validado, leída, clave de deduplicación | Lectura y marcado de leído **propios**; inserción solo desde funciones autorizadas |
| `activity_events` | actividad mínima autenticada: inicio de sesión, onboarding completado, interés añadido o retirado | Inserción mediante función; sin lectura del cliente (métricas en etapa 4) |

Ajustes respecto de rev 0.2:

- `entitlements` se crea ahora porque `module_availability` lo referencia; `plan_entitlements`, `plans` y `subscriptions` llegan en la etapa 5. Mientras no existan, **ningún derecho está vigente**: un módulo que requiere derecho queda bloqueado, nunca abierto.
- La dimensión «plan» de los avisos usa los códigos `gratis`, `individual` e `institucional`. Hasta la etapa 5, todos los usuarios cuentan como `gratis` (ausencia de suscripción).

## 4. Resolvedor de módulos (una sola regla)

Una función decide el estado de cada módulo para cada usuario. La usan **el menú, las tarjetas y el servidor**, así que esconder una tarjeta nunca es la única protección.

Orden de comprobación: sesión y usuario activo → estado del módulo → país habilitado → apagado de emergencia → derecho requerido → entorno (el módulo demo se oculta y se deniega en producción).

| Resultado | Qué ve el docente | ¿Se puede ejecutar? |
|---|---|---|
| Oculto | Nada | No |
| Próximamente | Tarjeta + «Avísame» | No |
| Disponible | Tarjeta con acceso | Sí |
| Requiere plan | Tarjeta bloqueada, sin precios (la compra llega en la etapa 5) | No |
| Apagado | Tarjeta «No disponible temporalmente» | No |

La misma regla existe en SQL para que RLS y las funciones la apliquen, y una prueba compara ambas versiones, igual que la matriz de permisos.

## 5. Módulos iniciales

Manifiestos versionados en `artifacts/docente/src/modules/<id>/manifest.ts`, sincronizados con la tabla por migración.

| Módulo | Estado inicial | Notas |
|---|---|---|
| Generador de materiales con IA | Próximamente | Las tarjetas que ya muestra el inicio |
| Biblioteca personal | Próximamente | |
| Marketplace de materiales | Próximamente | |
| Cursos y simulacros | Próximamente | |
| Módulo demo | Activo, requiere `demo.access`; solo desarrollo y staging | Bloqueado hasta la etapa 5; sin IA ni función comercial |

## 6. Notificaciones y avisos

- **Avisos:** son un feed separado, no notificaciones. Se filtran en SQL por publicado, vigencia y audiencia. En esta etapa se crean por seed o SQL; el formulario llega en la etapa 4.
- **Notificaciones** directas, insertadas en la misma transacción que el evento:
  1. Bienvenida al completar el onboarding.
  2. «Ya está disponible» para quienes pidieron «Avísame», cuando un módulo pasa a activo. La función queda lista y probada; el disparo desde un panel llega en la etapa 4.
- La clave de deduplicación impide duplicados al repetir una acción.

## 7. Pantallas y navegación

- `/panel`: dashboard. Pasa a ser el destino tras ingresar y tras el onboarding, en lugar de `/perfil`.
- `/notificaciones`: lista paginada, marcar como leída o todas como leídas.
- `/modulos/[id]`: entrada protegida por el resolvedor. En esta etapa solo el demo tiene pantalla, y queda bloqueada hasta la etapa 5.
- Shell: campana con contador de no leídas. «Mi cuenta» pasa a «Panel» en la navegación; el perfil sigue accesible desde el panel.
- Al cerrar sesión se limpia el estado local, y las respuestas privadas siguen con `Cache-Control: private, no-store`.

## 8. Pruebas

- **SQL/RLS** (harness actual): interés propio e idempotente; no ver ni retirar intereses ajenos; notificaciones privadas y deduplicadas; avisos por país, rol, plan, borrador y vigencia; módulo oculto, próximamente, apagado y país no habilitado; derecho requerido siempre denegado sin suscripción; usuario suspendido sin acceso; nada escribible desde el cliente salvo lo previsto.
- **Unitarias:** matriz completa del resolvedor y paridad con la versión SQL.
- **Humo y axe:** `/panel` y `/notificaciones` protegidos; manifiesto PWA válido. Escritorio y 360 px.
- **Manual en staging:** demo en celular y escritorio, más la matriz de estados de módulos.

## 9. Orden de trabajo

1. Migración, seed y pruebas SQL/RLS en local.
2. Resolvedor, manifiestos y pruebas unitarias.
3. Panel, tarjetas y «Avísame».
4. Avisos y notificaciones (campana, lista, bienvenida).
5. Actividad mínima, PWA e iconos.
6. Push, CI, aplicar la migración en dev y staging (lo harás tú, como en la etapa 2, con el SQL en el portapapeles) y verificación en staging.
7. Reporte de cierre: demo y matriz de estados de módulos.

## 10. Criterios de cierre (rev 0.2)

- Menú, tarjetas y servidor coinciden para cada estado, país y apagado.
- «Avísame» es idempotente y se puede retirar.
- Los avisos respetan audiencia y vigencia; las notificaciones son privadas y se insertan directamente.
- No hay IA ni módulos futuros ejecutables.
- El perfil personaliza el saludo y la selección visual sin inventar contenido.
- No se cachean respuestas privadas ni credenciales; el logout limpia el estado local.
- Las pruebas cubren país no habilitado, módulo oculto, próximo y apagado.
- Los contratos de entitlements quedan preparados para la etapa 5.

## 11. Decisiones para el propietario

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿Los 4 módulos futuros (más el demo) y sus nombres son correctos? | Sí, son los que ya muestra el inicio |
| 2 | ¿Crear `entitlements` ahora, con el resto de los planes en la etapa 5? | Sí, para que la disponibilidad tenga su referencia real |
| 3 | ¿Notificaciones solo de bienvenida y de «módulo disponible», con los avisos como feed aparte? | Sí, es lo mínimo útil y evita duplicar contenido |
| 4 | ¿El panel pasa a ser la página de inicio tras ingresar? | Sí, `/panel`; la portada pública `/` se mantiene |
| 5 | ¿Algún aviso de ejemplo para la demo? | Uno marcado «Aviso de prueba», solo en el seed de dev y staging |
