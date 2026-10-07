# Lanzamiento — Plan: de staging a usuarios reales

**Estado:** **aprobado** por el propietario el 06/10/2026, con las recomendaciones de la sección 8: decisiones 1, 2, 5, 6 y 7 tal como se recomiendan. La decisión 8 (catálogo educativo) se confirmó el 07/10/2026 sin cambios en la lista. Las decisiones 3 (nombre y dominio, en espera por elección del propietario el 07/10/2026), 4 (presupuesto) y 9 (legal) esperan los datos del propietario y no frenan la fase A. Autorizada **solo la fase A** (US$ 0). Las fases C, D y E necesitan cada una su confirmación.
**Fuentes:**
- [Fase 0 rev 0.2](fase-0-rev-0.2.md) §7 (entornos y coste), §8 (elementos postergados) y §9 (pendientes);
- el [alcance aprobado](approved-scope.md), que prevalece;
- los pendientes de los reportes de las [etapas 2 a 5](../reports/) y de [environments.md](../runbooks/environments.md).

Las 5 etapas están cerradas. Este plan no añade funciones nuevas: prepara el producto actual para que lo usen docentes reales con datos reales, y deja fuera todo cobro real.

## 1. Qué se lanza

| Incluido en producción | Oculto o fuera de producción |
|---|---|
| Registro e ingreso por correo y Google, recuperación de contraseña | Planes, checkout, pasarela de prueba y Mi plan (no hay pagos reales; ver decisión 2) |
| Onboarding, perfil, consentimiento y eliminación de cuenta | Módulo demo (ya está oculto y denegado en producción) |
| Panel con módulos «Próximamente», «Avísame», avisos y notificaciones | Páginas internas del proyecto: «Sistema visual», «Hoja de ruta» y los textos «Etapa N de 5» (decisión 7) |
| Administración con MFA: usuarios, módulos, avisos, catálogos, organizaciones, métricas y auditoría | Territorio sintético, aviso de prueba y cualquier otro dato del seed |

## 2. Fuera de alcance

- Cobros reales, proveedor de pagos, webhooks y facturación. Requieren su **propio plan**, con `PaymentEvent`, `PlanVersion`, la separación live/sandbox de rev 0.2 §3, el país de facturación verificado (B3 de la etapa 5) y textos legales de compra.
- Módulos funcionales, IA y carga de archivos.
- Correo de marketing, WhatsApp y notificaciones por correo de la plataforma.
- Interfaz de director e invitaciones a organizaciones.

## 3. Lo que hoy impide abrir producción

Es el resultado de revisar el código y los reportes. Los tres primeros puntos son **técnicos** y no se habían listado antes.

| # | Bloqueo | Por qué importa | Quién lo resuelve |
|---|---|---|---|
| 1 | **El catálogo educativo** (niveles y grados) solo existe en `seed.sql`, que nunca se aplica en producción | El onboarding exige al menos un nivel. Sin catálogo, **ningún docente puede terminar el registro** en producción | ✅ Resuelto: el propietario confirmó la lista el 07/10/2026 y está en la migración `20261007000100_launch_education_catalog.sql` |
| 2 | **Sin territorio oficial**: regiones y UGEL son sintéticas y viven en el seed | En producción la lista de regiones quedaría vacía | Decisión 6 |
| 3 | **La app muestra contenido de desarrollo**: insignia «Etapa 5 de 5», portada y estado de etapas, «Sistema visual», «Hoja de ruta», y Planes y Mi plan aunque en producción no se pueda pagar | Un docente real vería un proyecto en construcción y una página de planes que no funciona | Yo (fase A) |
| 4 | Nombre del producto: `[NOMBRE]` es provisional | Aparece en todas las pantallas, correos y la pantalla de Google | Propietario |
| 5 | Textos legales en «borrador-2026-10», sin responsable del tratamiento de datos ni canal de soporte | Rev 0.2 exige su revisión antes de usuarios públicos. En Perú aplica la Ley N.° 29733 de Protección de Datos Personales: sus obligaciones concretas debe confirmarlas un abogado | Propietario, con asesoría legal |
| 6 | Correo de Auth: el SMTP integrado envía unos 2 correos por hora | Con más de unos pocos registros por hora, los correos de confirmación y recuperación no llegan | Propietario elige y crea la cuenta del proveedor (decisión 5) |
| 7 | Presupuesto máximo de producción sin confirmar | Producción necesita planes de pago (decisión 4). Supabase Free se pausa por inactividad y no tiene respaldos diarios; Vercel Hobby es solo para uso no comercial | Propietario |
| 8 | La pantalla de consentimiento de Google está en modo *Testing* | En ese modo solo entran los usuarios de prueba que se añaden a mano. Para todos, Google debe revisar la app | Propietario, en Google Cloud |
| 9 | Retención de auditoría y de datos de cuentas eliminadas sin definir (rev 0.2 §5) | Hay que decir cuánto tiempo se guardan los registros antes de recibir datos reales | Propietario, con asesoría legal → yo lo implemento |
| 10 | Respaldo y restauración sin documentar ni ensayar | Rev 0.2 lo exige antes del lanzamiento. RPO 24 h y RTO 8 h son objetivos no verificados | Yo documento; propietario ensaya una restauración conmigo |

