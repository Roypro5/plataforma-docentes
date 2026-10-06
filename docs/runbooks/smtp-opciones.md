# Correo de Auth (SMTP): opciones para el lanzamiento

Decisión 5 del [plan de lanzamiento](../architecture/lanzamiento-plan.md). El propietario elige el proveedor; no se crea ninguna cuenta ni se contrata nada sin su confirmación. Las tarifas se consultaron el 06/10/2026 y **se revalidan antes de crear la cuenta**.

## Por qué hace falta

- El SMTP integrado de Supabase solo envía **unos 2 correos por hora**. Esos correos son los de confirmación de registro, recuperación de contraseña y cambio de correo.
- Con un SMTP propio, Supabase empieza con un límite de **30 correos por hora**, que se puede ajustar en *Auth → Rate Limits*.

Fuente: [documentación de Supabase](https://supabase.com/docs/guides/auth/auth-smtp).

## Requisito común: un dominio propio

Todos los proveedores transaccionales piden **verificar un dominio** con registros DNS (SPF, DKIM y DMARC) para enviar con buena entregabilidad. Por eso:

- El **dominio** (decisión 3) pasa a ser necesario **antes del piloto**, no solo para la apertura pública. Su costo es anual y depende del registrador y de la extensión: hay que revisarlo al comprarlo.
- La web del piloto puede seguir en `vercel.app`. El dominio se usa al menos para el remitente, por ejemplo `no-responder@<dominio>`.

## Comparación

| Proveedor | Nivel gratuito | Primer plan de pago | SMTP | Fuente |
|---|---|---|---|---|
| **Resend** | 3 000 correos al mes, máximo 100 al día, 3 dominios | US$ 20 al mes: 50 000 correos al mes | Sí, en todos los planes | [resend.com/pricing](https://resend.com/pricing) |
| **Brevo** | Unos 300 correos al día (sin confirmar); incluye correo transaccional por API y SMTP | Desde unos US$ 9 al mes, según el volumen (sin confirmar) | Sí | La página oficial no se pudo leer automáticamente. Las cifras salen de fuentes secundarias ([ejemplo](https://dreamlit.ai/blog/brevo-review)) y **deben confirmarse en brevo.com** |
| **MailerSend** | 500 correos al mes, 1 dominio | Hobby, US$ 5.60 al mes: 5 000 correos al mes | Sí, también en el gratuito | [mailersend.com/pricing](https://www.mailersend.com/pricing) |

Supabase menciona además AWS SES, Postmark, Twilio SendGrid y ZeptoMail como opciones compatibles. No se compararon aquí.

## Recomendación

- **Para el piloto: Resend, nivel gratuito.** Sus 100 correos al día bastan para un piloto con docentes invitados. Es uno de los proveedores que cita Supabase, la tarifa está publicada con claridad y cuesta US$ 0.
- **Para la apertura pública:** revisar el volumen real del piloto. Si se acerca a 100 correos al día o a 3 000 al mes, pasar al plan de pago o comparar con Brevo, con sus tarifas confirmadas.

## Pasos cuando el propietario elija (fase C)

1. El propietario crea la cuenta en el proveedor y verifica el dominio con los registros DNS que este indique.
2. El propietario genera la credencial SMTP en el proveedor y la pega **directamente** en Supabase: *Authentication → Emails → SMTP Settings*. Nunca pasa por el chat, por archivos ni por los logs.
3. En *Auth → Rate Limits* se ajusta el límite de correos por hora a lo que permita el plan.
4. Prueba: registro de una cuenta nueva y recuperación de contraseña. Los dos correos deben llegar a la bandeja de entrada, no a spam.
