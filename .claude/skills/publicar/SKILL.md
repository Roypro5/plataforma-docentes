---
name: publicar
description: Hace commit y push a main del trabajo verificado y revisa una vez el CI de GitHub Actions. Úsala solo cuando el propietario haya autorizado subir los cambios.
---

# Publicar cambios

`main` despliega automáticamente el staging en Vercel, así que publicar es visible: hazlo solo con autorización del propietario en la conversación.

1. Ejecuta antes la skill `verificar`, o confirma que ya se ejecutó tras el último cambio.
2. Restaura los archivos generados: `git checkout -- artifacts/docente/next-env.d.ts`.
3. Revisa `git status --short` y `git diff --stat`. No subas `.env*` ni `.claude/launch.json`, y nada con secretos.
4. Commit con mensaje en inglés (qué y por qué) y las líneas de atribución vigentes de Claude Code.
5. `git push origin main`.
6. Un único `gh run list --limit 1` para obtener el enlace de la ejecución del CI; no hagas sondeos repetidos. Avisa al propietario que Vercel desplegará en 1 o 2 minutos.
