# Corrección del humo de accesibilidad — etapa 1

## Sincronización

Se comparó el árbol de `main` remoto con los archivos locales antes de editar. El único cambio remoto era el workflow añadido por el propietario; se sincronizó ese contenido y se conservará en GitHub sin sobrescribirlo.

## Reproducción

La prueba original `foundation routes, accessibility and mobile width` falló localmente igual que en CI:

- Escritorio: contraste insuficiente en las descripciones de navegación y la tarjeta destacada.
- Móvil: la cuadrícula del inicio alcanzaba 402 px en un viewport de 360 px.

Al superar el inicio, la misma prueba descubrió contraste transitorio insuficiente en las tarjetas de la hoja de ruta durante la animación.

## Causas y correcciones

- El estilo `.paper`, fuera de las capas CSS, sobrescribía el fondo responsive de Tailwind. Su estilo base se movió a la capa `components` para que las utilidades puedan modificarlo.
- Las descripciones de navegación reducían opacidad del texto; ahora mantienen el color completo.
- La cuadrícula usaba el tamaño mínimo intrínseco del contenido; ahora define columnas con mínimo cero, incluso en móvil.
- Las tarjetas futuras y las animaciones atenuaban contenido legible; se retiró la atenuación y se conserva el movimiento de entrada sin reducir contraste.

## Verificación

- ESLint: aprobado.
- TypeScript: aprobado, incluido en el build final.
- Vitest: 3/3 aprobadas.
- Build Next.js de producción: aprobado.
- Prueba original Playwright: **2/2 aprobadas**, escritorio y móvil, recorriendo `/`, `/sistema`, `/ayuda` y `/hoja-de-ruta`.
- Se mantiene la aserción de cero violaciones axe para WCAG 2 A/AA y 2.1 AA.
- Se mantiene la aserción de ancho sin desbordamiento.

No se modificaron el archivo de prueba, sus reglas, exclusiones ni el workflow remoto.

En el entorno local Nix se usó el Chromium preinstalado, mediante una configuración auxiliar no versionada que solo adapta ruta del ejecutable y directorios. Se ejecutaron los mismos proyectos y el mismo archivo de prueba contra `next start` y el build de producción. GitHub sigue usando la configuración original y el Chromium instalado por Playwright.

El nuevo CI remoto debe verificarse tras subir el arreglo. La etapa 1 aún no se declara cerrada; no se avanzó a etapa 2.