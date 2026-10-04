# Etapa 5 — Plan: planes sandbox, módulo demo y pruebas finales

**Estado:** propuesta para aprobación del propietario (03/10/2026). No se implementa nada hasta aprobarla.
**Fuentes:** [Fase 0 rev 0.2](fase-0-rev-0.2.md) §2, §3, §4 y §6 (etapa 5), y el [alcance aprobado](approved-scope.md), que prevalece.

## 1. Qué se entrega

| Pieza | Qué permite |
|---|---|
| **Planes** (`/planes`) | Comparar Gratis e Individual. Institucional existe, pero queda **oculto**. Individual cuesta **S/ 19.90 al mes, solo como precio de prueba**. |
| **Checkout sandbox** | Elegir Individual, confirmar y pasar por una **pasarela de prueba** claramente etiquetada, donde se elige el resultado: aprobado, rechazado, pendiente o cancelado. **No hay dinero ni tarjetas reales.** |
| **Mi plan** (`/mi-plan`) | Ver el plan vigente y su periodo, cancelar al final del periodo y ver el historial de pagos de prueba. |
| **Módulo demo** | Con Individual vigente, el demo pasa a «Disponible» y muestra una pantalla simple sin IA ni funciones comerciales. Con Gratis sigue bloqueado. |
| **Admin: Planes y pagos** | Inspección **de solo lectura** de suscripciones y pagos para validar las pruebas, más la métrica de **conversión** (primera activación de Individual), etiquetada como prueba. |
| **Pruebas finales** | E2E mínimos, revisión manual de accesibilidad en Android y documentación operativa con los pendientes de lanzamiento. |

## 2. Fuera de alcance

- Pasarela real, cobros, tarjetas, webhooks y facturación. `PaymentEvent` y `PlanVersion` se añadirán **antes** de una pasarela real, no ahora.
- Renovación automática y prorrateo. No hay cron.
- Plan Institucional visible, compras para organizaciones e interfaz de director.
- Editor comercial de planes y precios, reembolsos y cupones.
- Desbloquear cualquier capacidad real en producción con pagos sandbox.
- Preparar el lanzamiento: requiere una **autorización separada** al cerrar esta etapa.

## 3. Reglas (rev 0.2 §2 y §3)

- **Gratis es ausencia de suscripción vigente.** No se crea una suscripción de importe cero.
- **Una sola suscripción vigente por workspace.** Los derechos personales e institucionales **nunca se suman**. Esta etapa solo vende en el contexto personal.
- **Snapshot:** la suscripción guarda el precio, el periodo y los derechos con los que se activó. Un cambio futuro de condiciones no reescribe las suscripciones vigentes.
- **El servidor fija el precio y el contexto.** El navegador nunca envía importes.
- **Flujo de pago:**
  1. se crea un **pago pendiente**;
  2. el adaptador sandbox resuelve el resultado;
  3. una sola transacción actualiza el pago y la suscripción;
  4. esa misma transacción crea la notificación y el registro de auditoría.
- **Idempotencia y orden:**
  - un pago solo admite transiciones válidas desde pendiente;
  - repetir el mismo resultado no duplica efectos;
  - un resultado tardío no revierte una aprobación;
  - un pendiente vence a los 30 minutos (decisión 3), evaluado al consultarlo, sin cron.
- **La vuelta del navegador nunca acredita un pago.** La página de resultado solo lee el estado guardado en la base.
- **Cancelar** conserva los derechos hasta `current_period_end`. Cada autorización compara fechas, así que no hace falta un proceso que retire el acceso al vencer.
- **El sandbox nunca funciona en producción.** La pasarela de prueba solo se habilita en dev y staging mediante el seed, que nunca se aplica en producción. En producción la función que resuelve pagos se niega siempre.
  - Doble defensa: el demo, único derecho que existe, ya está oculto y denegado en producción.
- **Todo importe aparece etiquetado como «prueba»** en planes, checkout, Mi plan, notificaciones y administración.

## 4. Cambios en la base de datos (una migración)

**5 tablas nuevas**, con lo que el esquema llega a las **26 tablas** del alcance aprobado:

| Tabla | Contenido |
|---|---|
| `plans` | `gratis`, `individual` e `institucional` (oculto); ámbito personal o institucional; activo y visible |
| `plan_prices` | Plan, país, moneda, importe en unidades menores (PE: `PEN 1990`), periodo mensual y activo. Un precio ya referenciado no se modifica |
| `plan_entitlements` | Individual → `demo.access`. Gratis e Institucional no conceden derechos |
| `subscriptions` | Workspace, plan, precio, estado, periodo, cancelación al final y snapshot de las condiciones |
| `payments` | Suscripción, importe y moneda congelados, proveedor `sandbox`, estado, referencia única del resultado, clave de idempotencia y vencimiento |

Además:
- **Funciones:**
  - `has_entitlement` y `current_plan_code` dejan de ser fijas y leen la suscripción personal vigente;
  - funciones `public.*` para iniciar el checkout, resolver el pago sandbox, cancelar y reanudar, consultar Mi plan y la inspección administrativa (permiso nuevo `admin.billing.read`).
