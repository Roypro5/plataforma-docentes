# Pruebas E2E contra staging

Suite de Playwright que recorre el flujo de una docente en el staging desplegado, con la pasarela sandbox. No usa servicios de pago ni crea cuentas: usa una cuenta de prueba que ya existe. Pertenece a la etapa 5 ([contrato](../architecture/etapa-5-contrato.md)).

- Configuración: `artifacts/docente/playwright.e2e.config.ts` (`testDir: ./tests/e2e`, sin `webServer`).
- Prueba: `artifacts/docente/tests/e2e/docente.spec.ts`.
- Workflow: `.github/workflows/e2e-staging.yml`, solo con `workflow_dispatch`.
- La prueba de humo de CI (`tests/smoke`, `playwright.config.ts`) **no** recoge estas pruebas: su `testDir` es otro.

## 1. Crear la cuenta docente de prueba

Una sola vez, en el staging:

1. Abre `/registro` en el staging y crea una cuenta con un correo que controles (por ejemplo un alias dedicado a pruebas). Confirma el correo.
2. Ingresa y completa el registro inicial (onboarding): país, región, niveles y grados. Sin esto, el ingreso no llega a `/panel` y la prueba falla en el primer paso.
3. Guarda el correo y la contraseña **solo** en un gestor de contraseñas y en los secrets de GitHub. No los escribas en el chat, en archivos del repositorio ni en logs.
4. La cuenta debe ser una docente común: sin roles de administración.

Efectos que conviene saber:

- La primera ejecución compra el plan Individual de **prueba**; las siguientes lo encuentran ya vigente y solo verifican el demo y Mi plan. Es repetible.
- Esa activación cuenta en la «Conversión de prueba (sandbox)» de `/admin/metricas`, que está separada de ventas.
- Un pago de prueba rechazado o cancelado no deja huella en el plan; queda en `/admin/planes-pagos`.
- El staging debe tener aplicado `supabase/seed.sql`, que habilita el sandbox. Si no, el checkout se explica como no habilitado y la prueba falla con ese mensaje.

## 2. Cargar los 3 secrets en GitHub

En el repositorio: **Settings → Secrets and variables → Actions → New repository secret**. Crea estos tres:

| Secret | Contenido |
|---|---|
| `E2E_BASE_URL` | URL base del staging, sin barra final (por ejemplo la de Vercel del entorno de staging) |
| `E2E_DOCENTE_EMAIL` | Correo de la cuenta docente de prueba |
| `E2E_DOCENTE_PASSWORD` | Contraseña de esa cuenta |

El workflow solo los pasa como variables de entorno al paso de pruebas; no los imprime. Si cambias la contraseña de la cuenta, actualiza el secret.

## 3. Lanzar el workflow

1. En GitHub: pestaña **Actions → E2E staging → Run workflow** (rama `main`).
2. Espera el resultado (unos minutos). Si alguna prueba falla, el reporte HTML (con la captura de la pantalla del fallo) queda como artifact `e2e-staging-report` durante 1 día; si todo pasa, no se sube nada.
3. No hay disparo automático: no corre en cada push, para no repetir pagos de prueba ni gastar cuota.

Para correrla en local (opcional), con las tres variables definidas en tu terminal y sin escribirlas en archivos:

```
pnpm --filter @workspace/docente test:e2e
```

Sin las tres variables, las pruebas se omiten con un mensaje claro. Para comprobar solo que la suite carga: `npx playwright test -c playwright.e2e.config.ts --list` desde `artifacts/docente`.

## 4. Qué cubre

La suite corre en serie y comparte una sola sesión. El flujo de compra corre solo en el proyecto `desktop`, para no duplicar pagos; la accesibilidad corre en `desktop` y `mobile` (360 px).

