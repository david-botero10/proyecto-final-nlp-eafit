# Reporte: servicios de modelos en Modal (T2)

Rama `despliegue-modal`. Archivos: `deploy/modal/app.py`, `README.md`,
`requirements.txt`, `test_app.py`.

## Decisiones
- App `relevo-modelos` con dos servicios (`relevo-embeddings`, `relevo-extractor`)
  que reutilizan `ml/servir.py` y `ml/servir_extractor.py:crear_app`; token Bearer
  por middleware (401 salvo `/salud`, falla cerrado).
- Embeddings en CPU 2 núcleos / 8 GB con bge-m3 y el re-ranker (cabe); keep-warm
  `min_containers=1` en la constante `MIN_CONTAINERS_EMBED` (~US$3,8/día).
- Extractor en GPU L4 (bf16 nativo, como el entrenamiento); escala a cero.
- Sin kernels rápidos de Qwen3.5 por defecto (no verificable sin cuenta); se
  documenta el interruptor `RELEVO_KERNELS_RAPIDOS=1`.

## Verificación
- `pytest deploy/modal/test_app.py`: 11 pasan (contratos, 501, 401, falla cerrado).
- No verificado: build de imágenes y despliegue real (requiere cuenta de Modal).
  Tarifas de costo tomadas de las públicas, a confirmar en modal.com/pricing.

## Pendiente para el orquestador
Cabecera `Authorization` en `mcp/consultas.ts` y `lib/agente/extraccion.ts`
(ver README).
