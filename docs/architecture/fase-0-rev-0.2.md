# [NOMBRE] — Fase 0, revisión 0.2

> **Nota de archivo (03/10/2026):** copia del plan original entregada por el propietario. Los ajustes posteriores de [approved-scope.md](approved-scope.md) **prevalecen** sobre este texto. En particular:
>
> - Se eliminan Permission, RolePermission, NotificationPreference y AnnouncementAudience: la lista objetivo es de **26 tablas**. La matriz rol→permiso vive en código versionado; la audiencia de Announcement son listas de país/rol/plan en la propia tabla.
> - Gratis = ausencia de suscripción vigente: no se crea Subscription de importe cero.
> - Precio sandbox de Individual: PEN 1990 unidades menores por mes (S/ 19.90).
> - Las etapas 1 a 5 se mantienen; la etapa 1 está cerrada (ver `docs/reports/etapa-1-verificacion.md`).

Fecha: 02/10/2026 · Estado original: pendiente de aprobación del plan actualizado.

Este documento reemplaza el modelo de datos, disponibilidad de módulos, etapas y presupuesto de la versión 0.1. Los ajustes del usuario prevalecen sobre cualquier apartado anterior incompatible.

## 1. Alcance acordado

Se conserva Next.js App Router, TypeScript, Supabase Auth/PostgreSQL/Storage, Tailwind, componentes accesibles, Zod y traducciones con [NOMBRE] provisional. Monolito modular; Server Actions para operaciones de la aplicación y `/api/v1` exclusivamente para callbacks.

Incluye autenticación por correo y Google, perfil, onboarding, dashboard, administración, notificaciones in-app directas, auditoría, planes y checkout sandbox. Organizaciones: esquema, aislamiento y pruebas; sin interfaz de director ni invitaciones.

No incluye IA, contenido curricular, marketplace, cursos, simulacros ni pasarela real. Sus tarjetas permanecen en estado «Próximamente». Tampoco incluye cola, outbox, consumidor, versiones de planes, eventos de pago persistidos, agregados de métricas ni flujo especial de acceso de soporte.

Se mantienen RLS con pruebas negativas, MFA administrativo, consentimiento mínimo, eliminación de cuenta, Sentry gratuito, CI y E2E de humo con axe. La PWA conserva manifiesto e iconos para instalación donde el navegador lo admita, pero no página offline ni promesa de funcionamiento sin conexión.

## 2. Modelo de datos recortado

### ER (texto original de rev. 0.2)

Notación: 1 — N uno a muchos; 0..1 relación opcional.

```
auth.users 1 — 1 User 1 — 1 Profile
User 1 — N UserRole N — 1 Role
Role 1 — N RolePermission N — 1 Permission            [eliminado por ajuste]
User 1 — N Membership N — 1 Organization
Membership N — 1 Role [ámbito institucional]
User 1 — 1 Workspace [personal]
Organization 1 — 1 Workspace [institucional]
Country 1 — N TerritoryUnit
TerritoryUnit 0..1 — N TerritoryUnit [padre e hijos]
Profile N — 1 Country
Profile N — 0..1 TerritoryUnit [región]
Profile N — 0..1 TerritoryUnit [UGEL]
Organization N — 1 Country
Country 1 — N EducationCatalog
EducationCatalog 1 — N EducationCatalogRelation [origen/destino]
Profile 1 — N ProfileEducationSelection N — 1 EducationCatalog
Workspace 1 — N Subscription N — 1 Plan
Plan 1 — N PlanPrice N — 1 Country
Subscription N — 1 PlanPrice [precio elegido]
Plan 1 — N PlanEntitlement N — 1 Entitlement
Subscription 1 — N Payment
Module 1 — N ModuleAvailability N — 1 Country
ModuleAvailability N — 0..1 Entitlement
User 1 — N ModuleInterest N — 1 Module
Announcement 1 — N AnnouncementAudience                [eliminado por ajuste]
User 1 — N Notification N — 0..1 Announcement
User 1 — 1 NotificationPreference                       [eliminado por ajuste]
User 1 — N ConsentRecord
User 1 — N ActivityEvent
AuditLog → actor / contexto / recurso [referencias controladas]
```

No cuenta tablas internas administradas por Supabase (auth, storage, etc.). Region y UGEL serán vistas del catálogo territorial, no tablas duplicadas.

