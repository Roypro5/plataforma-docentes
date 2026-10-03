# Etapa 2 — Demo y reporte de verificación

**Autorización:** el propietario aprobó iniciar la etapa 2 el 03/10/2026.
**Estado:** **etapa 2 cerrada** por aprobación del propietario el 03/10/2026, con todas las pruebas manuales aprobadas en staging. El propietario autorizó iniciar la etapa 3 a partir de un plan que debe aprobar antes de implementarse.

**Demo:** https://plataforma-docentesstaging.vercel.app (Ingresar, Registro, Mi cuenta, Administración).

## Implementado

- Migración `supabase/migrations/20261003000100_stage2_identity.sql`: 14 tablas de la etapa 2 con RLS, privilegios explícitos por tabla y columna, matriz rol→permiso espejo de `permission-matrix.json`, funciones administrativas con MFA (aal2), eliminación de cuenta en dos pasos y protección del último superadmin.
- Seed de desarrollo/staging: territorio **sintético** (2 regiones, 3 UGEL) y catálogo educativo **preliminar** (3 niveles, 14 grados, sin áreas).
- App: ingreso con correo y Google, registro, recuperación, onboarding de 3 pasos retomable, perfil, consentimiento versionado, eliminación de cuenta, enrolamiento y verificación TOTP para administración.

## Verificación automatizada

| Comprobación | Resultado |
|---|---|
| Lint, TypeScript, Vitest (12) | Aprobado local y en CI |
| Harness SQL/RLS sobre PostgreSQL efímero con emulación de Supabase | 31/31; prueba de mutación confirmó que detecta políticas rotas |
| Build Next.js | Aprobado; páginas privadas siempre dinámicas y `Cache-Control: private, no-store` |
| Playwright + axe (escritorio y 360 px) | 6/6 |
| CI remoto | [Ejecución exitosa](https://github.com/Roypro5/plataforma-docentes/actions/runs/37105702430) del commit `ea5b1b9` |

## Verificación en Supabase real (staging), 03/10/2026

Realizada por el propietario sobre https://plataforma-docentesstaging.vercel.app con el proyecto `plataforma-docentes-staging`:

| Prueba | Resultado |
|---|---|
| Migración y seed aplicados en dev y staging (14 tablas con RLS, 5 territorios, 17 elementos de catálogo) | ✅ |
| Registro con correo, confirmación y callback hasta `/bienvenida` (trigger sobre `auth.users` operativo) | ✅ |
| Onboarding completo y rápido según el propietario | ✅ |
| Bootstrap del superadmin por SQL, enrolamiento TOTP y acceso a `/admin` | ✅ |
| Bloqueo de eliminación del último superadmin | ✅ |
| Eliminación de una cuenta de prueba: identidad Auth y datos borrados, auditoría registrada (comprobado por SQL) | ✅ |
| Recuperación de contraseña en cuenta con MFA (enlace por correo + código TOTP) | ✅ El primer intento falló porque la cuenta tenía MFA (corregido en `61a9219`); aprobado tras esperar el límite de envío del SMTP gratuito |
| Ingreso con Google (cliente OAuth en Google Cloud, modo Testing con usuario de prueba) | ✅ |

## Hallazgos y correcciones

- El cambio de contraseña con MFA exige una sesión aal2: el formulario ahora pide el código TOTP.
- Faltaba cerrar sesión durante el onboarding: añadido.
- El secreto del cliente OAuth de Google quedó visible en una captura compartida en el chat de trabajo: el propietario creó un secreto nuevo, lo cargó solo en Supabase y eliminó el anterior.
- El SMTP integrado de Supabase permite muy pocos correos por hora: la app ahora lo informa. **Antes de tener usuarios reales se necesita un SMTP propio** (decisión y posible coste del propietario).

## Pendientes no bloqueantes de la etapa 2

- Configurar Auth del proyecto **dev** (Site URL `http://localhost:3000`, Redirect URLs y Google con un cliente propio) cuando se necesite desarrollo local contra Supabase.
- Pantalla de consentimiento de Google en modo *Testing*: solo los usuarios de prueba pueden ingresar con Google. Publicarla requiere revisión de Google antes del lanzamiento.

## Pendientes antes de usuarios reales

Importación del padrón oficial MINEDU (reemplaza el territorio sintético), revisión del catálogo educativo, textos legales, responsable de datos, canal de soporte y SMTP transaccional. (La revisión del Redmi 15C se resolvió en la etapa 3.)
