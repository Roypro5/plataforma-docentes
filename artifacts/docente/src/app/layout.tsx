import type { Metadata } from "next";
import { FoundationProvider, AppShell } from "@/components/foundation/shell";
import "./globals.css";
import { features } from "@/config/features";
import { product } from "@/config/product";
import { es } from "@/i18n/es";

export const metadata: Metadata = {
  title: { default: `${product.name} · Tu espacio docente`, template: `%s · ${product.name}` },
  description: features.stageInfo ? es.meta.description : es.meta.descriptionProduct,
  robots: { index: false, follow: false },
  openGraph: {
    title: `${product.name} · Tu espacio docente`,
    description: features.stageInfo ? es.meta.ogDescription : es.meta.ogDescriptionProduct,
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