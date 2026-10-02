"use client";
import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return <html lang="es-PE"><body>
    <main>
      <h1>No pudimos abrir esta página</h1>
      <p>No se ha guardado ningún dato. Puedes volver a intentarlo.</p>
      <button onClick={reset}>Volver a intentar</button>
      <Link href="/">Ir al inicio</Link>
    </main>
  </body></html>;
}