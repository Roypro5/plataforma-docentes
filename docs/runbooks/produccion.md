# Producción: guía de provisión, apertura y recuperación

Fase A del [plan de lanzamiento](../architecture/lanzamiento-plan.md). **No ejecutar nada de esta guía hasta que el propietario confirme la fase C** (presupuesto, cuentas de pago y datos de la fase B).

Reglas de siempre:
- El propietario crea las cuentas, paga y pega las claves **solo** en el gestor de cada proveedor. Nada pasa por el chat, el repositorio ni los logs.
- El SQL se aplica por portapapeles, con una consulta de verificación después de cada paso.
- No se usa la API de Vercel.

## 0. Requisitos previos (fase B)

- [ ] Presupuesto máximo mensual confirmado (decisión 4).
- [ ] Nombre del producto (decisión 3), integrado en `src/config/product.ts`.
- [ ] Dominio comprado, al menos para el remitente del correo. Ver [smtp-opciones.md](smtp-opciones.md).
- [ ] Proveedor de SMTP elegido (decisión 5).
- [x] Catálogo educativo confirmado por el propietario el 07/10/2026 (decisión 8), en la migración `20261007000100_launch_education_catalog.sql`.
- [ ] Textos legales revisados, responsable del tratamiento y correo de soporte (decisión 9), integrados y publicados en staging.
- [ ] La CI está en verde y staging se ha probado con el modo producción de la fase A.

### Textos que siguen en versión de prueba (deuda conocida)

Se ven en el build de producción y **deben cambiar antes del piloto**. No se inventan: dependen de los datos del propietario.

| Dónde | Qué dice hoy | Depende de |
|---|---|---|
| `src/config/legal.ts` | `version: "borrador-2026-10"`, `status: "en revisión"`, en el título de `/legal` | Decisión 9 |
| `src/i18n/es-cuenta.ts`, `legal.lead` y `legal.body` | «Borradores en revisión legal… Esta versión de prueba no admite usuarios reales ni cobros…» | Decisión 9 |
| `src/i18n/es-cuenta.ts`, casilla de consentimiento del onboarding | «versión …, en revisión legal» y el enlace «Leer los borradores» | Decisión 9 |
| `src/i18n/es.ts`, `ayuda.contactPending` | «no hay correo ni teléfono habilitados» | Decisión 9 (canal de soporte) |
| `src/config/product.ts` | `name: "[NOMBRE]"`, en el título, la portada y el manifiesto PWA | Decisión 3 |

## 1. Supabase de producción

1. Crear una **organización nueva** en Supabase con el plan **Pro**, separada de la organización Free de dev y staging (rev 0.2 §7). Crear el proyecto en esa organización, con cómputo **Micro**.
   - Región: la más cercana a Perú que ofrezca Supabase. Se elige al crear el proyecto y no se puede cambiar después.
   - La contraseña de la base se guarda en el gestor de contraseñas del propietario.
2. Usar en *Project Settings* la misma configuración de API que dev y staging. Ver [environments.md](environments.md), «Data API»: Data API activada y RLS automático activado.
3. **Aplicar las migraciones** de `supabase/migrations/`, una por una y en orden de nombre, desde el SQL Editor.
   - **No usar `npx supabase db push`** para producción: aplica todo lo que hay en la carpeta, incluidas las migraciones que todavía no se han aprobado.
   - **No aplicar nunca `supabase/seed.sql`.** Ese archivo habilita los pagos de prueba, el módulo demo, el territorio sintético y el aviso de prueba.
   - **No aplicar nunca `supabase/tests/supabase-shim.sql`.**
4. Ejecutar `supabase/checks/produccion.sql` en el SQL Editor y comparar cada columna con el valor esperado que indica su comentario. Si algo no coincide, **no seguir**: avisar y revisar.

## 2. Auth

En el proyecto de producción, *Authentication*:

1. **URL Configuration:** la Site URL es la dirección de producción y las Redirect URLs son `<dirección de producción>/api/v1/auth/callback**`. No incluir las direcciones de staging ni `localhost`.
2. **Email:** activado, con *Confirm email* activado y una contraseña mínima de 8 caracteres.
3. **SMTP:** configurar las credenciales del proveedor elegido, siguiendo [smtp-opciones.md](smtp-opciones.md), y después ajustar *Rate Limits*.
4. **Google:** un cliente OAuth propio de producción en Google Cloud, cuyo *Authorized redirect URI* es el que muestra Supabase. La pantalla de consentimiento lleva el nombre del producto y sus enlaces legales.
   - **Piloto:** modo *Testing*, con los correos de los docentes invitados como usuarios de prueba.
   - **Apertura pública:** publicar la pantalla y pasar la revisión de Google.
5. **MFA → TOTP:** activado.
6. **Plantillas de correo:** revisar en español los textos de confirmación, recuperación y cambio de correo, con el nombre del producto.

## 3. Vercel de producción

1. Pasar a **Vercel Pro** antes de recibir usuarios reales. Hobby es solo para uso personal no comercial.
2. Elegir dónde vive producción. Opciones, a decidir en la fase C:
   - un proyecto propio de producción conectado al mismo repositorio;
   - el entorno *Production* del proyecto actual, con staging en *Preview*.

   Producción y staging **nunca** deben compartir variables de Supabase.
