# Instrucciones para Claude Code

Las reglas del proyecto viven en `replit.md` (heredado de Replit) y se aplican igual aquí:

@replit.md

## Notas adicionales

- Responder al propietario en español.
- Fuente de verdad del alcance: `docs/architecture/approved-scope.md`. Estado de etapas y pendientes: `docs/reports/` y `docs/runbooks/environments.md`.
- No inventar datos (tablas, textos legales, URLs de catálogos, responsables). Si falta información, pedirla y documentar el bloqueo.
- Credenciales y claves solo en los gestores seguros de cada proveedor; nunca en chat, archivos versionados ni logs.
- Entorno local: Windows. CI corre en Ubuntu con PostgreSQL efímero (`EPHEMERAL_DATABASE_URL`).
