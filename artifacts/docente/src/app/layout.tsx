import type { Metadata } from "next";
import { FoundationProvider, AppShell } from "@/components/foundation/shell";
import "./globals.css";
import { product } from "@/config/product";

export const metadata: Metadata = {
  title: { default: `${product.name} · Tu espacio docente`, template: `%s · ${product.name}` },
  description: "Base de la plataforma para docentes peruanos. Demostración de la etapa 1, sin cuentas ni cobros.",
  robots: { index: false, follow: false },
  openGraph: {
    title: `${product.name} · Tu espacio docente`,
    description: "Un espacio pensado para acompañar tu trabajo docente. Etapa 1 en desarrollo.",
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