| Paso | Qué verifica |
|---|---|
| 1 | Ingreso con la cuenta de prueba y llegada al panel |
| 2 | Interés: registrar y retirar «Avísame» en un módulo «Próximamente» (queda como estaba) |
| 3 | Si el plan es Gratis: checkout → pasarela → Rechazar → resultado «rechazado» y sigue en Gratis → checkout → Aprobar → resultado aprobado. Si ya es Individual vigente, se omite |
| 4 | `/modulos/demo` disponible con «Acceso concedido por tu plan Individual (prueba)» |
| 5 | `/mi-plan` muestra Individual; cancelar (con confirmación si la hay) mantiene el acceso; reanudar lo deja como estaba |
| 6 | axe (WCAG 2 A/AA y 2.1 AA, igual que `tests/smoke`) en `/planes`, `/mi-plan` y `/modulos/demo`, con un solo `h1`, `lang="es-PE"` y sin desbordamiento horizontal |

Los informes no incluyen la contraseña: la prueba no usa `fill` para el ingreso y no guarda trazas.

## 5. Checklist manual guiada (lo que no se automatiza)

Hazla antes de cerrar la etapa, en el staging, y anota el resultado y la fecha en el reporte de cierre. Marca cada punto como correcto, con observación o fallido.

### Registro y onboarding

- [ ] Registro con un correo nuevo: llega el correo de confirmación y el enlace abre la sesión.
- [ ] Un registro con datos inválidos muestra mensajes claros (correo, contraseña de menos de 8 caracteres).
- [ ] El onboarding se completa (país, región, niveles, grados) y termina en `/panel`.
- [ ] Recuperar contraseña: llega el enlace y se puede crear una nueva.

### Administración con MFA

- [ ] Una cuenta admin sin MFA es llevada a `/admin/mfa` y no ve datos hasta verificar.
- [ ] Con el código de la app autenticadora (aal2) entra a `/admin`.
- [ ] `/admin/planes-pagos` muestra el pago y la suscripción de la ejecución E2E, con los importes marcados como «prueba» y sin botones de acción.
- [ ] `/admin/metricas` muestra la «Conversión de prueba (sandbox), separada de ventas».
- [ ] Una docente (sin rol) que abre `/admin/planes-pagos` no ve datos.

### Eliminación de cuenta

- [ ] Con una cuenta **desechable** (no la de la suite E2E): `/perfil/eliminar` pide confirmación y, al confirmar, cierra la sesión.
- [ ] La cuenta eliminada ya no puede ingresar y su suscripción y sus pagos de prueba desaparecen (verifícalo con una admin en `/admin/planes-pagos`).

### Teclado, foco y contraste en un Android de gama media

Usa un celular Android de gama media real (o el más parecido que tengas) con Chrome y, si puedes, un teclado Bluetooth o TalkBack.

- [ ] Recorre `/planes`, el checkout, la pasarela de prueba, `/planes/resultado`, `/mi-plan` y `/modulos/demo` solo con teclado (Tab, Shift+Tab, Enter): el orden es lógico y no hay trampas de foco.
- [ ] El foco siempre se ve (anillo visible) en enlaces, botones y campos, en tema claro y en oscuro.
- [ ] El diálogo de confirmación de «Cancelar suscripción» atrapa el foco, se cierra con Escape y devuelve el foco al botón.
- [ ] A 360 px no hay desplazamiento horizontal y los botones se pueden tocar con el pulgar (al menos 44 px).
- [ ] El contraste del texto, de los avisos «prueba» y de los botones deshabilitados es legible a pleno sol (brillo medio) en ambos temas.
- [ ] Con TalkBack, los botones repetidos dicen a qué se refieren y los resultados del pago se anuncian.
- [ ] La carga es aceptable con datos móviles (3G/4G lento): ninguna pantalla queda en blanco más de unos segundos.

## Dudas y bloqueos

- Si el ingreso falla, revisa que la cuenta exista en el staging apuntado por `E2E_BASE_URL`, que su correo esté confirmado y que no haya sido suspendida o eliminada.
- Si el checkout no está habilitado, el staging no tiene aplicado `supabase/seed.sql` (que redefine `sandbox_enabled()` a `true`). No lo habilites en producción.