### Tablas (rev. 0.2 listaba 30; tras ajustes quedan 26)

| # | Tabla lógica | Contenido y restricciones principales |
|---|---|---|
| 1 | User | UUID vinculado a Auth; activo/suspendido/eliminación pendiente; fechas. Sin contraseñas ni email duplicado como autoridad |
| 2 | Profile | Nombre, país, región/UGEL opcionales, situación laboral opcional, IE como texto libre, future_modular_code nullable, avance del onboarding |
| 3 | Organization | Nombre, país y estado; creación administrativa para pruebas |
| 4 | Membership | Usuario, organización, rol institucional y estado; pareja usuario-organización única |
| 5 | Workspace | Dueño personal o institucional, exactamente uno; propietario único |
| 6 | Role | Docente, creador, director, revisor, admin y superadmin; ámbito explícito |
| ~~7~~ | ~~Permission~~ | **Eliminada por ajuste**: matriz en código |
| 8 | UserRole | Asignaciones de producto/plataforma; sin autoasignación |
| ~~9~~ | ~~RolePermission~~ | **Eliminada por ajuste**: matriz en código |
| 10 | Country | ISO, moneda, locale, zona IANA, activo y clave de proveedor sandbox |
| 11 | TerritoryUnit | País, tipo región/UGEL, código oficial, nombre, padre, vigencia y procedencia del catálogo |
| 12 | EducationCatalog | Niveles, grados y áreas por país; solo clasificación, no currículo |
| 13 | EducationCatalogRelation | Relaciones permitidas entre niveles, grados y áreas; evita combinar catálogos incompatibles |
| 14 | ProfileEducationSelection | Perfil y elemento educativo; múltiples niveles, grados y áreas sin duplicados |
| 15 | Plan | Gratis e Individual activos; Institucional oculto; ámbito personal/institucional |
| 16 | PlanPrice | Plan, país, moneda, importe en unidades menores, periodo y activo; precio referenciado no se modifica |
| 17 | Entitlement | Único derecho inicial: demo.access, booleano |
| 18 | PlanEntitlement | Valor del derecho por plan; Gratis no lo concede, Individual sí; Institucional oculto sin derechos operativos |
| 19 | Subscription | Workspace, plan/precio, estado, periodo y cancelación al final; snapshot de condiciones aplicadas |
| 20 | Payment | Suscripción, importe/moneda congelados, proveedor sandbox, estado, referencia e idempotencia |
| 21 | Module | Id, manifiesto proyectado, estado, implementación disponible y emergency_disabled global |
| 22 | ModuleAvailability | Módulo, país habilitado y entitlement requerido opcional; pareja módulo-país única |
| 23 | ModuleInterest | Usuario+módulo único, país al registrarse y fecha; alta y retirada propias |
| 24 | Announcement | Contenido seguro, borrador/publicado, vigencia y autor. **Ajuste:** listas de países, roles y planes (vacía = todos, AND entre dimensiones) |
| ~~25~~ | ~~AnnouncementAudience~~ | **Eliminada por ajuste** |
| 26 | Notification | Destinatario, tipo, contenido mínimo, vínculo validado, lectura y clave de deduplicación |
| ~~27~~ | ~~NotificationPreference~~ | **Eliminada por ajuste** |
| 28 | ConsentRecord | Usuario, versión de política aceptada y fecha; registro append-only |
| 29 | ActivityEvent | Actividad mínima autenticada para dashboard y métricas; sin analítica externa invasiva |
| 30 | AuditLog | Actor, contexto, acción, recurso, resultado, fecha y request id; append-only y datos redactados |

Archivos: no se implementa FileAsset en esta fase. No hay biblioteca ni carga de documentos; Storage queda configurado de forma privada, sin interfaz de subida. Cuando exista una función de archivos, se añadirá FileAsset con su RLS.

### Decisiones de integridad y simplificación

