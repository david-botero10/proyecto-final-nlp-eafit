# Corpus normativo de Relevo

Fuentes públicas colombianas para el RAG (jornada, recargos, descansos).
Los crudos y el caché **no se versionan**: `.gitignore` ignora `corpus/raw/`
y `corpus/cache/`.

## Contenido versionado

- `fuentes.json` — catálogo con `id`, `titulo`, `tipo` (`ley` / `cartilla`),
  `url`, `formato` (`html` / `pdf`) y `vigencia` (nota textual).

## Cómo indexar

Desde la raíz del repo, con el venv de `ml/`:

```
python ml/indexar.py --solo-descarga
python ml/indexar.py --desde-cache --sin-bd --limit 40
```

`--solo-descarga` escribe `corpus/raw/<id>.<ext>` y `corpus/raw/manifiesto.json`
(id, URL final, sha256, bytes, fecha). Si el hash ya está y el archivo
coincide, no redescarga; `--forzar` invalida esa caché.

`--sin-bd` deja `corpus/cache/chunks.jsonl` (metadatos + embedding 1024 d)
sin tocar PostgreSQL. El upsert a `documentos` / `chunks` es de la ola B2.

## Fuentes definitivas (ola A3)

Leyes verificadas con GET real (200):

- Código Sustantivo del Trabajo, texto consolidado de la Secretaría del
  Senado, 18 páginas HTML (`codigo_sustantivo_trabajo.html` y
  `_pr001` … `_pr017`). HTTP responde; HTTPS del Senado no conecta.
- Ley 2101 de 2021 y Ley 2466 de 2025 en el Gestor normativo de Función
  Pública (HTML).

Cartillas PDF del Ministerio del Trabajo: ningún URL oficial de cartilla
de jornada / trabajo suplementario respondió (se documenta en
`docs/orca/reports/A3_CORPUS_REPORT.md`). El corpus de esta ola queda
solo con las leyes. El chunker de cartillas sí está cubierto con un PDF
mínimo generado en los tests.
