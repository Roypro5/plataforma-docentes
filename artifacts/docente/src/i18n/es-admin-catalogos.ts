// Texts of /admin/catalogos (stage 4).
export const adminCatalogos = {
  title: "Catálogos",
  lead: "Revisa y ajusta los nombres de regiones, UGEL, niveles y grados, y activa o desactiva cada elemento.",
  note: "Aquí solo se puede renombrar y activar o desactivar: no se crean ni se borran elementos. Los códigos oficiales llegan con la importación del padrón MINEDU.",
  deactivateNote: "Desactivar un elemento lo quita de las listas del registro y no cambia los perfiles que ya lo tienen.",
  syntheticNote: "«Sintético» marca elementos de prueba que no vienen del padrón oficial.",

  tabsLabel: "Tipo de catálogo",
  kinds: {
    region: { tab: "Regiones", singular: "región" },
    ugel: { tab: "UGEL", singular: "UGEL" },
    level: { tab: "Niveles", singular: "nivel" },
    grade: { tab: "Grados", singular: "grado" },
  },

  filter: {
    searchLabel: "Buscar por nombre o código",
    searchPlaceholder: "Ej.: Lima",
    parentLabel: { ugel: "Región", grade: "Nivel" },
    parentAll: { ugel: "Todas las regiones", grade: "Todos los niveles" },
    apply: "Buscar",
    clear: "Limpiar filtros",
  },

  list: {
    label: (kind: string) => `Lista: ${kind}`,
    empty: "No hay elementos con esos filtros.",
    code: "Código",
    parent: "Región",
    noCode: "Sin código",
    synthetic: "Sintético",
    active: "Activo",
    inactive: "Inactivo",
  },

  rename: {
    summary: "Renombrar",
    summaryFor: (name: string) => `Renombrar: ${name}`,
    label: "Nombre nuevo",
    hint: (max: number) => `De 1 a ${max} caracteres.`,
    submit: "Guardar nombre",
    saved: "El nombre se actualizó.",
  },

  status: {
    activate: "Activar",
    activateFor: (name: string) => `Activar: ${name}`,
    deactivate: "Desactivar",
    deactivateFor: (name: string) => `Desactivar: ${name}`,
    confirmTitle: (name: string) => `¿Desactivar «${name}»?`,
    confirmBody: "Dejará de ofrecerse en el registro. Los perfiles que ya lo tienen no cambian. Podrás activarlo de nuevo.",
    confirmLabel: "Desactivar",
    activated: "El elemento quedó activo.",
    deactivated: "El elemento quedó inactivo.",
  },

  errors: {
    name: (max: number) => `El nombre debe tener de 1 a ${max} caracteres.`,
    invalid: "Revisa los datos ingresados.",
  },
} as const;
