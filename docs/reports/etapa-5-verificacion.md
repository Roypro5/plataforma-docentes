# Etapa 5 — Demo y reporte de verificación

**Autorización:** el propietario autorizó la etapa 5 y aprobó su [plan](../architecture/etapa-5-plan.md), con las 6 decisiones de la sección 8 tal como se recomendaron, el 03/10/2026. Detalle técnico en el [contrato](../architecture/etapa-5-contrato.md), incluidos los límites conocidos B1, B3 y B7.
**Estado:** **etapa 5 implementada, pendiente de aprobación del propietario.** Este reporte no cierra la etapa: el cierre requiere la aprobación explícita del propietario. Los puntos marcados ⏳ no tienen evidencia todavía.

**Demo:** https://plataforma-docentesstaging.vercel.app (`/planes`, `/mi-plan`, `/modulos/demo` y, para admin con MFA, `/admin/planes-pagos`). Todo pago es una **prueba con pasarela sandbox propia**: no hay dinero, tarjetas ni proveedor de pagos real.

## Implementado

- Migración `supabase/migrations/20261006000100_stage5_billing.sql`:
  - 5 tablas nuevas (`plans`, `plan_prices`, `plan_entitlements`, `subscriptions`, `payments`), con lo que el esquema llega a las **26 tablas** del alcance aprobado;
  - `has_entitlement` y `current_plan_code` leen la suscripción personal vigente;
  - funciones para el checkout, la resolución del pago sandbox, Mi plan, cancelar y reanudar, y la inspección administrativa (permiso nuevo `admin.billing.read`);
  - notificaciones «plan Individual de prueba activo» y «pago de prueba rechazado».
- `app_private.sandbox_enabled()` queda en `false` en la migración (fail-closed). Solo `supabase/seed.sql`, que se aplica en dev y staging y nunca en producción, la redefine en `true`.
- Pantallas:
  - **`/planes`:** Gratis e Individual (S/ 19.90 de prueba); Institucional existe pero queda oculto.
  - **`/planes/checkout`, `/planes/sandbox/[pago]` y `/planes/resultado`:** resumen fijado por el servidor, pasarela de prueba con los resultados aprobar, rechazar, dejar pendiente y cancelar, y página de resultado que solo lee el estado guardado. No pide datos de tarjeta.
  - **`/mi-plan`:** plan vigente y periodo, cancelar al final del periodo, reanudar e historial de pagos de prueba.
  - **`/modulos/demo`:** pantalla simple que se muestra solo con el acceso concedido por el plan Individual.
  - **`/admin/planes-pagos`:** listas de solo lectura con filtros; en `/admin/metricas`, la «Conversión de prueba (sandbox)», separada de ventas.
- Segunda defensa de producción en la app: `resolveAppEnv(NEXT_PUBLIC_APP_ENV) === "production"` bloquea el checkout y la resolución del pago en `core/billing/queries.ts` y `actions.ts`, además del cierre en la base.
- Suite E2E contra staging (`artifacts/docente/tests/e2e`, `playwright.e2e.config.ts`) y workflow manual `.github/workflows/e2e-staging.yml`. Guía y checklist manual en [e2e-staging.md](../runbooks/e2e-staging.md).
- Documentación operativa actualizada: [environments.md](../runbooks/environments.md) (E2E, pagos de prueba y comprobación obligatoria de producción).

## Criterios de cierre del plan (§7)

