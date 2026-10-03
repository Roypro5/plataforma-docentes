import type { Metadata } from "next";
import { FoundationProvider, AppShell } from "@/components/foundation/shell";
import "./globals.css";
import { product } from "@/config/product";

export const metadata: Metadata = {
  title: { default: `${product.name} · Tu espacio docente`, template: `%s · ${product.name}` },
  description: "Plataforma para docentes peruanos. Versión de prueba en desarrollo, sin cobros.",
  robots: { index: false, follow: false },
  openGraph: {
    title: `${product.name} · Tu espacio docente`,
    description: "Un espacio pensado para acompañar tu trabajo docente. Versión de prueba en desarrollo.",
    locale: "es_PE",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-PE" suppressHydrationWarning>
      <body>
        <FoundationProvider><AppShell>{children}</AppShell></FoundationProvider>
      </body>
    </html>
  );
}