- ProfileEducationSelection guarda elecciones por categoría. Nivel es obligatorio; grados y áreas son opcionales y se validan con el catálogo de relaciones.
- País, región y UGEL deben ser coherentes entre sí. No inferir jurisdicción de UGEL únicamente desde la ubicación de una IE.
- IE en texto libre no crea organización ni membresía. El campo de código modular queda nulo: no se importa ni valida una IE en esta fase.
- Roles creador y revisor existen, pero no se asignan a ningún usuario.
- ~~El plan Gratis no genera un Payment ficticio. Una suscripción puede existir con precio cero.~~ **Ajuste:** Gratis es ausencia de suscripción vigente; no se crea Subscription de importe cero.
- Se retienen en Subscription snapshots de precio, periodo y derechos adquiridos en sandbox, sin introducir PlanVersion. Las condiciones cambiadas rigen nuevas suscripciones o renovaciones; no reescriben las ya vigentes.
- La cancelación conserva derechos hasta current_period_end. Cada autorización compara fechas; no necesita cron para retirar acceso al vencer.
- Sin pasarela real, la renovación se simula explícitamente; no hay cobros automáticos.
- Solo una suscripción vigente por workspace. Derechos institucionales y personales nunca se suman.

## 3. Disponibilidad de módulos y sandbox

No existe tabla FeatureFlag. El único flag se guarda como `Module.emergency_disabled`.

El resolvedor comprueba autenticación y permisos, estado, país habilitado, apagado global y entitlement. No hay reglas por usuario ni prioridades de flags. Menú y tarjetas usan el mismo resultado que el servidor; esconder una tarjeta no protege la acción.

| Estado | Comportamiento |
|---|---|
| Oculto | No aparece ni permite ejecutar |
| Próximamente | Tarjeta e interés; ejecución siempre denegada |
| Activo sin derecho requerido | Disponible si pasan los controles de seguridad |
| Activo con derecho requerido | Disponible solo con derecho vigente del contexto |
| Apagado de emergencia | Bloquea ejecución para todos, aunque exista suscripción |

Módulo demo: disponible únicamente en desarrollo y staging; en producción queda oculto y su ejecución se deniega también en servidor por entorno. Requiere demo.access. Gratis no accede; Individual activo en sandbox sí. La pantalla del demo no contiene IA ni funcionalidad comercial.

Checkout: servidor fija precio/contexto → crea Payment pendiente → adaptador sandbox simula resultado → transacción actualiza Payment y Subscription → inserta notificación directa y auditoría. La transacción y restricciones de idempotencia impiden doble activación.

Sin PaymentEvent: guardar en Payment la referencia única del resultado y admitir solo transiciones válidas. Una repetición no duplica efectos y un resultado tardío no revierte una aprobación. La vuelta del navegador nunca acredita un pago.

Límite de seguridad: mientras todos los pagos sean sandbox, no podrán desbloquear capacidades comerciales reales en producción. Antes de habilitar pasarela real se introducirá segregación explícita de entornos live/sandbox y migración de derechos.

## 4. Seguridad, privacidad y métricas que no se recortan

### RLS y privilegios

Datos personales por propietario; datos institucionales por membresía activa y permiso. Admin opera mediante funciones autorizadas y auditadas, no mediante una interfaz general para leer datos privados.

Pruebas obligatorias: usuario A/B, organización A/B, miembro retirado, suspensión con token vigente, autoelevación de rol, cambio de workspace/propietario, lecturas de pagos ajenos y acceso directo al módulo bloqueado. Usar roles reales de base de datos; comprobar SELECT, INSERT, UPDATE y DELETE.

MFA TOTP obligatorio para admin/superadmin. La navegación y Server Actions administrativas exigen una sesión con el nivel de autenticación MFA correspondiente; no basta esconder botones. Un superadmin recién creado debe enrolar MFA antes de usar administración.

El bootstrap no lleva contraseña ni correo hardcodeado. Una vez confirmado el correo, se verifica la cuenta Auth y se asigna su UUID mediante una operación controlada en el entorno correspondiente. Nunca elevar privilegios solo por un email no verificado.

### Eliminación sin PrivacyRequest ni cola

Reautenticación → marcar eliminación pendiente y bloquear acceso → eliminar/anonimizar datos propios en una operación idempotente → borrar identidad Auth. El estado y paso mínimo en User permiten reintentar si falla la frontera entre Auth y PostgreSQL, sin tabla de solicitudes ni consumidor.

No se borran organizaciones compartidas al eliminar un usuario. Bloquear eliminación del último superadmin hasta designar sustituto. Definir antes del lanzamiento retención/anonimización de auditoría y pagos; redactar datos innecesarios. Las cuentas suspendidas deben conservar un canal para ejercer derechos.

