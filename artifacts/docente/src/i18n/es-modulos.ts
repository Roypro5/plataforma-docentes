import type { ModuleId } from "@/modules/registry";

export const modulos = {
  // Names and one-line descriptions. They must not promise features: everything except the
  // test-environment demo is planned and in preparation.
  items: {
    "generador-ia": {
      name: "Generador de materiales con IA",
      description: "Planificado: aún no está disponible. Lo estamos preparando.",
    },
    biblioteca: {
      name: "Biblioteca personal",
      description: "Planificada: aún no está disponible. La estamos preparando.",
    },
    marketplace: {
      name: "Marketplace de materiales",
      description: "Planificado: aún no está disponible. Lo estamos preparando.",
    },
    "cursos-simulacros": {
      name: "Cursos y simulacros",
      description: "Planificados: aún no están disponibles. Los estamos preparando.",
    },
    demo: {
      name: "Módulo demo",
      description: "Módulo de demostración del entorno de prueba",
    },
  } satisfies Record<ModuleId, { name: string; description: string }>,

  // Labels for each access state.
  access: {
    coming_soon: "Próximamente",
    available: "Disponible",
    requires_entitlement: "Requiere plan",
    disabled: "No disponible temporalmente",
  },
  accessNote: {
    coming_soon: "Todavía no se puede usar.",
    available: "Ya puedes entrar.",
    requires_entitlement: "Tu cuenta aún no tiene acceso a este módulo.",
    disabled: "Lo desactivamos por un momento. Vuelve a intentarlo más tarde.",
  },

  // "Avísame" only registers interest and notifies inside the platform: no email, no WhatsApp.
  notify: {
    button: "Avísame",
    buttonFor: (module: string) => `Avísame cuando esté disponible: ${module}`,
    withdraw: "Ya no me avises",
    withdrawFor: (module: string) => `Ya no me avises sobre ${module}`,
    registered: "Te avisaremos aquí, en la plataforma, cuando esté disponible.",
    withdrawn: "Listo. Ya no te avisaremos sobre este módulo.",
    note: "«Avísame» solo te notifica dentro de la plataforma. No enviamos correos ni mensajes de WhatsApp.",
    error: "No pudimos guardar tu preferencia. Inténtalo de nuevo en unos minutos.",
    notAllowed: "Este módulo ya no admite avisos.",
    sending: "Guardando…",
  },

  // Dashboard (/panel).
  panel: {
    title: "Panel",
    eyebrow: "Tu espacio docente",
    greeting: (name: string) => `Hola, ${name}`,
    greetingAnonymous: "Hola",
    lead: "Aquí verás tus módulos, avisos y notificaciones.",
    levels: (levels: string) => `Niveles: ${levels}`,
    grades: (grades: string) => `Grados: ${grades}`,
    profileLink: "Mi cuenta",
    profileLinkHint: "Ver y editar mis datos",
    noLevels: "Aún no elegiste niveles ni grados.",
    modulesTitle: "Módulos",
    modulesLead: "Esto es lo que estamos construyendo. Solo se muestra lo que corresponde a tu país.",
    modulesEmpty: "Por ahora no hay módulos para mostrar en tu cuenta.",
    interested: "Te avisaremos cuando esté disponible.",
    open: "Entrar",
    openFor: (module: string) => `Entrar: ${module}`,
    modulesList: "Lista de módulos",
    announcementsList: "Lista de avisos",
    notificationsList: "Últimas notificaciones",
    announcementsTitle: "Avisos",
    announcementsEmpty: "No hay avisos por ahora.",
    announcementFrom: (date: string) => `Publicado el ${date}`,
    notificationsTitle: "Notificaciones",
    notificationsEmpty: "No tienes notificaciones.",
    notificationsAll: "Ver todas las notificaciones",
    loadError: "No pudimos cargar esta información. Inténtalo de nuevo en unos minutos.",
    notConfigured: "El panel necesita la conexión con Supabase, que aún no está configurada en este entorno.",
  },

  // Notification list (/notificaciones) and bell.
  notificaciones: {
    title: "Notificaciones",
    eyebrow: "Tu cuenta",
    lead: "Avisos privados sobre tu cuenta y los módulos que te interesan.",
    empty: "No tienes notificaciones.",
    markAll: "Marcar todas como leídas",
    markOne: "Marcar como leída",
    open: "Abrir",
    markedAll: "Todas tus notificaciones quedaron como leídas.",
    markedOne: "La notificación quedó como leída.",
    unread: "Sin leer",
    read: "Leída",
    bellLabel: (count: number) => (count === 0 ? "Notificaciones" : `Notificaciones: ${count} sin leer`),
    unreadCount: (count: number) => (count === 1 ? "1 sin leer" : `${count} sin leer`),
    pagination: "Paginación de notificaciones",
    previous: "Anteriores",
    next: "Siguientes",
    pageOf: (page: number) => `Página ${page}`,
    error: "No pudimos actualizar tus notificaciones. Inténtalo de nuevo en unos minutos.",
  },

  // Notification content templates, by kind. The module name is resolved from items above.
  notificationKinds: {
    welcome: {
      title: (name: string) => (name ? `Te damos la bienvenida, ${name}` : "Te damos la bienvenida"),
      body: "Tu perfil docente está listo. Desde el panel puedes ver los módulos que estamos preparando.",
    },
    module_available: {
      title: (moduleName: string) => `Ya está disponible: ${moduleName}`,
      body: (moduleName: string) => `${moduleName} ya se puede usar. Entra desde el panel para conocerlo.`,
    },
  },

  // Module page (/modulos/[id]).
  page: {
    eyebrow: "Módulo",
    contentTitle: "Sobre este módulo",
    back: "Volver al panel",
    blockedTitle: "Este módulo no está disponible para tu cuenta",
    blockedBody: "Por ahora no puedes entrar a este módulo. Vuelve al panel para ver los que sí están disponibles.",
    demoNote: "Módulo de demostración. Solo existe en el entorno de prueba y no tiene funciones comerciales ni de IA.",
  },
} as const;
