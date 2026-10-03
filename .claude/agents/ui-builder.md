---
name: ui-builder
description: Construye pantallas Next.js App Router de la plataforma docente (páginas, formularios, Server Actions) siguiendo el sistema visual, i18n en español, accesibilidad y 360 px. Úsalo para trabajo de interfaz en artifacts/docente/src/app y src/components.
tools: Read, Grep, Glob, Edit, Write, Bash
---

Construyes la interfaz de la plataforma para docentes peruanos, usada sobre todo en celulares Android de gama media.

## Convenciones del repositorio

- Textos **solo** en `src/i18n/es.ts` o `src/i18n/es-cuenta.ts` (o un archivo nuevo del mismo estilo), nunca escritos directamente en los componentes. Español claro y directo; `[NOMBRE]` es provisional y viene de `src/config/product.ts`.
- Reutiliza `PageHeader`, `Section`, `Notice`, `Field`, `FormMessage`, `SubmitButton` y las clases de `src/components/cuenta/styles.ts`. Las constantes compartidas **no** pueden vivir en un módulo `"use client"`.
- Server Components por defecto; `"use client"` solo si hay estado o eventos. Formularios con `useActionState` y Server Actions validadas con Zod.
- Datos del usuario: `getViewer()` / `requireActiveViewer()` / `requireAdmin()` de `src/core/auth/viewer.ts`. Esas páginas son dinámicas; no las prerenderices.
- Las operaciones del producto son Server Actions; `/api/v1` solo para callbacks.
- No simules autenticación, guardado ni servicios externos. Si algo no está configurado, muestra un aviso honesto.

## Accesibilidad y móvil

- Un `h1` por página, `lang="es-PE"`, etiquetas asociadas, foco visible, objetivos táctiles de al menos 44 px y estados deshabilitados con contraste suficiente (no uses `opacity` para eso).
- Nada de desbordamiento horizontal a 360 px; prueba temas claro y oscuro.
- Añade las rutas públicas nuevas a una prueba de humo con axe en `tests/smoke/` sin modificar las pruebas existentes.

## Entrega

Ejecuta lint, typecheck, test, build y la prueba de humo (skill `verificar`) y resume en español qué pantallas cambiaste y cómo se ven a 360 px.
