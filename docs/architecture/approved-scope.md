# Alcance aprobado y límites de construcción

Fuente: [Fase 0 revisión 0.2](fase-0-rev-0.2.md) aprobada y ajustes posteriores del usuario. Si hay conflicto, este documento prevalece.

## Decisiones obligatorias

- Stack: Next.js App Router, TypeScript y Supabase; no sustituir por Express/Vite ni por la base integrada del entorno.
- Trabajar por cinco etapas. Mostrar demo y reporte de CI al cerrar cada una, y esperar aprobación antes de la siguiente.
- Presupuesto desarrollo/staging: US$ 0 de los servicios propuestos. No contratar planes ni recursos pagados. Máximo de producción pendiente.
- `[NOMBRE]` es provisional y se centraliza en configuración y traducciones.
- Gratis es ausencia de suscripción vigente: no crear Subscription de importe cero por usuario.
- Role y UserRole permanecen en PostgreSQL; matriz rol→permiso en código versionado. No crear Permission/RolePermission. En etapa 2 las políticas SQL se versionan y prueban contra esa matriz; no generar permisos desde entradas del cliente.
- Sin NotificationPreference hasta existir un canal/tipo configurable.
- Announcement contiene listas de países, roles y planes (vacía = todos, AND entre dimensiones). No AnnouncementAudience. Validar códigos server-side. **Motivo:** segmentación pequeña, sin reglas ni prioridad; no requiere una tabla puente ni consultas extra.
- La lista objetivo se reduce de 30 a 26 tablas: se eliminan Permission, RolePermission, NotificationPreference y AnnouncementAudience.
- Solo flag de apagado global por módulo; sin flags por usuario ni prioridades.
- Organizaciones: esquema y RLS con pruebas; sin interfaz de director ni invitaciones. Creación manual por admin para pruebas.
- Gratis e Individual sandbox activos; Institucional oculto. Individual: PEN 1990 unidades menores por mes, equivalente a S/ 19.90; no precio comercial.
- Único entitlement de demostración: demo.access. Módulo demo oculto y denegado en producción.
- Suscripciones separadas por contexto, sin prorrateo, cancelación al final del periodo.
- Onboarding: nombre, país y al menos un nivel obligatorios; demás selecciones opcionales. IE texto libre, campo de código modular futuro.
- No asignar creador/revisor. Superadmin pendiente de identidad verificada del usuario en etapa 2.
- Sin cola, outbox, PlanVersion, PaymentEvent, DailyMetric, PrivacyRequest ni acceso excepcional de soporte.
- Mantener MFA admin/superadmin, ConsentRecord mínimo, eliminación, Sentry Free, RLS y pruebas negativas.
- No importar catálogo hasta revisar archivo oficial; el manifiesto debe contener URL exacta del archivo, hash y fecha real de corte. Una página ESCALE no es fuente de archivo suficiente.
- Textos legales en revisión; responsable de datos, soporte y presupuesto producción pendientes. No inventarlos.

## Etapas

1. Base, diseño, CI y staging.
2. Auth, perfil, onboarding y esquema institucional/RLS.
3. Registro de módulos, dashboard, interés, avisos y estados vacíos.
4. Administración y métricas SQL.
5. Planes sandbox, demo y pruebas finales.

El scaffolding de herramientas no debe convertirse en implementación anticipada de etapas 2–5.