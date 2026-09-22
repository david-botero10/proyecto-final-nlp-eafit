# Métrica 2 — fidelidad de citas

Dataset: `evaluacion/citas_doradas.jsonl` (20 preguntas). Recuperación con `buscarNorma` sobre PostgreSQL en localhost:5432, k=8. El artículo hace match por su número (`art. 168` y cualquier chunk con ese número cuentan igual, aunque el número se repita en otra ley).

Modo de esta corrida: 20 híbrida, 0 léxica. La híbrida exige el servicio de embeddings (`npm run embed:dev`, puerto 8631). Si no responde, la búsqueda cae a léxica y el modo queda registrado.

Recall@k macro: @3 97.50 %, @5 100.00 %, @8 100.00 %. MRR macro: 0.933. El MRR usa el primer artículo esperado dentro de los 8 devueltos; si no aparece, aporta 0.

| id | modo | recall@3 | recall@5 | recall@8 | MRR | juez |
|---|---|---:|---:|---:|---:|---:|
| c01 | hibrida | 100.00 % | 100.00 % | 100.00 % | 1.000 | pendiente |
| c02 | hibrida | 100.00 % | 100.00 % | 100.00 % | 1.000 | pendiente |
| c03 | hibrida | 100.00 % | 100.00 % | 100.00 % | 1.000 | pendiente |
| c04 | hibrida | 100.00 % | 100.00 % | 100.00 % | 1.000 | pendiente |
| c05 | hibrida | 100.00 % | 100.00 % | 100.00 % | 1.000 | pendiente |
| c06 | hibrida | 100.00 % | 100.00 % | 100.00 % | 1.000 | pendiente |
| c07 | hibrida | 100.00 % | 100.00 % | 100.00 % | 1.000 | pendiente |
| c08 | hibrida | 100.00 % | 100.00 % | 100.00 % | 1.000 | pendiente |
| c09 | hibrida | 100.00 % | 100.00 % | 100.00 % | 1.000 | pendiente |
| c10 | hibrida | 100.00 % | 100.00 % | 100.00 % | 1.000 | pendiente |
| c11 | hibrida | 100.00 % | 100.00 % | 100.00 % | 1.000 | pendiente |
| c12 | hibrida | 100.00 % | 100.00 % | 100.00 % | 1.000 | pendiente |
| c13 | hibrida | 100.00 % | 100.00 % | 100.00 % | 1.000 | pendiente |
| c14 | hibrida | 100.00 % | 100.00 % | 100.00 % | 1.000 | pendiente |
| c15 | hibrida | 100.00 % | 100.00 % | 100.00 % | 1.000 | pendiente |
| c16 | hibrida | 100.00 % | 100.00 % | 100.00 % | 0.333 | pendiente |
| c17 | hibrida | 100.00 % | 100.00 % | 100.00 % | 1.000 | pendiente |
| c18 | hibrida | 50.00 % | 100.00 % | 100.00 % | 1.000 | pendiente |
| c19 | hibrida | 100.00 % | 100.00 % | 100.00 % | 1.000 | pendiente |
| c20 | hibrida | 100.00 % | 100.00 % | 100.00 % | 0.333 | pendiente |
| macro |  | 97.50 % | 100.00 % | 100.00 % | 0.933 | pendiente |

Fuera del top 3 o sin el artículo esperado en el primer puesto: c16 (recall@3 100.00 %, MRR 0.333); c18 (recall@3 50.00 %, MRR 1.000); c20 (recall@3 100.00 %, MRR 0.333). El match es por número de artículo, así que un «art. 22» de otra ley también cuenta.

La columna del juez queda pendiente: requiere XAI_API_KEY en el entorno o en .env. `npm run eval:citas` la completa cuando la clave exista; no es un error de gate.
