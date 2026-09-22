# Spec F2 — entrega (informe técnico, presentación, guion de demo, README final)

Ola F2 de Relevo (semana 5). Lee ENTEROS antes: `docs/fuentes/` (propuesta
aprobada y PDF del curso con la **rúbrica**), `docs/ARQUITECTURA.md`,
`docs/PLAN_DESARROLLO.md`, `CLAUDE.md`, `README.md`, y TODOS los reportes en
`docs/orca/reports/` (A1…E2): ahí están las decisiones, cifras y evidencias
reales. Lee también `evaluacion/` si ya existe (F1 corre en paralelo; si no
está, deja marcadores `[F1: valor]` claros para que el orquestador los
complete).

## Objetivo

Los entregables finales del curso: **informe técnico**, **presentación** y
**guion de demo**, más el README definitivo. Todo en español, exportable a
PDF, y **defendible con la rúbrica** (originalidad 15 %, calidad técnica 25 %,
uso de tecnologías 15 %, funcionalidad 20 %, evaluación 10 %, presentación
10 %, informe 5 %). Nada de cifras inventadas: cada número sale de un
reporte o de `evaluacion/`, con la referencia.

## Archivos que PUEDES tocar (nada más)

- `informe/**` (nuevo): `INFORME_FINAL.md`, `PRESENTACION.md`,
  `GUION_DEMO.md`, `figuras/` (Mermaid en Markdown; si generas PNG, con
  script reproducible)
- `docs/entrega/**` (agregar `S5_informe.html`, `S5_presentacion.html`,
  generados con el MISMO método que `docs/entrega/S2_arquitectura.html`:
  léelo y reutiliza su plantilla; para la presentación puedes usar
  reveal.js desde cdnjs)
- `README.md`
- `docs/orca/reports/F2_ENTREGA_REPORT.md`

PROHIBIDO tocar: código (`app/`, `lib/`, `mcp/`, `auditor/`, `ml/`, `db/`,
`data/`, `tests/`), `.gitignore`, `docs/ARQUITECTURA.md`,
`docs/PLAN_DESARROLLO.md`, `evaluacion/` (es de F1).

## Requisitos

1. **`informe/INFORME_FINAL.md`** (12–20 páginas equivalentes), estructura:
   1. Resumen ejecutivo (1 página: problema, solución, resultados clave).
   2. Introducción y caso de uso (pyme colombiana, coordinador, principio
      «consultar es autónomo; escribir exige aprobación»).
   3. Trabajo relacionado breve (agentes con herramientas, RAG, human-in-the-
      loop, DPO; 6–10 referencias reales con URL/DOI — no inventes papers).
   4. Arquitectura (reutiliza diagramas de ARQUITECTURA.md; describe cada
      componente inteligente: router, extractor, recuperador híbrido,
      auditor A2A, memoria/perfil, guardrails).
   5. Implementación por componente con decisiones técnicas y por qué
      (tecnologías: Next.js + AI SDK, Grok 4.6, MCP, A2A, pgvector + tsvector,
      bge-m3, Qwen3.5-0.8B QLoRA, TRL DPO, OTel + Phoenix). Incluye la
      sección **«Uso de protocolos abiertos: MCP y A2A»** con ejemplos
      literales de mensajes (de los reportes B1 y D2).
   6. Datos: corpus normativo (fuentes, chunking, 20 documentos / N chunks),
      dataset sintético de nómina, dataset de órdenes (500 + 200 MASSIVE),
      decisiones simuladas y pares de preferencia — con la advertencia
      honesta de qué es sintético/simulado.
   7. Componente de innovación: **la aprobación humana como dato de
      entrenamiento** — el ciclo completo (tarjeta → par → DPO → v2 →
      medición), la pregunta prospectiva y lo que los resultados dicen hoy.
   8. Evaluación: las 4 métricas con tablas (de C3/E2/D2/F1), intervalos,
      subgrupos, análisis de errores con ejemplos reales de los reportes, y
      pruebas con usuarios (protocolo; resultados si existen, si no
      «pendiente de sesiones»).
   9. Observabilidad y gobernanza (Phoenix, guardrails, roles de BD,
      invariante de no-escritura).
   10. Limitaciones, riesgos y trabajo futuro (kernels en Windows, señal DPO
       escasa, cartillas MinTrabajo no descargables, voz, despliegue).
   11. Conclusiones; anexos (comandos de reproducción, estructura del repo,
       créditos del equipo: Isabel Jurado, Alejandro Silva, David Botero).
   Tabla al inicio que mapea **criterio de la rúbrica → dónde está la
   evidencia** (sección/archivo).
2. **`informe/PRESENTACION.md`**: 14–18 diapositivas en Markdown (una por
   `---`), con notas del orador: problema → demo (referencia al guion) →
   arquitectura → MCP/A2A → RAG con citas → tarjeta y auditor → extractor
   afinado (3 % → 77 %) → ciclo DPO → observabilidad → evaluación →
   limitaciones → conclusiones. `docs/entrega/S5_presentacion.html` la
   renderiza con reveal.js (cdnjs), tema claro, en español.
3. **`informe/GUION_DEMO.md`**: demo de 8 minutos paso a paso: qué servicios
   levantar (compose db + phoenix, embed, auditor, extractor, dev), 6
   interacciones exactas a escribir en el chat (consulta de datos con perfil
   de equipo → consulta normativa con citas → orden coloquial que produce
   tarjeta con veredicto → corrección y aprobación → mostrar la fila
   `origen='tarjeta'` y el par de preferencia → traza en Phoenix), qué
   señalar en pantalla en cada paso, y plan B si falla la red (modo
   simulado, capturas). Incluye un **checklist previo** de 10 puntos.
4. **`README.md` final**: reescribe el README como portada del proyecto
   entregado: qué es, resultados clave (tabla corta), arquitectura (1
   diagrama), cómo correrlo de cero (actualizado con embed, auditor,
   extractor, Phoenix y variables de `.env.example`), cómo reproducir cada
   evaluación, estructura del repo, estado por semana, equipo y licencia
   MIT (agrega `LICENSE` si no existe — sí puedes crear ese archivo).
5. **`docs/entrega/S5_informe.html`**: el informe renderizado con la
   plantilla de `S2_arquitectura.html` (Mermaid 10.9.3 + marked 15 desde
   cdnjs, estilos de impresión). Verifica que abre y renderiza (usa
   `python -m http.server` y `curl`, o describe la verificación).
6. **Calidad**: español académico pero claro, UTF-8 sin BOM, sin secretos,
   sin cifras sin fuente. Cada tabla de resultados cita el reporte de origen.

## Gates (en ESTE worktree)

```
npm run lint && npm test && npm run build   (no tocas código; deben seguir verdes)
```

y verificación de que `S5_informe.html` y `S5_presentacion.html` cargan sin
errores de consola (describe cómo lo comprobaste).

## Entrega

- Reporte `docs/orca/reports/F2_ENTREGA_REPORT.md`: índice de lo producido,
  lista de marcadores `[F1: …]` que quedaron pendientes (si los hay), salida
  LITERAL de gates. Hash = `git rev-parse HEAD`.
- Commit único: `docs(entrega): informe final, presentación, guion de demo y README (F2)`
- Sin push, sin merge, sin PR.
