# Conectar Supabase — etapa 2

Pasos que hace el **propietario** en los paneles de Supabase, Google Cloud y Vercel. Ninguna clave se envía por chat ni se guarda en el repositorio. Aplicar siempre primero en **desarrollo** y luego en **staging**.

## 1. Aplicar la migración y el seed

Archivos:

- `supabase/migrations/20261003000100_stage2_identity.sql`: esquema, privilegios, RLS y funciones. Va a **todos** los entornos.
- `supabase/seed.sql`: territorio **sintético** y catálogo educativo **preliminar**. Solo para desarrollo y staging, **nunca** producción.

Opción A, panel: Supabase → proyecto → **SQL Editor** → pegar el contenido completo de la migración → Run. Después, en una consulta nueva, pegar `seed.sql` → Run.

Opción B, CLI (en tu terminal; la contraseña de la base la pide la CLI y no se guarda en el repo):

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <ref-del-proyecto>
```

```bash
npx supabase db push
```

Con la opción B, el seed se aplica igual que en la opción A, desde el SQL Editor.

Comprobación rápida en el SQL Editor (debe devolver 14):

```sql
select count(*) from pg_tables where schemaname = 'public' and rowsecurity;
```

**No ejecutar** `supabase/tests/supabase-shim.sql` en Supabase: es solo para la base efímera de CI.

## 2. Configurar Auth

Supabase → **Authentication**:

1. **URL Configuration**
   - Site URL: `https://plataforma-docentesstaging.vercel.app` (staging) o `http://localhost:3000` (desarrollo).
   - Redirect URLs: `https://plataforma-docentesstaging.vercel.app/api/v1/auth/callback**` y `http://localhost:3000/api/v1/auth/callback**`.
2. **Sign In / Providers → Email**: activado, con **Confirm email** activado. Longitud mínima de contraseña: 8.
3. **Sign In / Providers → Google**: activado con el Client ID y Client Secret de un cliente OAuth de Google Cloud (tipo "Web application"). En Google Cloud, la *Authorized redirect URI* es la que muestra Supabase en esa misma pantalla (`https://<ref>.supabase.co/auth/v1/callback`). El secreto se pega solo en Supabase.
4. **Multi-Factor → TOTP**: activado (viene activado por defecto).

El correo de Auth gratuito tiene límites de envío por hora. Es suficiente para pruebas, pero no para un lanzamiento.

## 3. Variables de entorno

Vercel → proyecto `plataforma-docentes.staging` → Settings → Environment Variables (Production y Preview), con los valores del proyecto **staging**:

| Variable | Dónde obtenerla | Visibilidad |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | Pública |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → *publishable* (`sb_publishable_…`), o la `anon` en proyectos con claves antiguas | Pública |

Después, hacer **Redeploy**: las variables `NEXT_PUBLIC_*` se incorporan al build.

**No hace falta** `SUPABASE_SERVICE_ROLE_KEY` ni ninguna clave secreta: la eliminación de cuentas y las acciones administrativas corren como funciones SQL autorizadas. No cargarla.

Para desarrollo local: copiar `artifacts/docente/.env.example` a `artifacts/docente/.env.local` (ignorado por git) con los valores del proyecto **dev**.

## 4. Primer superadmin (bootstrap controlado)

No hay correo ni contraseña en el código. Pasos:

1. Registrarte en la app del entorno con tu correo y **confirmarlo** desde el email.
2. Supabase → Authentication → Users → copiar el **UUID** de tu cuenta.
3. SQL Editor (corre como `postgres`; esta función no es accesible desde la app):

   ```sql
   select app_private.bootstrap_superadmin('<UUID>');
   ```

   La función rechaza la operación si el correo no está confirmado o si ya existe un superadmin. Queda registrada en `audit_logs`.
4. En la app: Mi cuenta → Administración → configurar la app autenticadora (TOTP). Sin MFA no se puede ejecutar ninguna acción administrativa.

## 5. Verificación de cierre de etapa 2 (en staging)

Estas comprobaciones se hacen sobre Supabase real; el harness de CI no las sustituye:

- [ ] Registro con correo → email de confirmación → `/bienvenida`.
- [ ] Ingreso con Google.
- [ ] Recuperación de contraseña → `/restablecer` → nueva contraseña funciona.
- [ ] Onboarding: guardar el paso 1, cerrar sesión, volver a ingresar y retomar en el paso 2; completar en menos de 2 minutos.
- [ ] Perfil muestra los datos y la versión de términos aceptada.
- [ ] Eliminación: con sesión antigua pide reingresar; luego borra la cuenta (Auth → Users ya no la muestra).
- [ ] Superadmin: bootstrap, enrolamiento TOTP y acceso a `/admin` solo con código.
- [ ] El trigger `on_auth_user_created` y el borrado `delete from auth.users` funcionan con los permisos del rol `postgres` del proyecto alojado. **Pendiente de confirmar en Supabase real.**