ConsentRecord registra aceptación de versión y fecha, pero no certifica por sí mismo cumplimiento legal ni constituye consentimiento de marketing. Borradores legales marcados «en revisión»; revisión obligatoria antes de público o cobros reales.

### Notificaciones y métricas

Inserción directa de notificaciones in-app desde la misma transacción cuando corresponda. No hay cola ni dependencia de entrega por correo/WhatsApp. "Avísame" confirma aviso dentro de la plataforma; no promete mensajes externos.

Métricas mediante consultas o vistas SQL, respetando identidad/RLS y privilegios del admin. Las vistas no pueden eludir políticas por privilegios de su propietario. Índices y rangos de fecha acotados; sin DailyMetric.

- Registros: altas por día, excluyendo seed.
- Activos: usuarios únicos con actividad de negocio en 1/7/30 días; excluir refrescos de token.
- Distribución: región, nivel y área, indicando multiselección.
- Interés: usuarios únicos por módulo.
- Conversión: primera activación sandbox de Individual; claramente etiquetada como prueba y separada de ventas.

## 5. Fuente y revisión de catálogos

Fuente propuesta: MINEDU–ESCALE, Padrón de Servicios Educativos, complementado con el directorio/carta oficial de DRE y UGEL para validar códigos y jurisdicciones.

- Padrón: https://escale.minedu.gob.pe/padron-
- Listados oficiales: https://escale.minedu.gob.pe/listadosrie

Corte de referencia solicitado: 02/10/2026. Se elegirá el último archivo oficial cuya fecha de publicación/corte sea anterior o igual a esa fecha. Todavía no se ha descargado ni validado ese archivo; no se afirma que exista una edición exacta del 02/10/2026. El sitio del padrón presenta verificación de seguridad en el resultado consultado.

Antes de importar se documentarán fecha real del archivo, fecha de descarga, URL, versión y hash en un manifiesto del repositorio. La fecha de consulta no sustituye la fecha de los datos.

Proceso: conservar original → revisar columnas/códigos → normalizar sin cambiar códigos oficiales → comprobar duplicados y referencias región/UGEL → contrastar jurisdicciones → revisar diferencias altas/bajas → aprobar importación → transacción idempotente en staging. Si el esquema región→UGEL no representa alguna excepción oficial, detener esa parte para revisión, no inventar parentescos.

Se importan regiones y UGEL, no todas las IE. Los códigos se guardan como texto para conservar ceros iniciales. Una actualización desactiva entradas obsoletas sin romper perfiles. El panel permite mantenimiento auditado.

## 6. Plan: cinco etapas

### Etapa 1 — Base, diseño, CI y staging

Entrega: repositorio, estructura modular, configuración de [NOMBRE], traducciones, componentes, navegación responsive, temas claro/oscuro, Sentry Free, variables documentadas y despliegue privado de prueba.

Terminado cuando:

- Instalación y build reproducibles, lint y typecheck aprobados.
- Pruebas unitarias iniciales y una prueba de humo con axe pasan en CI.
- CI dispone de base efímera para pruebas SQL/RLS; se agregan las pruebas de dominio en etapa 2.
- Desarrollo/staging están separados, sin claves privilegiadas expuestas ni conexiones a producción.
- Diseño funciona a 360 px, con teclado y foco visible.
- Sentry filtra datos personales y su integración de errores está verificada.
- Staging no comercial y sin datos reales de terceros; no se contratan planes pagados.

Cierre: demostración del sistema base y reporte de CI.

### Etapa 2 — Auth, perfil, onboarding y aislamiento

Entrega: correo/contraseña, Google, recuperación y logout; MFA administrativo; perfil; onboarding persistido; consentimiento mínimo; eliminación; esquema de organizaciones y RLS.

Terminado cuando:

