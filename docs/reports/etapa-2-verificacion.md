# Etapa 2 — Verificación (en curso)

**Autorización:** el propietario aprobó iniciar la etapa 2 el 03/10/2026.
**Estado:** implementación desplegada en staging; verificación manual casi completa. **No cerrada:** faltan recuperación de contraseña, Google y la revisión del propietario.

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
| Recuperación de contraseña | ⏳ El primer intento falló porque la cuenta tenía MFA (corregido en `61a9219`); el reintento quedó sin correo por el límite de envío del SMTP gratuito de Supabase |
| Ingreso con Google | ⏳ Proveedor aún no configurado |

## Hallazgos y correcciones

- El cambio de contraseña con MFA exige una sesión aal2: el formulario ahora pide el código TOTP.
- Faltaba cerrar sesión durante el onboarding: añadido.
- El SMTP integrado de Supabase permite muy pocos correos por hora: la app ahora lo informa. **Antes de tener usuarios reales se necesita un SMTP propio** (decisión y posible coste del propietario).

## Pendientes antes de usuarios reales

Importación del padrón oficial MINEDU (reemplaza el territorio sintético), revisión del catálogo educativo, textos legales, responsable de datos, canal de soporte, SMTP transaccional y resultado del Redmi 15C.
