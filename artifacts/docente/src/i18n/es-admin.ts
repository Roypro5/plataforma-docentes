// Shared texts of the administration panel (stage 4). Each section keeps its own texts in
// es-admin-<section>.ts so they can be built in parallel.
export const admin = {
  eyebrow: "Administración",
  title: "Panel de administración",
  lead: "Gestiona usuarios, módulos, avisos, catálogos, organizaciones de prueba, métricas y auditoría. Todo exige MFA y los cambios quedan registrados en la auditoría.",
  denied: "Tu cuenta no tiene permiso para esta sección.",
  navLabel: "Secciones de administración",
  navMobile: "Ir a otra sección",
  sections: {
    usuarios: { label: "Usuarios", desc: "Buscar, suspender y gestionar roles" },
    modulos: { label: "Módulos", desc: "Estado, países y apagado de emergencia" },
    avisos: { label: "Avisos", desc: "Crear, publicar y despublicar" },
    catalogos: { label: "Catálogos", desc: "Regiones, UGEL, niveles y grados" },
    organizaciones: { label: "Organizaciones de prueba", desc: "Crear organizaciones y gestionar miembros" },
    metricas: { label: "Métricas", desc: "Registros, actividad e interés" },
    auditoria: { label: "Auditoría", desc: "Quién hizo qué y cuándo" },
    "planes-pagos": { label: "Planes y pagos", desc: "Suscripciones y pagos de prueba, solo lectura" },
  },
  pager: {
    label: "Paginación",
    previous: "Anterior",
    next: "Siguiente",
    page: (page: number, pages: number) => `Página ${page} de ${pages}`,
    total: (n: number) => (n === 1 ? "1 resultado" : `${n} resultados`),
  },
  confirm: {
    cancel: "Cancelar",
    confirm: "Confirmar",
  },
  errors: {
    denied: "No tienes permiso para esta acción.",
    invalid: "Revisa los datos ingresados.",
    notFound: "No se encontró el elemento; recarga la página.",
    conflict: "La acción no se puede aplicar en el estado actual; recarga la página.",
    duplicate: "El elemento ya existe.",
    generic: "No se pudo completar la acción. Inténtalo de nuevo.",
  },
  common: {
    none: "Ninguno",
    noResults: "No hay resultados con esos filtros.",
    loadError: "No se pudo cargar la información. Recarga la página.",
    search: "Buscar",
    clear: "Limpiar filtros",
    all: "Todos",
    actions: "Acciones",
    saved: "Cambios guardados.",
  },
};
