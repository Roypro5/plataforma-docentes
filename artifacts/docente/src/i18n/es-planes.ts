// Textos de la etapa 5 (planes, pasarela de prueba y Mi plan). Sin importaciones: lo usan también
// las pruebas, que no resuelven el alias "@/".
//
// Todo importe es de PRUEBA: no hay cobro real ni tarjetas. Los textos no prometen más que el
// plan aprobado: Individual cuesta S/ 19.90 de prueba al mes, un periodo de un mes, sin
// renovación automática y con cancelación al final del periodo.

export const planes = {
  common: {
    testLabel: "Precio de prueba",
    testAmountLabel: "Importe de prueba",
    testNotice: "Precios de prueba: no se cobra dinero real ni se usan tarjetas.",
    myPlan: "Mi plan",
    plans: "Planes",
    backToPlans: "Volver a planes",
    error: "No pudimos cargar esta información. Inténtalo de nuevo en unos minutos.",
    perPeriod: { month: "al mes" } as Record<string, string>,
    periodName: { month: "Mensual (1 mes)" } as Record<string, string>,
    noAutoRenewal: "Sin renovación automática.",
    pagination: "Paginación del historial",
    previous: "Anterior",
    next: "Siguiente",
    pageOf: (page: number, total: number) => `Página ${page} de ${total}`,
  },

  // Enlaces desde /panel y /perfil.
  entry: {
    panelLabel: "Tu plan",
    panelBody: "Mira tu plan, sus fechas y tus pagos de prueba.",
  },

  // Nombres y descripciones de los planes (el precio viene de la base de datos).
  planNames: { gratis: "Gratis", individual: "Individual" } as Record<string, string>,
  planSummary: {
    gratis: "Para empezar en la plataforma.",
    individual: "Plan personal mensual, en versión de prueba.",
  } as Record<string, string>,
  // Lo que incluye cada plan. Los derechos de plan vienen de la base de datos (entitlement_codes).
  includes: {
    base: "Tu panel, tu perfil y las notificaciones de la plataforma.",
    all: "Todo lo del plan Gratis.",
    entitlements: { "demo.access": "Acceso al módulo demo (entorno de prueba)." } as Record<string, string>,
    otherEntitlement: "Otros accesos del plan.",
  },

  // /planes
  planesPage: {
    eyebrow: "Planes",
    title: "Elige tu plan",
    lead: "Compara Gratis e Individual. Los precios son de prueba: no se cobra dinero real.",
    listLabel: "Planes disponibles",
    includesTitle: "Incluye",
    freePrice: "Sin costo",
    currentPlan: "Tu plan actual",
    seeMyPlan: "Ver Mi plan",
    choose: "Elegir Individual",
    continuePending: "Continuar con el pago pendiente",
    sandboxOff: "Los pagos de prueba no están habilitados en este entorno, así que por ahora no se puede contratar un plan.",
    sandboxOffTitle: "Pagos de prueba no habilitados",
    noPlans: "No hay planes disponibles por ahora.",
    periodNote: "Un periodo de un mes. Sin renovación automática. Puedes cancelar al final del periodo.",
  },

  // /planes/checkout
  checkout: {
    eyebrow: "Planes",
    title: "Resumen de tu compra",
    lead: "Revisa los datos antes de ir a la pasarela de prueba. No se cobra dinero real.",
    crumb: "Resumen",
    summaryTitle: "Tu pedido",
    plan: "Plan",
    price: "Precio",
    period: "Periodo",
    cancelInfo: "Puedes cancelar al final del periodo y conservar el acceso hasta esa fecha.",
    continue: "Continuar a la pasarela de prueba",
    alreadyTitle: "Ya tienes un plan vigente",
    alreadyBody: "Tu plan Individual está activo. Revisa sus fechas y opciones en Mi plan.",
    notAvailable: "El plan Individual no está disponible para tu país por ahora.",
  },

  // /planes/sandbox/[pago]
  sandbox: {
    eyebrow: "Planes",
    title: "Pasarela de prueba (sandbox)",
    lead: "Esto es una simulación para probar la plataforma. No es un pago real.",
    crumb: "Pasarela de prueba",
    tag: "SANDBOX",
    banner: "Aquí no se cobra dinero real y no se piden datos de tarjeta. Elige el resultado que quieres probar.",
    amount: "Importe",
    plan: "Plan",
    status: "Estado del pago",
    expires: "Vence",
    chooseTitle: "Elige un resultado",
    approve: "Aprobar",
    reject: "Rechazar",
    leavePending: "Dejar pendiente",
    cancel: "Cancelar pago",
    resolvedTitle: "Este pago ya no se puede cambiar",
    resolvedBody: "Ya tiene un estado final. Mira el resultado para ver qué pasó.",
    seeResult: "Ver resultado",
    offTitle: "Pagos de prueba no habilitados",
    offBody: "Los pagos de prueba no están habilitados en este entorno, así que no se puede resolver este pago.",
  },

  // /planes/resultado
  resultado: {
    eyebrow: "Planes",
    title: "Resultado del pago",
    lead: "Este resultado es el estado guardado del pago de prueba.",
    crumb: "Resultado",
    invalidTitle: "No encontramos ese pago",
    invalidBody: "El enlace no es válido o el pago no es tuyo.",
    retry: "Intentar de nuevo",
    goDemo: "Ir al módulo demo",
    backToSandbox: "Volver a la pasarela de prueba",
    outcome: {
      approved: {
        title: "Pago aprobado (prueba)",
        body: "Tu plan Individual ya está activo. No se cobró dinero real.",
      },
      rejected: {
        title: "Pago rechazado (prueba)",
        body: "No se activó ningún plan y no se cobró nada. Puedes intentarlo de nuevo.",
      },
      canceled: {
        title: "Pago cancelado (prueba)",
        body: "No se activó ningún plan y no se cobró nada. Puedes intentarlo de nuevo.",
      },
      expired: {
        title: "El pago venció (prueba)",
        body: "Se acabó el tiempo para completar este pago y no se activó ningún plan. Puedes intentarlo de nuevo.",
      },
      pending: {
        title: "Pago pendiente (prueba)",
        body: "Tu pago sigue pendiente y tu plan todavía no está activo. Vuelve a la pasarela de prueba para resolverlo.",
      },
    },
  },

  // /mi-plan
  miPlan: {
    eyebrow: "Tu cuenta",
    title: "Mi plan",
    lead: "Revisa tu plan, sus fechas y el historial de pagos de prueba.",
    currentTitle: "Plan actual",
    freeBody: "Estás en el plan Gratis.",
    seePlans: "Ver planes",
    period: "Periodo",
    periodRange: (from: string, to: string) => `Del ${from} al ${to}`,
    accessUntil: (to: string) => `Tu acceso vigente llega hasta el ${to}.`,
    price: "Precio",
    cancelsOn: (date: string) => `Se cancela el ${date}`,
    cancelsNote: "Conservas el acceso hasta esa fecha. Si cambias de idea, puedes reanudar.",
    cancel: "Cancelar al final del periodo",
    cancelTitle: "¿Cancelar al final del periodo?",
    cancelBody: (date: string) => `Conservarás el acceso hasta el ${date}. No hay renovación automática ni se cobra nada.`,
    cancelConfirm: "Sí, cancelar",
    resume: "Reanudar plan",
    canceled: "Listo. Tu plan se cancelará al final del periodo y conservas el acceso hasta entonces.",
    resumed: "Listo. Tu plan sigue vigente y ya no está marcado para cancelarse.",
    pendingTitle: "Tienes un pago de prueba pendiente",
    pendingBody: "Todavía no se activó ningún plan. Puedes continuar con ese pago.",
    continuePending: "Continuar con el pago pendiente",
    historyTitle: "Historial de pagos",
    historyList: "Pagos de prueba",
    historyEmpty: "Todavía no tienes pagos.",
    paymentOn: "Fecha",
    paymentStatus: "Estado",
    paymentPlan: "Plan",
  },

  paymentStatus: {
    pending: "Pendiente",
    approved: "Aprobado",
    rejected: "Rechazado",
    canceled: "Cancelado",
    expired: "Vencido",
  } as Record<string, string>,

  errors: {
    generic: "No pudimos completar la operación. Inténtalo de nuevo en unos minutos.",
    denied: "Los pagos de prueba no están habilitados en este entorno.",
    invalid: "Esa opción no es válida. Vuelve a Planes e inténtalo de nuevo.",
    notFound: "No encontramos ese pago.",
    conflict: "Ya tienes un plan vigente. Revísalo en Mi plan.",
    checkoutInvalid: "Ese plan no está disponible para contratar en tu país.",
    cancelNone: "No tienes un plan vigente que cancelar.",
    cancelAlready: "Tu plan ya está marcado para cancelarse al final del periodo.",
    resumeNone: "Tu plan no está marcado para cancelarse, así que no hay nada que reanudar.",
  },
} as const;

export type PlanesErrorKey = keyof typeof planes.errors;