## 4. Fases

### Fase A — Preparación técnica (yo, US$ 0, en staging)

Se puede hacer **antes** de pagar nada, mientras el propietario resuelve los datos de la fase B.

1. **Modo producción de la app:**
   - con `NEXT_PUBLIC_APP_ENV=production`, ocultar Planes, Mi plan y sus enlaces, las páginas internas y la insignia de etapa;
   - una portada de producto en vez del estado de etapas.

   Se prueba en staging forzando ese modo en una prueba de humo, sin tocar la configuración de staging.
2. **Catálogo educativo como migración:** la lista confirmada por el propietario el 07/10/2026, con `source = 'confirmado-propietario-2026-10-07'`. Solo se inserta si no existe y reetiqueta las filas preliminares que el seed había creado en dev y staging. El seed ya no trae el catálogo.
3. **Runbook de producción** (`docs/runbooks/produccion.md`):
   - crear la organización Supabase Pro separada de la Free;
   - aplicar las migraciones en orden y **nunca** el seed;
   - configurar Auth: Site URL, Redirect URLs, SMTP y Google;
   - definir las variables de Vercel y el entorno `production` de Sentry;
   - el bootstrap del superadmin, con correo verificado y MFA;
   - comprobaciones previas a la apertura (sección 5).
4. **Script de verificación de producción**: una consulta de solo lectura que el propietario pega en el SQL Editor. Comprueba que hay 26 tablas, que el sandbox está apagado, que no hay filas sintéticas ni del seed, que el demo no tiene disponibilidad y que existe un superadmin.
5. **Respaldo y recuperación:** procedimiento escrito para el respaldo diario de Supabase Pro y una restauración de ensayo.
6. **Endurecimiento pendiente:**
   - fijar las GitHub Actions por SHA;
   - preparar la CI para Node 24 y fijar la imagen del runner (`ubuntu-24.04`), para que el cambio de `ubuntu-latest` a Ubuntu 26 no la modifique sin un commit revisado. Pasar a Ubuntu 26 queda como cambio aparte, probado antes;
   - implementar la política de retención en cuanto el propietario la defina.
7. **Textos de lanzamiento:** integrar los textos legales revisados como una nueva versión. `ConsentRecord` guarda la versión aceptada. Producción empieza sin usuarios, así que todos aceptan la versión definitiva al registrarse. Pedir de nuevo la aceptación a usuarios existentes, cuando cambie una versión ya publicada, queda como mejora posterior. Añadir el responsable del tratamiento y el canal de soporte en `/legal` y `/ayuda`.
8. **Accesibilidad manual:** checklist de teclado, foco, contraste y TalkBack en un Android de gama media, con resultados registrados. Es el pendiente ⏳ de la etapa 5.

### Fase B — Datos y decisiones del propietario (en paralelo a la fase A)

- El nombre del producto y el dominio, que hace falta antes del piloto para el remitente del SMTP.
- Textos legales revisados, responsable del tratamiento y correo de soporte.
- Presupuesto máximo mensual.
- Proveedor de SMTP.
- Revisión del catálogo educativo y del territorio.
- Política de retención.

Nada de esto se inventa: si falta un dato, queda como bloqueo documentado.

### Fase C — Provisionar producción (propietario, con mi guía paso a paso)

- **Supabase Pro**, en una organización separada de dev y staging.
- **Vercel Pro**, con su propio proyecto o entorno de producción.
- La cuenta SMTP y el dominio verificado en ese proveedor.

El propietario crea las cuentas y paga. Las claves se guardan solo en los gestores de cada proveedor. El SQL se aplica igual que en las etapas: por portapapeles y con una consulta de verificación.

### Fase D — Piloto cerrado

- Docentes invitados por el propietario, con un número máximo que decide él.
- Google sigue en modo *Testing*, con esos correos como usuarios de prueba.
- Se recoge su opinión y se revisan Sentry y las métricas del admin.
- Correcciones en staging primero.

### Fase E — Apertura pública

- Requisitos: la publicación de la pantalla de Google, los textos legales definitivos, un SMTP con capacidad suficiente y las alertas de presupuesto configuradas.
- La apertura es una decisión **go / no-go** explícita del propietario, sobre la checklist de la sección 5.

## 5. Criterios para abrir

**Para el piloto cerrado (fin de la fase C):**
- La CI está en verde sobre el commit desplegado en producción.
- El script de verificación de producción da los valores esperados. `select app_private.sandbox_enabled();` devuelve **false**.
- Un registro completo funciona en producción con una cuenta nueva del propietario: correo, confirmación, onboarding y panel. También el ingreso con Google y la recuperación de contraseña.
- El superadmin de producción tiene MFA y entra a `/admin`.
- Producción no muestra Planes, Mi plan, el demo, páginas internas ni datos sintéticos.
- Sentry recibe errores con el entorno `production`.
- El procedimiento de respaldo está documentado y se ha visto al menos un respaldo diario completado.
- Están publicados los textos legales revisados, con su responsable y su canal de soporte.