3. Variables de entorno de producción:

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_APP_ENV` | `production`. Declárala explícitamente aunque ausente también cuente como producción, para que el valor quede a la vista |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL del proyecto de **producción** |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave *publishable* del proyecto de **producción** |
   | `NEXT_PUBLIC_SENTRY_DSN` | Puede ser el DSN actual. Los eventos llegan etiquetados con el entorno `production` |

   **No** cargar `SUPABASE_SERVICE_ROLE_KEY` ni ninguna clave secreta: la app no la necesita.
4. Desplegar y, si se usa dominio, asignarlo en *Domains*.
5. La protección de acceso del despliegue (*Deployment Protection*) se revisa según la etapa:
   - **Piloto:** decidir si producción queda abierta, ya que solo entran los usuarios de prueba de Google y quienes se registren por correo.
   - **Apertura pública:** debe estar abierta.

## 4. Superadmin de producción

Mismo procedimiento que en [supabase-etapa-2.md §4](supabase-etapa-2.md):
1. Registrarse en producción y confirmar el correo.
2. Copiar el UUID desde *Authentication → Users*. El UUID no se comparte en el chat.
3. `select app_private.bootstrap_superadmin('<UUID>');`
4. Enrolar el TOTP desde *Mi cuenta → Administración*.

Volver a ejecutar `supabase/checks/produccion.sql`: la columna `superadmins_activos` ahora debe dar 1.

## 5. Comprobaciones antes de abrir

- [ ] `supabase/checks/produccion.sql` da todos los valores esperados para la apertura. En particular:
  - `sandbox_activo` es **false**;
  - `superadmins_activos` es **1** y `superadmins_con_mfa` es **1**;
  - `admins_activos` es **0**;
  - `privilegios_anon` es **0** (requiere la migración `20261006000200`).
- [ ] Registro por correo: llega el correo, a la bandeja de entrada y no a spam. Después siguen la confirmación, `/bienvenida` (onboarding sin región ni UGEL, mientras no se importe el padrón) y `/panel`.
- [ ] Funcionan el ingreso con Google y la recuperación de contraseña. En el piloto, con Google en modo *Testing*, solo entran con Google los usuarios de prueba añadidos; los demás usan correo.
- [ ] **Registro en el piloto:** la portada ofrece «Registrarme» a cualquiera. El propietario decide en la fase D si el registro abierto es aceptable durante el piloto, o si se limita (por ejemplo, con Deployment Protection o sin difundir la dirección). Hoy no existe una lista de invitados en la app.
- [ ] Producción **no** muestra Planes, Mi plan, el módulo demo, «Sistema visual», «Hoja de ruta», la insignia de etapa ni datos sintéticos. `/planes`, `/mi-plan`, `/sistema` y `/hoja-de-ruta` responden 404.
- [ ] `/admin` exige MFA y muestra las secciones, sin «Planes y pagos».
- [ ] `/legal` muestra la versión definitiva de los textos, el responsable del tratamiento y el canal de soporte.
- [ ] Sentry recibe un error de prueba con `environment: production`, provocado igual que en staging: un único error desde la consola del navegador, sin tocar el código.
- [ ] Hay alertas del 50, 80 y 100 % del presupuesto en los proveedores que lo permiten.
- [ ] *Database → Backups* muestra al menos un respaldo diario completado.

## 6. Respaldo y recuperación

**Objetivos de rev 0.2 §7:** RPO de 24 h y RTO de 8 h, sin PITR. Son objetivos; no están verificados mientras no se haga un ensayo.

- **Respaldo:** Supabase Pro hace un respaldo diario automático del PostgreSQL. Se ve en *Database → Backups*, y la retención depende del plan. No incluye objetos de Storage, que hoy no se usan.
- **Acceso:** solo los miembros de la organización de producción con rol de propietario o administrador. Mantener esa lista mínima.
- **Restaurar:** *Database → Backups → Restore* sobre el respaldo elegido.
  - La restauración **reemplaza** la base actual y el proyecto queda sin servicio mientras dura.
  - Se pierde todo lo escrito después del respaldo; ese es el RPO.
  - Avisar a los usuarios antes, si es posible.
- **Ensayo (antes de la apertura pública):**
  - No se ensaya sobre producción con usuarios.
  - Opción 1, si Supabase lo ofrece en ese momento: restaurar un respaldo **a un proyecto nuevo**.
  - Opción 2: con el CLI de Supabase, en la terminal del propietario, exportar la base de producción con `npx supabase db dump` y cargarla en un proyecto de prueba vacío. Luego borrar ese proyecto y el archivo exportado, que contiene datos personales.
  - Registrar la fecha, el tiempo que tomó y el resultado en el reporte de la fase.
- **Después de restaurar:**
  - Ejecutar `supabase/checks/produccion.sql`.
  - Probar el ingreso y `/admin`.
  - Revisar en `audit_logs` el último evento previo al incidente.
