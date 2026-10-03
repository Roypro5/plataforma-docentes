---
name: verificar
description: Ejecuta en esta PC Windows todas las comprobaciones de la plataforma docente (lint, typecheck, unitarias, harness SQL/RLS en PostgreSQL local, build y humo Playwright/axe). Úsala antes de cada commit o push y cuando el propietario pida "verifica" o "corre las pruebas".
---

# Verificar el proyecto

## 1. Preparar herramientas (Git Bash)

```bash
export PATH="/c/Users/luis.soto/AppData/Local/Programs/node-v24.21.0-win-x64:$PATH"
PG=/c/Users/luis.soto/AppData/Local/Programs/pg17/pgsql/bin
PGDATA=/c/Users/luis.soto/AppData/Local/Programs/pg17/data
$PG/pg_ctl.exe -D "$PGDATA" status >/dev/null 2>&1 || \
  $PG/pg_ctl.exe -D "$PGDATA" -l "$PGDATA/../pg.log" -o "-p 5432 -c listen_addresses=127.0.0.1" -w start
export EPHEMERAL_DATABASE_URL=postgres://postgres@127.0.0.1:5432/docente_ci
```

Si `node` o `pg_ctl` no existen en esas rutas (otra máquina), usa los que estén en el PATH. Si no hay PostgreSQL, omite `test:rls` y dilo: en CI sí corre.

## 2. Ejecutar desde la raíz del repositorio

```bash
F="pnpm --filter @workspace/docente"
pnpm install --frozen-lockfile
$F lint
$F typecheck
$F test
$F test:rls
$F build        # si falla por lightningcss: rm -rf artifacts/docente/.next y reintenta
$F test:smoke   # usa el build anterior; levanta next start en :3000
git checkout -- artifacts/docente/next-env.d.ts 2>/dev/null   # el build lo regenera
```

## 3. Reportar

Una línea por comprobación con su resultado y conteo (por ejemplo `test:rls 31/31`). Si algo falla, el error literal y la causa probable. No declares aprobado nada que no se haya ejecutado.

Para correrlo en segundo plano mientras se sigue trabajando, delega en el agente `verifier`.
