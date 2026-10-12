# Informe de cifras finales: Grok 4.7 y juez de citas

Rama `docs/informe-cifras` (base `chore/grok-4-7`). Sin cambios de código.

## Qué cambió

| Cifra | Antes | Después | Fuente |
|---|---|---|---|
| Grok, exactitud total | pendiente | 98,46 % [95,38 %, 100,00 %] | `evaluacion/extraccion.md`, `evaluacion/resultados/extraccion.json` |
| Grok, empleado / turno / acción / justificación / JSON válido | pendiente | 100,00 % cada uno | ídem |
| Grok, fechas (F1) | pendiente | 98,46 % | ídem |
| Fidelidad del juez de citas | pendiente | 0,926 (16 de 20 en 1,000; mínimo 0,500 en c02) | `evaluacion/citas.md`, `evaluacion/resultados/citas.json` |
| Modelo del asistente | Grok 4.6 | Grok 4.7 (4.6 queda como historia de la propuesta y de la ola C1) | commit `2b15c75` |

Recall@3 97,50 %, @5 100 %, @8 100 % y MRR 0,933 no cambian.

## Narrativa

- La pregunta prospectiva se reescribe: hoy la frontera gana (98,46 % contra 83,08 %, intervalos sin solape, unos 15 pp).
- El DPO cerró parte de la brecha donde apuntaba la corrección humana (`quitar` 50 % a 90 %). La brecha restante es sobre todo de fechas (F1 84,62 % contra 98,46 %).
- Implicación: el modelo pequeño solo es viable por costo y privacidad con más datos de corrección, y la tarjeta hace barato acumularlos. No se afirma ni que alcance ni que no pueda alcanzar a la frontera.
- Cautelas escritas en la sección 10: una sola corrida de Grok sobre 65 órdenes; el juez es el mismo modelo del asistente; 20 preguntas.
- Sección 8.2: párrafo de lectura del juez (preguntas bajas c02, c03, c04, c12; en ellas el artículo ya estaba en el top 3). Se documenta el reintento del juez (3 por pregunta, commit `e5385fe`).

## Pendientes que se conservan

Sesiones con personas (0 filas humanas) y despliegue.

## Fuera de alcance, sin tocar

- `informe/GUION_DEMO.md`: dice `RELEVO_MODELO=grok-4.6` (línea 13) y que la columna Grok «sigue pendiente» (línea 146).
- `informe/figuras/componentes.md`: diagrama con «Grok 4.6».

## HTML

`docs/entrega/S5_informe.html` se regeneró con el método de F2/F3: el Markdown va en `<script type="text/plain" id="fuente-md">` y lo renderizan marked 15.0.7 y mermaid 10.9.3 desde cdnjs (mismos scripts). Antes de regenerar se comprobó que el bloque embebido era idéntico al Markdown de `HEAD`.