**Para la apertura pública, además:**
- La pantalla de Google está publicada.
- Hay un SMTP con capacidad para el volumen esperado.
- Las alertas del 50, 80 y 100 % del presupuesto están configuradas.
- La restauración de ensayo está hecha y su tiempo, registrado.
- La checklist de accesibilidad manual está completa.
- Los hallazgos del piloto están resueltos o aceptados por el propietario.

## 6. Orquestación con agentes

| Trabajo | Agente | Modelo |
|---|---|---|
| Migración del catálogo, script de verificación y retención | `db-engineer` | **Opus 5.5** |
| Modo producción de la app y textos de lanzamiento | `ui-builder` | Sonnet 5.5 |
| Runbook de producción y procedimiento de respaldo | Orquestador | Opus 5.5 |
| Revisión antes de cada push | `rls-auditor` / `scope-guardian` / `verifier` | **Opus** / Sonnet / Sonnet |
| Reporte de cada fase | `stage-reporter` | Sonnet 5.5 |

Se mantienen las reglas de las etapas:
- commits locales y un push por fase con autorización del propietario;
- el SQL lo pega el propietario, primero en dev, luego en staging y, en la fase C, en producción;
- no se usa la API de Vercel.

## 7. Costo

- **Fases A, B, D (en staging) y la preparación:** US$ 0.
- **Desde la fase C:** la base orientativa de rev 0.2 es de unos **US$ 45 al mes**: Supabase Pro con cómputo Micro, más Vercel Pro con un asiento.
  - No es un tope: excluye impuestos, dominio, SMTP, consumo excedente y asientos adicionales.
  - Las tarifas se revalidan en supabase.com/pricing y vercel.com/pricing antes de contratar.
- No se contrata nada sin la aprobación expresa del propietario y un presupuesto máximo confirmado.

## 8. Decisiones para el propietario

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿Lanzar en **dos pasos**: un piloto cerrado con docentes invitados y, después, la apertura pública? | **Sí.** Permite probar con datos reales y pocos usuarios mientras Google revisa la app y se valida el SMTP. |
| 2 | ¿Producción **sin pagos**: todos en Gratis, con Planes y Mi plan ocultos, y los cobros reales en un plan aparte más adelante? | **Sí.** El sandbox no puede funcionar en producción, y hoy no hay ningún módulo funcional que vender. |
| 3 | ¿Cuál es el **nombre del producto**? ¿Cuál será el **dominio propio**? | Los dos son necesarios **antes del piloto**. El nombre aparece en los correos y en la pantalla de Google. El dominio hace falta porque el SMTP exige verificar uno propio para el remitente ([smtp-opciones.md](../runbooks/smtp-opciones.md), actualización del 06/10/2026). La web del piloto puede seguir en la dirección `vercel.app` de producción. |
| 4 | ¿Cuál es el **presupuesto máximo mensual** de producción? | Confirmar un tope que cubra la base de unos US$ 45, más el SMTP y el dominio, con alertas al 50, 80 y 100 %. Sin tope confirmado, no se provisiona. |
| 5 | ¿Qué **proveedor de SMTP**? | Te preparo una comparación de 2 o 3 proveedores con nivel gratuito o de bajo costo, con tarifas consultadas en sus páginas en ese momento, y eliges tú. No creo cuentas ni contrato nada. |
| 6 | **Territorio**: ¿importar el padrón oficial MINEDU antes del piloto, o hacer el piloto sin región ni UGEL e importarlo antes de la apertura? | **Piloto sin región ni UGEL**, con el campo oculto mientras no haya datos oficiales. La importación necesita un archivo oficial con URL exacta, fecha de corte y hash. Si consigues ese archivo, se importa antes. |
| 7 | ¿**Ocultar en producción** las páginas internas («Sistema visual», «Hoja de ruta» y los textos de etapas), sin dejar de mostrarlas en dev y staging? | **Sí.** Son herramientas del proyecto, no del producto. |
| 8 | **Catálogo educativo:** ¿la lista preliminar (Inicial: 3, 4 y 5 años; Primaria: 1.º a 6.º; Secundaria: 1.º a 5.º) es correcta para producción? | Revísala tú y confírmala o corrígela. Por ahora, sin áreas curriculares. **Confirmada sin cambios el 07/10/2026.** |
| 9 | **Legal:** ¿quién revisa los textos, quién es el responsable del tratamiento de datos y qué correo de soporte se publica? | Es imprescindible para el piloto con datos reales. No redacto textos legales definitivos ni invento al responsable: integro lo que entregue tu asesoría. |

Al aprobar este plan empieza **solo la fase A**, que no tiene costo. Las fases C, D y E necesitan cada una la confirmación del propietario en su momento.