- Onboarding exige nombre, país y al menos un nivel; todo lo demás permite completar después.
- Se puede retomar un paso guardado y completar el recorrido en menos de dos minutos en prueba de usabilidad, excluyendo esperas externas de correo.
- Catálogos oficiales revisados o seed sintético claramente identificado mientras se completa la importación; la importación oficial es requisito de cierre antes de usuarios reales.
- IE es texto opcional y código modular futuro nullable.
- Admin sin MFA no puede ejecutar acciones administrativas.
- Eliminación, reintento ante fallo y bloqueo del último superadmin están probados.
- Pruebas negativas de usuario/tenant/membresía/suspensión/roles pasan contra la base real de pruebas.
- Organization, Workspace y Membership funcionan en fixtures, sin interfaz de director ni invitaciones.

Cierre: demo de acceso/onboarding/eliminación y reporte de aislamiento.

### Etapa 3 — Módulos y dashboard docente

Entrega: manifiestos, ModuleAvailability, apagado global, dashboard, tarjetas, interés, avisos, actividad, notificaciones in-app y estados vacíos. Manifiesto PWA e iconos, sin página offline.

Terminado cuando:

- Menú, tarjetas y servidor coinciden para cada estado/país/apagado.
- "Avísame" es idempotente y permite retirar interés.
- Avisos respetan audiencia y vigencia; notificaciones son privadas y se insertan directamente.
- No hay IA ni módulos futuros ejecutables.
- El perfil personaliza el saludo y la selección visual sin inventar contenidos.
- No se cachean respuestas privadas ni credenciales; logout limpia estado local.
- Las pruebas cubren país no habilitado, módulo oculto, próximo y apagado.
- Los contratos de entitlements se dejan preparados; checkout y demostración real de desbloqueo se cierran en etapa 5.

Cierre: demo móvil/escritorio y matriz de estados de módulos.

### Etapa 4 — Administración mínima

Entrega: usuarios, módulos, avisos, catálogos, métricas y formulario administrativo mínimo de organizaciones para pruebas. Auditoría consultable de las acciones administrativas.

Terminado cuando:

- Búsqueda, filtros y paginación funcionan; suspensión se aplica en servidor.
- Admin no puede otorgar admin/superadmin; creador/revisor siguen sin asignaciones.
- Se pueden crear organizaciones de prueba y sus workspaces, sin UI de invitaciones/director.
- El admin cambia estado, país y apagado de módulos sin tocar código; no activa código inexistente ni el demo en producción.
- Consultas de métricas se validan contra un dataset conocido y respetan RLS.
- Cambios administrativos relevantes quedan auditados.
- No hay tablas agregadas, flags por usuario ni acceso excepcional de soporte.

Cierre: demo administrativa y contraste de cifras con seed.

### Etapa 5 — Planes, checkout sandbox y cierre

Entrega: Gratis/Individual sandbox, Institucional oculto, Mi plan, comparación, cancelación al final del periodo, historial de pagos y Módulo demo. Inspección administrativa mínima de planes/pagos para validar las pruebas, sin editor comercial avanzado.

Terminado cuando:

- Gratis no puede ejecutar el demo; Individual vigente sí; otros módulos no se desbloquean accidentalmente.
- Rechazo, pendiente, cancelación de checkout, repetición, resultado fuera de orden y expiración están probados.
- Cancelar suscripción mantiene acceso hasta fin de periodo, sin prorrateo ni renovación automática.
- No hay privilegios cruzados entre contextos personales e institucionales.
- Demo oculto y denegado en producción incluso por acceso directo.
- Todo importe/cobro está etiquetado sandbox; no hay dinero ni tarjeta reales.
- CI pasa lint, typecheck, unitarias, SQL/RLS y pocos E2E de humo con axe.
- E2E mínimos: registro/onboarding/inicio; admin con MFA; interés; checkout/demo; eliminación de cuenta.
- Revisión manual de teclado, foco, contraste y Android medio; documentación operativa y pendientes entregados.

Cierre: demostración de extremo a extremo y autorización separada para preparar lanzamiento.

Cada etapa se muestra al terminar antes de continuar con la siguiente.

## 7. Entornos y coste

| Entorno | Configuración | Base mensual objetivo |
|---|---|---|
| Desarrollo | Un proyecto Supabase Free, ejecución local o entorno de desarrollo existente | US$ 0 adicionales de los servicios propuestos |
| Staging | Segundo proyecto Supabase Free + Vercel Hobby, uso no comercial | US$ 0 |
| Producción al lanzar | Un proyecto Supabase Pro Micro + Vercel Pro, un asiento de desarrollo | Aproximadamente US$ 45 |

