# Spec F3 — cierre editorial (completar marcadores del informe con las cifras reales)

Ola F3 de Relevo (semana 5, cierre). F2 escribió el informe, la presentación
y el README ANTES de que E2 y F1 estuvieran en `main`, y dejó marcadores
honestos `[E2: …]` y `[F1: …]` y frases «no está en este árbol». Ahora todo
está en `main`. Tu trabajo es **completar y corregir**, no reescribir.

Lee ENTEROS antes: `informe/INFORME_FINAL.md`, `informe/PRESENTACION.md`,
`informe/GUION_DEMO.md`, `README.md`, y las fuentes de verdad:
`docs/orca/reports/E2_DPO_REPORT.md`, `docs/orca/reports/F1_EVALUACION_REPORT.md`,
`evaluacion/README.md`, `evaluacion/*.md`, `evaluacion/resultados/*.json`,
`ml/runs/comparacion.md` si existe (si no, la tabla está en el reporte E2),
y el commit `a21a6d6` (`git show a21a6d6 --stat` y su mensaje: explica el
reindexado del corpus a 20 documentos / 589 chunks tras corregir el
encoding de Función Pública).

## Archivos que PUEDES tocar (nada más)

- `informe/INFORME_FINAL.md`, `informe/PRESENTACION.md`, `informe/GUION_DEMO.md`
- `README.md`
- `docs/entrega/S5_informe.html`, `docs/entrega/S5_presentacion.html`
  (regenerar con el mismo método que usó F2; lee cómo los generó en
  `docs/orca/reports/F2_ENTREGA_REPORT.md`)
- `docs/orca/reports/F3_CIERRE_REPORT.md`

PROHIBIDO tocar cualquier otra cosa (código, tests, `evaluacion/`, otros docs).

## Requisitos

1. **Cero marcadores**: al terminar, `grep -rnE "\[E2:|\[F1:" informe README.md`
   debe devolver vacío. Cada marcador se sustituye por la cifra real con su
   fuente (reporte o archivo de `evaluacion/resultados/`).
2. **Cifras a incorporar** (todas están en los reportes; verifica cada una):
   - DPO (E2): 120 decisiones simuladas → 91 aprobaciones / 29 correcciones
     → 29 pares; v2: loss 0.693→0.586, rewards/accuracies 0.6875, tiempo y
     VRAM del `metricas.json` literal del reporte E2. Tabla base | v1 | v2
     con delta e IC 95 % bootstrap (v1 76.92 % [66.15, 87.69]; v2 83.08 %
     [73.85, 90.77]); subgrupos (quitar: acción 50 % → 90 %, total 50 % →
     70 %; fechas F1 sin cambio; fechas absolutas n=5 en 0 %). La lectura
     honesta: el DPO corrigió la acción, no el calendario; los intervalos se
     solapan.
   - Servicio del extractor (E2): `npm run extractor:dev`, puerto 8642,
     v2 por defecto, latencia 69 s en frío / 11 s en caliente, humo «ponle
     el de la noche a Ana el puente» → Ana Mery, N, 2026-10-12, asignar.
   - Citas (F1): 20 preguntas doradas, **modo híbrido** recall@3 97.5 %,
     @5 100 %, @8 100 %, MRR 0.933; y el contraste con **modo léxico** de
     la primera corrida de F1 (recall 12.5 %, MRR 0.150) si el reporte F1
     lo conserva — si no, cítalo como «corrida léxica previa» solo si hay
     evidencia en el reporte; de lo contrario omite el contraste. Juez
     LLM: pendiente de `XAI_API_KEY`.
   - Auditor (F1): 20/20, precisión 100 % por clase, matriz 3×3 diagonal;
     lista de las 10 trampas nuevas.
   - Aprobación (F1): simulador 75.83 % (91/120); humanos 0 filas,
     pendiente de sesiones.
   - Corpus: la cifra vigente es **20 documentos / 589 chunks** (commit
     `a21a6d6`, reindexado tras corregir el BOM de Función Pública); la de
     B2 (18/497) queda como histórica. Corrige las frases «no hay reporte
     que explique el reindexado» citando ese commit.
   - Extractor: quitar todo «no está en este árbol» sobre `ml/servir_extractor.py`,
     `extractor:dev`, `evaluacion/`, `ml/comparar_versiones.py`: ya existen.
   - Grok: sigue pendiente (sin clave). Déjalo explícito, no lo rellenes.
   - Usuarios: sigue pendiente de sesiones; el protocolo YA existe en
     `evaluacion/PROTOCOLO_USUARIOS.md` — corrige las frases que dicen que
     no está.
3. **Tabla del resumen ejecutivo y del README**: actualizadas con las
   cifras finales (v2, citas, auditor, aprobación, corpus 20/589).
4. **Presentación**: diapositivas de DPO, citas y auditor con las cifras;
   notas del orador coherentes.
5. **Estructura del repo** en informe y README: `evaluacion/` y `ml/dpo/`
   ya existen.
6. **Regenera** `docs/entrega/S5_informe.html` y `S5_presentacion.html` y
   verifica que cargan (mismo método de F2).
7. **Calidad**: no cambies el tono ni la estructura; español; UTF-8 sin BOM;
   cada cifra nueva con su fuente entre paréntesis o en la columna Fuente.

## Gates

```
grep -rnE "\[E2:|\[F1:" informe README.md    → vacío
npm run lint && npm test && npm run build     → verdes (no tocas código)
```

## Entrega

- Reporte `docs/orca/reports/F3_CIERRE_REPORT.md`: lista de cada marcador
  sustituido (antes → después, con fuente), salida del grep vacío y de los
  gates. Hash = `git rev-parse HEAD`.
- Commit único: `docs(entrega): cierre editorial con las cifras de E2 y F1 (F3)`
- Sin push, sin merge, sin PR.
