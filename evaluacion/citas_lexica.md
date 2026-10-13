# Métrica 2 — fidelidad de citas (control: solo búsqueda léxica)

Corrida de control del 2026-10-12 con el servicio de embeddings apagado, para comparar con la corrida híbrida de `citas.md`. Mismas 20 preguntas y mismo juez (Grok 4.7).

Dataset: `evaluacion/citas_doradas.jsonl` (20 preguntas). Recuperación con `buscarNorma` sobre PostgreSQL en localhost:5432, k=8. El artículo hace match por su número (`art. 168` y cualquier chunk con ese número cuentan igual, aunque el número se repita en otra ley).

Modo de esta corrida: 0 híbrida, 20 léxica. La híbrida exige el servicio de embeddings (`npm run embed:dev`, puerto 8631). Si no responde, la búsqueda cae a léxica y el modo queda registrado.

Recall@k macro: @3 12.50 %, @5 12.50 %, @8 12.50 %. MRR macro: 0.150. El MRR usa el primer artículo esperado dentro de los 8 devueltos; si no aparece, aporta 0.

| id | modo | recall@3 | recall@5 | recall@8 | MRR | juez |
|---|---|---:|---:|---:|---:|---:|
| c01 | lexica | 0.00 % | 0.00 % | 0.00 % | 0.000 | 0.000 |
| c02 | lexica | 0.00 % | 0.00 % | 0.00 % | 0.000 | 0.000 |
| c03 | lexica | 0.00 % | 0.00 % | 0.00 % | 0.000 | 0.000 |
| c04 | lexica | 0.00 % | 0.00 % | 0.00 % | 0.000 | 0.000 |
| c05 | lexica | 0.00 % | 0.00 % | 0.00 % | 0.000 | 0.000 |
| c06 | lexica | 0.00 % | 0.00 % | 0.00 % | 0.000 | 0.000 |
| c07 | lexica | 0.00 % | 0.00 % | 0.00 % | 0.000 | 0.000 |
| c08 | lexica | 0.00 % | 0.00 % | 0.00 % | 0.000 | 0.000 |
| c09 | lexica | 0.00 % | 0.00 % | 0.00 % | 0.000 | 0.000 |
| c10 | lexica | 0.00 % | 0.00 % | 0.00 % | 0.000 | 0.000 |
| c11 | lexica | 100.00 % | 100.00 % | 100.00 % | 1.000 | 1.000 |
| c12 | lexica | 0.00 % | 0.00 % | 0.00 % | 0.000 | 0.000 |
| c13 | lexica | 0.00 % | 0.00 % | 0.00 % | 0.000 | 0.000 |
| c14 | lexica | 0.00 % | 0.00 % | 0.00 % | 0.000 | 0.000 |
| c15 | lexica | 100.00 % | 100.00 % | 100.00 % | 1.000 | 1.000 |
| c16 | lexica | 0.00 % | 0.00 % | 0.00 % | 0.000 | 0.750 |
| c17 | lexica | 0.00 % | 0.00 % | 0.00 % | 0.000 | 0.000 |
| c18 | lexica | 0.00 % | 0.00 % | 0.00 % | 0.000 | 0.000 |
| c19 | lexica | 50.00 % | 50.00 % | 50.00 % | 1.000 | 1.000 |
| c20 | lexica | 0.00 % | 0.00 % | 0.00 % | 0.000 | 0.000 |
| macro |  | 12.50 % | 12.50 % | 12.50 % | 0.150 | 0.188 |

Fuera del top 3 o sin el artículo esperado en el primer puesto: c01 (recall@3 0.00 %, MRR 0.000); c02 (recall@3 0.00 %, MRR 0.000); c03 (recall@3 0.00 %, MRR 0.000); c04 (recall@3 0.00 %, MRR 0.000); c05 (recall@3 0.00 %, MRR 0.000); c06 (recall@3 0.00 %, MRR 0.000); c07 (recall@3 0.00 %, MRR 0.000); c08 (recall@3 0.00 %, MRR 0.000); c09 (recall@3 0.00 %, MRR 0.000); c10 (recall@3 0.00 %, MRR 0.000); c12 (recall@3 0.00 %, MRR 0.000); c13 (recall@3 0.00 %, MRR 0.000); c14 (recall@3 0.00 %, MRR 0.000); c16 (recall@3 0.00 %, MRR 0.000); c17 (recall@3 0.00 %, MRR 0.000); c18 (recall@3 0.00 %, MRR 0.000); c19 (recall@3 50.00 %, MRR 1.000); c20 (recall@3 0.00 %, MRR 0.000). El match es por número de artículo, así que un «art. 22» de otra ley también cuenta.

El juez (Grok) puntuó la fidelidad media en 0.188. Cada valor es la fracción de afirmaciones de la respuesta que el juez marcó como soportadas por los fragmentos citados.