Sentry: plan gratuito, sin complementos pagados. Sin PITR, worker, Redis ni proveedor de WhatsApp. CI dentro de la cuota gratuita disponible; evitar runners/consumos de pago.

Condiciones importantes:

- Mantener los proyectos Free en una organización Supabase Free separada de la organización Pro de producción. No asumir que dos proyectos adicionales dentro de Pro seguirán siendo gratuitos: cada proyecto puede añadir cómputo.
- El límite de proyectos Free depende de los proyectos ya utilizados en la cuenta; comprobarlo antes de provisionar.
- Supabase Free puede pausarse por inactividad y no ofrece los backups diarios de Pro. Staging es recuperable desde migraciones y seed, sin datos irremplazables.
- Vercel Hobby queda limitado a pruebas personales no comerciales. Si las condiciones reales de uso dejan de encajar, pasar a Pro; no tratar Hobby como alojamiento comercial gratuito.
- Los US$ 45 son base, no tope: excluyen impuestos, dominio, correo transaccional, consumo excedente, asientos adicionales y coste del entorno de construcción.
- El correo de Auth en pruebas está sujeto a límites del proveedor. Para lanzamiento, validar un SMTP transaccional y su posible coste; no prometer correo público fiable por US$ 0.
- Producción no se provisiona en etapa 1.
- Presupuesto máximo inicial: pendiente de confirmar. El texto «US$ [confirmar, p. ej. 50]» no se toma como aprobación de US$ 50.

Alertas al 50/80/100 % del máximo confirmado en los proveedores que permitan configurarlas. El total multi-proveedor se revisará operativamente; no se construye un monitor de facturación propio. Sentry Free alcanza sus cuotas o limita recolección según sus condiciones; no activar ampliaciones pagadas.

### Recuperación

Se aceptan como objetivos RPO 24 h / RTO 8 h, sin PITR, con backups diarios de Supabase Pro. RPO depende de que el respaldo diario termine correctamente; RTO sigue siendo objetivo no verificado hasta ensayar una restauración. No se implementan pruebas trimestrales en esta fase.

Documentar acceso al respaldo y procedimiento de recuperación antes de lanzamiento. Los backups de PostgreSQL no restauran por sí solos objetos de Storage; en esta fase no se admite carga de archivos del usuario. Al introducirla se deberá añadir su política de respaldo.

Referencias de precios consultadas para Fase 0: https://supabase.com/pricing y https://vercel.com/pricing. Revalidar tarifas y condiciones al contratar.

## 8. Cómo se agregarán los elementos postergados

| Elemento | Incorporación futura, no implementación actual |
|---|---|
| OutboxEvent, Job y consumidor | Añadir al introducir IA o integraciones asíncronas; migrar efectos externos a eventos transaccionales y consumidores idempotentes |
| PlanVersion | Crear versiones desde planes y snapshots existentes antes de cambios comerciales complejos o cobros reales |
| PaymentEvent | Añadir antes de webhooks reales, con payload mínimo, identificador único, verificación y procesamiento idempotente |
| DailyMetric | Añadir cuando el coste/latencia de consultas lo justifique, preservando definiciones y RLS |
| PrivacyRequest | Migrar el estado mínimo de eliminación a solicitudes auditables si se necesita operación asíncrona o gestión formal |
| Acceso excepcional de soporte | Diseñar aprobación, motivo, plazo y auditoría antes de permitirlo |
| Página offline PWA | Añadir solo una experiencia segura; nunca cachear automáticamente datos privados |
| Restauraciones trimestrales | Programarlas cuando se active la siguiente fase indicada, con responsables y evidencia; no confundirlas con el backup diario |
| FileAsset y respaldo de objetos | Añadir al habilitar carga de documentos u otros archivos del usuario |

## 9. Pendientes y autorización

No bloquean la revisión de este plan: presupuesto máximo, correo del superadmin, confirmación del responsable de datos y contactos de soporte. No se inventarán ni se publicarán marcadores como datos reales.

El correo del superadmin se necesita antes de asignar privilegios en etapa 2. Los demás datos y revisión legal deben resolverse antes de lanzamiento público. ~~Los precios de prueba de Individual no fueron especificados~~ (**ajuste:** S/ 19.90 mensual sandbox).
