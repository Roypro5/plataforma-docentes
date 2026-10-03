// Texts of /admin/metricas (stage 4).
export const adminMetricas = {
  title: "Métricas",
  lead: "Cifras de uso de la plataforma: registros, actividad, perfiles e interés por módulo.",
  scopeNote: "Las cifras excluyen las cuentas de prueba del seed. Los días se cuentan en hora de Lima.",
  loadError: "No se pudo cargar esta cifra. Recarga la página.",
  none: "Ninguno",

  overview: {
    title: "Resumen",
    total: "Cuentas registradas",
    active: "Cuentas activas",
    suspended: "Cuentas suspendidas",
    onboarded: "Con registro completo",
  },

  signups: {
    title: "Registros por día",
    lead: "Cuentas nuevas en los últimos 30 días.",
    caption: "Registros por día en los últimos 30 días",
    day: "Día",
    count: "Registros",
    chart: "Gráfico",
    total: (n: string) => `Total en 30 días: ${n}`,
  },

  active: {
    title: "Usuarios activos",
    lead: "Cuentas distintas con actividad en la ventana indicada.",
    window: (days: number) => (days === 1 ? "Último día" : `Últimos ${days} días`),
  },

  distribution: {
    title: "Distribución de perfiles",
    lead: "Cuentas activas con registro completo.",
    levelGradeNote: "En niveles y grados se cuentan las selecciones: una cuenta puede aparecer en varias filas.",
    region: "Por región",
    level: "Por nivel",
    grade: "Por grado",
    noRegion: "Sin región",
    users: (n: string) => (n === "1" ? "1 cuenta" : `${n} cuentas`),
  },

  interest: {
    title: "Interés por módulo",
    lead: "Cuentas que pidieron que les avisemos cuando el módulo esté disponible.",
    interested: (n: string) => (n === "1" ? "1 interesada" : `${n} interesadas`),
  },

  conversion: {
    title: "Conversión",
    empty: "Sin datos hasta la etapa 5.",
  },
} as const;
