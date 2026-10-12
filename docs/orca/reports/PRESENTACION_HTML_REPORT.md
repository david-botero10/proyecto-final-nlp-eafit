# Reporte: presentación HTML autónoma

Archivo: `docs/entrega/S5_presentacion.html` (reemplaza la versión anterior).

- 15 láminas (1920×1080, escaladas con `transform: scale()`), en el orden de `deck.json`.
- Navegación: flechas, espacio, AvPág/RePág, Inicio/Fin, clic (mitades), deslizar; hash `#n` sincronizado.
- `N` notas del orador, `F` pantalla completa, `C` contador y barra, `?` ayuda.
- Impresión: `@page 1920px 1080px`, una lámina por página (15 páginas verificadas con PDF).
- Sin JS externo; solo la hoja de DM Sans de Google Fonts, con respaldo Arial.

## Conversiones
- `x-shape arrow-right` a SVG (cuerpo 40 % de alto, cabeza 40 % del largo).
- `x-icon` (Chat, Book, Verified, Lock, Database, Activity, Trust) a SVG de línea propios.
- `aside` a notas ocultas; `data-transition="fade"` a fundido de 250 ms (sin animación con `prefers-reduced-motion`).

## Verificación
- 15 contenedores `<section class="slide">` y 15 notas, en orden.
- 0 etiquetas personalizadas restantes.
- 176 nodos de texto de los fragmentos, 0 ausentes en la salida.
- Servido con `python -m http.server`: 200, 54 727 bytes.
- Renderizado con Chromium de Playwright (láminas 1, 3, 4, 6, 10, 13, notas y PDF) sin errores de consola.

## Compromisos visuales
- Los iconos SVG son dibujos propios, no los del diseño original.
- Se añadió `box-sizing: border-box` y `margin: 0` globales para reproducir el lienzo fijo.