- **RLS:** cada usuario ve solo las suscripciones y los pagos de su propio workspace. Ninguna escritura directa desde el cliente.
- **Notificaciones nuevas:** «Tu plan Individual de prueba está activo» y «Pago de prueba rechazado».
- **Pruebas en el harness:**
  - Gratis no ejecuta el demo; Individual vigente sí; ningún otro módulo se desbloquea.
  - Cada resultado del pago: rechazo, pendiente, cancelación del checkout, repetición, resultado fuera de orden y vencimiento.
  - Cancelar mantiene el acceso hasta el fin del periodo; al vencer se pierde.
  - Sin privilegios cruzados entre contextos personal e institucional.
  - Nadie lee los pagos de otro usuario.
  - El sandbox se rechaza sin la habilitación del seed (simulación de producción).
  - Las audiencias por plan de los avisos funcionan.
  - La conversión se valida con un dataset conocido.

## 5. Pantallas

- `/planes`: comparación accesible a 360 px y el aviso «Precios de prueba: no se cobra dinero real».
- `/planes/checkout`: resumen que fija el servidor y botón «Continuar a la pasarela de prueba».
- `/planes/sandbox/[pago]`: página **«Pasarela de prueba (sandbox)»**, con aspecto claramente distinto de un pago real, y botones Aprobar, Rechazar, Dejar pendiente y Cancelar. No pide datos de tarjeta.
- `/planes/resultado`: lee el estado real del pago y ofrece «Ir al demo» o «Intentar de nuevo».
- `/mi-plan`: plan, periodo, cancelar o reanudar (con confirmación) e historial de pagos de prueba. Enlace desde «Mi cuenta» y desde el panel.
- `/modulos/demo`: pantalla simple que confirma el acceso concedido por `demo.access`.
- `/admin/planes-pagos`: listas de solo lectura con filtros. En Métricas aparece la conversión «de prueba».

## 6. Orquestación con agentes

| Fase | Agente | Modelo |
|---|---|---|
| Contrato técnico (tablas, funciones, estados y errores) | Orquestador | Opus 5.5 |
| Migración, RLS, funciones y pruebas del harness | `db-engineer` | **Opus 5.5** (pagos y permisos) |
| Planes, checkout, pasarela de prueba, resultado y Mi plan | `ui-builder` A | Sonnet 5.5 |
| Demo, admin de planes y pagos, conversión y suite E2E | `ui-builder` B (en paralelo, en archivos distintos) | Sonnet 5.5 |
| Revisión en paralelo | `rls-auditor` / `scope-guardian` / `verifier` | **Opus** / Sonnet / Sonnet |
| Correcciones | Orquestador | Opus 5.5 |
| Documentación operativa y reporte de cierre | `stage-reporter` | Sonnet 5.5 |

Después:
- un único push;
- la migración y el seed (que añade la habilitación del sandbox), aplicados por el propietario en dev y staging;
- pruebas en staging;
- el reporte final.

## 7. Criterios de cierre (rev 0.2)

- Gratis no puede ejecutar el demo; Individual vigente sí; ningún otro módulo se desbloquea por accidente.
- Están probados el rechazo, el pendiente, la cancelación del checkout, la repetición, el resultado fuera de orden y el vencimiento.
- Cancelar la suscripción mantiene el acceso hasta el fin del periodo, sin prorrateo ni renovación automática.
- No hay privilegios cruzados entre contextos personales e institucionales.
- El demo está oculto y denegado en producción, incluso por acceso directo.
- Todo importe está etiquetado como sandbox; no hay dinero ni tarjetas reales.
- La CI pasa lint, typecheck, unitarias, SQL/RLS y humo con axe.
- Los E2E mínimos están cubiertos según la decisión 5.
- Revisión manual de teclado, foco, contraste y Android medio; documentación operativa y pendientes entregados.

Cierre: demostración de extremo a extremo y **autorización separada** para preparar el lanzamiento.

## 8. Decisiones para el propietario

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿La pasarela es un **adaptador sandbox propio** (una página de prueba donde eliges el resultado), sin cuenta en ningún proveedor de pagos? | **Sí.** Es lo que define rev 0.2, cuesta US$ 0 y no requiere webhooks. La regla «no simular pagos» se respeta así: nunca se presenta como un cobro real, todo va etiquetado «prueba» y en producción está bloqueado. Integrar el modo de prueba de un proveedor real exigiría `PaymentEvent` y webhooks, que rev 0.2 deja para antes de la pasarela real. |
| 2 | ¿Cancelar = mantener el acceso hasta el fin del periodo, con opción de **reanudar** antes de que termine (sin nuevo pago)? | **Sí.** No hay renovación automática: al vencer, se vuelve a Gratis y se puede suscribir de nuevo con otro checkout de prueba. |
| 3 | ¿Un pago pendiente vence a los **30 minutos**? | **Sí.** Se evalúa al consultarlo, sin cron. |
| 4 | ¿Admin: **solo lectura** de suscripciones y pagos, más la conversión de prueba, sin editar ni reembolsar? | **Sí.** Es la «inspección mínima» de rev 0.2. |
| 5 | ¿E2E: automatizar con Playwright **contra staging**, lanzado a mano desde GitHub, los flujos de una **cuenta docente de prueba ya creada** (ingreso, panel, interés, checkout y demo), con sus credenciales en **GitHub Secrets**? ¿Y dejar registro y onboarding, admin con MFA y eliminación de cuenta como **prueba manual guiada**? | **Sí.** Esos tres flujos necesitan confirmar un correo (con el límite de unos 2 por hora) o un código TOTP. Automatizarlos obligaría a guardar el secreto MFA de un admin en CI o a contratar un SMTP. |
| 6 | Al **eliminar una cuenta** con Individual vigente, ¿se borran su suscripción y sus pagos de prueba junto con la cuenta? | **Sí.** Son de prueba y la auditoría conserva registros redactados. La política de retención de pagos reales queda como pendiente de lanzamiento. |
