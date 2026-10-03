---
name: aplicar-sql-supabase
description: Guía al propietario para aplicar una migración o el seed en Supabase (dev y luego staging) copiando el SQL al portapapeles y comprobando el resultado. Úsala cuando haya una migración nueva en supabase/migrations/ que aplicar.
---

# Aplicar SQL en Supabase con el propietario

El propietario aplica el SQL en el **SQL Editor** de Supabase; Claude no tiene credenciales de la base y no debe pedirlas. Prefiere recibir el SQL ya copiado en su portapapeles.

## Flujo (un paso por mensaje, esperando confirmación)

1. Indica el proyecto exacto: primero `plataforma-docentes-dev`, luego `plataforma-docentes-staging`. Pide que verifique el nombre arriba del panel antes de pegar.
2. Copia el archivo al portapapeles (PowerShell):

   ```powershell
   Get-Content -Raw -Encoding UTF8 "C:\Users\luis.soto\Documents\plataforma-docentes\supabase\migrations\<archivo>.sql" | Set-Clipboard
   ```

3. Instrucciones: **SQL Editor → + New → Ctrl+V → Run**. Resultado esperado: *Success. No rows returned*. Si sale un aviso de operación destructiva por `revoke` o RLS, se acepta.
4. Si corresponde, repite con `supabase/seed.sql`, que es **solo para dev y staging, nunca producción**.
5. Da una consulta de comprobación con números esperados (tablas con RLS, filas del seed) y pide los números.
6. Si aparece el error `relation ... does not exist`, la migración no se aplicó en ese proyecto: pide `select count(*) from pg_tables where schemaname='public';` antes de reintentar.

## Reglas

- Nunca aplicar `supabase/tests/supabase-shim.sql` en Supabase.
- Nunca editar una migración ya aplicada: crear una nueva.
- No pedir ni repetir claves (`service_role`, contraseña de la base, secretos OAuth). Si aparecen en una captura, no las repitas y recomienda rotarlas.
- Registrar el resultado en el reporte de la etapa.