| Criterio | Estado | Evidencia |
|---|---|---|
| Gratis no ejecuta el demo; Individual vigente sí; ningún otro módulo se desbloquea | ✅ | Harness SQL/RLS (90/90). El propietario vio en staging la tarjeta del demo en «Requiere plan» y su desbloqueo tras activar Individual |
| Rechazo, pendiente, cancelación del checkout, repetición, resultado fuera de orden y vencimiento | ✅ | Harness SQL/RLS, que cubre cada caso. El propietario recorrió en staging el rechazo y luego la aprobación. Pendiente, cancelación, repetición, fuera de orden y vencimiento solo están probados en el harness, no a mano en staging |
| Cancelar mantiene el acceso hasta el fin del periodo, sin prorrateo ni renovación automática | ✅ | Harness (cancelar conserva el acceso, reanudar funciona, con el periodo vencido el demo se bloquea). El propietario probó cancelar al final del periodo y reanudar en staging. El vencimiento real del periodo (un mes) no se esperó en staging: está probado con fechas en el harness |
| Sin privilegios cruzados entre contextos personal e institucional | ✅ | Harness: una suscripción institucional no da derechos personales, y un usuario no lee los pagos ni las suscripciones de otro |
| Demo oculto y denegado en producción, incluso por acceso directo | ✅ | La ruta `/modulos/demo` responde `notFound` en producción (`resolveAppEnv`, con pruebas unitarias), y la disponibilidad del demo solo existe en el seed. ⏳ No existe todavía un entorno de producción donde comprobarlo: ver la comprobación obligatoria más abajo |
| Todo importe etiquetado como sandbox; sin dinero ni tarjetas reales | ✅ | El propietario recorrió planes, checkout, Mi plan, administración y auditoría en staging. La pasarela es un adaptador propio que no pide tarjeta; el harness comprueba que sin el seed (producción simulada) el checkout y la resolución se rechazan con `42501` |
| La CI pasa lint, typecheck, unitarias, SQL/RLS y humo con axe | ✅ | [Ejecución exitosa](https://github.com/Roypro5/plataforma-docentes/actions/runs/37236341941) (37236341941) de Foundation CI sobre `cb6cfd5` en `main` |
| E2E mínimos según la decisión 5 | ⏳ | La suite existe y lista 16 pruebas (`--list`), pero el workflow `e2e-staging.yml` **no se ha ejecutado**: necesita una cuenta docente de prueba y 3 secrets de GitHub que crea el propietario. Opcional. Los flujos que la decisión 5 deja como prueba manual guiada (registro y onboarding, administración con MFA, eliminación de cuenta) no tienen confirmación registrada en esta etapa; la eliminación en cascada de suscripción y pagos sí está en el harness |
| Revisión manual de teclado, foco, contraste y Android medio; documentación operativa y pendientes | ⏳ parcial | El propietario confirmó la vista móvil en staging, sin que se registre el dispositivo. La checklist completa de teclado, foco, contraste y TalkBack de [e2e-staging.md](../runbooks/e2e-staging.md) no tiene resultados registrados. La documentación operativa y los pendientes están entregados (este reporte y los runbooks) |

## Verificación automatizada

Comprobaciones locales en Windows con PostgreSQL portable, antes del commit:

| Comprobación | Resultado |
|---|---|
| Lint y TypeScript | Lint sin errores y typecheck con 0 errores |
| Vitest | 156/156 |
| Harness SQL/RLS (`test:rls`) | 90/90 comprobaciones |
| Pruebas de mutación del harness | 14/14 detectadas |
| Build Next.js | Aprobado: 39 páginas |
| Playwright + axe, prueba de humo | 12/12 |
| Suite E2E (`tests/e2e`) | Solo se comprobó que carga: `--list` muestra 16 pruebas. No se ejecutó contra staging |
| CI remoto (Foundation CI) | [Ejecución exitosa](https://github.com/Roypro5/plataforma-docentes/actions/runs/37236341941) (37236341941) del commit `cb6cfd5` en `main`, en 2 min 1 s; ejecuta instalación congelada, lint, typecheck, unitarias, `test:rls`, build y humo con axe |
| Vercel | El estado de `cb6cfd5` es «Deployment has completed», el 04/10/2026 a las 21:31 UTC |

Qué no certifica: axe detecta una parte de los problemas de accesibilidad y no es una certificación WCAG; el harness usa una emulación de Supabase sobre PostgreSQL efímero, no el servicio real (eso lo cubre la prueba manual en staging); las mutaciones no prueban ausencia total de defectos; la serialización de bloqueos concurrentes se comprueba de forma estática en el código de las funciones, no con dos conexiones reales (B7 del contrato); la prueba de humo no sustituye a la suite E2E ni a una revisión manual de accesibilidad.

## Verificación en Supabase real y staging, 04/10/2026 y 05/10/2026

El 04/10/2026 el propietario aplicó en el SQL Editor de Supabase la migración `20261006000100_stage5_billing.sql` y después `supabase/seed.sql`, en `plataforma-docentes-dev` y en `plataforma-docentes-staging`. La consulta de comprobación dio en ambos proyectos: **26** tablas, `sandbox_enabled = true` y **1** precio activo.

El 05/10/2026 el propietario confirmó en el chat «ya probé todo» sobre https://plataforma-docentesstaging.vercel.app. Este es el recorrido que siguió; no se registraron capturas ni dispositivos:

| # | Prueba | Resultado |
|---|---|---|
| 1 | Con el módulo demo bloqueado, la tarjeta del panel dice «Requiere plan» | ✅ |
| 2 | `/planes` muestra Gratis e Individual (S/ 19.90 de prueba) | ✅ |
| 3 | Checkout sandbox: pago rechazado y luego aprobado | ✅ |
| 4 | Mi plan con el historial de pagos de prueba | ✅ |
| 5 | El módulo demo se desbloquea | ✅ |
| 6 | Cancelar al final del periodo y reanudar | ✅ |
| 7 | Vista móvil | ✅ |
| 8 | Administración, «Planes y pagos» (solo lectura) | ✅ |
| 9 | Métrica de conversión en Métricas | ✅ |
| 10 | Etiquetas de los eventos de auditoría | ✅ |

Estas pruebas son una confirmación del propietario, no una ejecución automatizada. El desglose por punto es el de la lista que se le entregó; el chat solo registra «ya probé todo».

## Orquestación

| Trabajo | Agente |
|---|---|
| Contrato técnico | Orquestador |
| Migración, RLS, funciones y harness | `db-engineer` |
| Planes, checkout, pasarela de prueba, resultado y Mi plan | `ui-builder` |
| Demo, administración de planes y pagos, conversión y suite E2E | `ui-builder`, en paralelo |
| Revisión | `rls-auditor`: 0 críticos, 0 altos; `scope-guardian`: sin bloqueantes |
| Correcciones | Orquestador |
| Reporte de cierre | `stage-reporter` |

Commits de la etapa, publicados en `main`:

- `b5ab1c8`: esquema de facturación, funciones sandbox y harness.
- `cb6cfd5`: planes, checkout sandbox, Mi plan, demo, administración de planes y pagos, y suite E2E.

Las correcciones de las auditorías están incluidas en estos dos commits.

## Hallazgos y correcciones

**scope-guardian:** sin bloqueantes. Se ajustaron textos.

**rls-auditor:** 0 críticos y 0 altos. Corregidos antes del commit:

- M1 y M2: la app añade una segunda puerta de producción, `resolveAppEnv(NEXT_PUBLIC_APP_ENV) === "production"`, en `core/billing/queries.ts` y `actions.ts`, junto con el cierre en la base (`app_private.sandbox_enabled()` es `false` en la migración y `true` solo por el seed).
- B2: un único orden de bloqueo, primero el workspace.
- B4: el workflow E2E usa `persist-credentials: false` y `PLAYWRIGHT_NO_COPY_PROMPT`, sube el reporte solo si falla y con retención de 1 día, y limpia los campos de credenciales.
- B5: corregido (texto).

Documentados en el contrato:

- B1: los triggers no impiden que el propietario de la base extienda un periodo ni active una suscripción sin un pago aprobado; el cliente no tiene privilegios de tabla.
- B3: el precio se elige con el país del perfil, que el usuario puede editar. Hoy no tiene efecto porque solo hay precio en PE; antes de tener precios por país hay que fijar un país de facturación verificado.
- B7: la serialización se comprueba de forma estática, no con dos conexiones reales.

Informativo: B6.

## Fuera de alcance, sin cambios

- Pasarela real, cobros, tarjetas, webhooks y facturación (`PaymentEvent` y `PlanVersion` se añadirán antes de una pasarela real).
- Renovación automática, prorrateo y cron.
- Plan Institucional visible, compras para organizaciones e interfaz de director.
- Editor comercial de planes y precios, reembolsos y cupones.
- Desbloquear capacidades reales en producción con pagos sandbox.

## Pendientes no bloqueantes de la etapa 5

- ⏳ Ejecutar el workflow `e2e-staging.yml`: requiere una cuenta docente de prueba y 3 secrets de GitHub (`E2E_BASE_URL`, `E2E_DOCENTE_EMAIL`, `E2E_DOCENTE_PASSWORD`). Opcional. Guía: [e2e-staging.md](../runbooks/e2e-staging.md).
- ⏳ Registrar los resultados de la checklist manual guiada de [e2e-staging.md](../runbooks/e2e-staging.md): registro y onboarding, administración con MFA, eliminación de cuenta, y teclado, foco, contraste y TalkBack en un Android de gama media.
- Mejora detectada en las pruebas: sin acceso, la tarjeta «Módulo demo» del panel no enlaza a `/planes`; la página del módulo sí. Propuesta, no implementada.
- Bajo: fijar las GitHub Actions por SHA. No se hizo. La ejecución de CI además anota que Node.js 20 está en desuso para esas acciones (se fuerzan a Node.js 24) y que `ubuntu-latest` migrará a Ubuntu 26 desde el 19/10/2026.
- Corregido al preparar este reporte: [e2e-staging.md](../runbooks/e2e-staging.md) decía que el reporte E2E se conservaba 7 días; ahora dice que se sube solo si falla y se conserva 1 día, como el workflow. También se actualizó el estado de etapas en [environments.md](../runbooks/environments.md).
- Heredados de etapas anteriores:
  - B6 y B7 de la etapa 4: el término de búsqueda de usuarios queda en el historial del navegador, y las métricas por región no tienen umbral mínimo (conviene revisarlo con usuarios reales).
  - Configurar Auth del proyecto **dev** (Site URL, Redirect URLs y Google) cuando se necesite desarrollo local contra Supabase.
  - Verificar la protección de acceso del despliegue de prueba antes de considerarlo privado: `noindex` no restringe el acceso.

## Pendientes antes de usuarios reales o del lanzamiento

Requieren una **autorización separada** del propietario. Reúnen los de las etapas 2 a 4 (ver [etapa 4](etapa-4-verificacion.md) y [environments.md](../runbooks/environments.md)) y los nuevos de la etapa 5:

- SMTP propio: el integrado envía unos 2 correos por hora.
- Importación del padrón oficial MINEDU, que reemplaza el territorio sintético, y revisión del catálogo educativo.
- Textos legales definitivos.
- Responsable del tratamiento de datos.
- Canal de soporte.
- Política de retención de datos de pago. La etapa 5 borra los pagos de prueba con la cuenta; la retención de pagos reales sigue sin definirse.
- Presupuesto de producción: Supabase Pro y Vercel Pro, sin PITR. La base orientativa de US$45 no es un presupuesto máximo aprobado, y RPO 24 h y RTO 8 h son objetivos, no una restauración verificada.
- Pantalla de consentimiento de Google en modo *Testing*: publicarla requiere revisión de Google.
- Proveedor de pagos real: reemplazaría al sandbox y necesita su propio plan, con `PaymentEvent`, `PlanVersion`, webhooks y un país de facturación verificado (B3).

### Comprobación obligatoria en producción

Después de aplicar las migraciones en el proyecto Supabase de producción y antes de abrirlo a usuarios:

- `select app_private.sandbox_enabled();` debe devolver **`false`**. Si devuelve `true`, alguien aplicó `supabase/seed.sql`: no abrir el entorno y revertirlo.
- `supabase/seed.sql` **no debe aplicarse nunca** en producción.
- `NEXT_PUBLIC_APP_ENV` debe valer `production` o no estar definida.

## Siguiente paso

La etapa 5 es la última de las 5 etapas aprobadas. El siguiente paso **no es una «etapa 6»**: es la **preparación del lanzamiento**, que necesita su propio plan y la aprobación explícita del propietario.

## Aprobación

⏳ **Pendiente de aprobación del propietario.** La etapa 5 se considerará cerrada solo cuando el propietario lo apruebe de forma explícita.
