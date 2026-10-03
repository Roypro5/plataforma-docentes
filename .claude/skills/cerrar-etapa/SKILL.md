---
name: cerrar-etapa
description: Orquesta el cierre de una etapa: verificación completa, auditoría de seguridad y de alcance en paralelo, checklist manual en staging con el propietario y reporte de cierre para su aprobación. Úsala cuando la implementación de una etapa esté terminada.
---

# Cerrar una etapa

## 1. Revisión en paralelo (agentes en segundo plano)

Lanza a la vez, en segundo plano:

- `verifier`: batería completa de pruebas.
- `rls-auditor`: seguridad de las migraciones y Server Actions de la etapa.
- `scope-guardian`: el cambio frente al alcance aprobado y al plan de la etapa.

Corrige los hallazgos críticos y altos antes de seguir; los medios y bajos se reportan al propietario.

## 2. Publicar y aplicar

- Skill `publicar` (con autorización del propietario).
- Skill `aplicar-sql-supabase` para cada migración nueva, en dev y staging.

## 3. Verificación manual en staging

Prepara un checklist corto, derivado de los criterios de cierre del plan de la etapa, y guía al propietario prueba por prueba, pidiendo capturas cuando haga falta. Usa cuentas de prueba creadas con *Auto Confirm User* para no gastar el límite de correos del SMTP gratuito.

## 4. Reporte

Agente `stage-reporter`: reporte en `docs/reports/etapa-N-verificacion.md` con estado «pendiente de aprobación». Presenta un resumen y pide la aprobación explícita. La etapa siguiente solo empieza con autorización explícita.
