import type { MetadataRoute } from "next";
import { product } from "@/config/product";

// PWA manifest for installing the app on a phone. There is no service worker and no offline
// page on purpose: private responses are never cached. Colors mirror the light theme tokens
// in globals.css (--background and --primary).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: product.name,
    short_name: product.name,
    description: "Plataforma para docentes peruanos.",
    lang: product.locale,
    start_url: "/panel",
    scope: "/",
    display: "standalone",
    background_color: "#f9f6f1",
    theme_color: "#1d595d",
    icons: [
      { src: "/pwa-icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/pwa-icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
