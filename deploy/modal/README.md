# Relevo en Modal: servicios de modelos

App de Modal `relevo-modelos` con los dos servicios que el despliegue en la nube
necesita para conservar la recuperación híbrida y el extractor afinado. Los
contratos HTTP son los mismos del montaje local, así que el web solo cambia URLs
(y envía un token).

| Servicio | Etiqueta (URL) | Hardware | Rutas |
|---|---|---|---|
| `Embeddings` | `relevo-embeddings` | CPU 2 núcleos, 8 GB | `POST /embed`, `POST /rerank`, `GET /salud` |
| `Extractor` | `relevo-extractor` | GPU L4 | `POST /extraer`, `GET /salud` |

- Reutiliza `ml/servir.py`, `ml/servir_extractor.py`, `ml/corpus_lib/` y
  `ml/extractor/` (se agregan a la imagen; no se copia lógica).
- bge-m3 y el re-ranker `BAAI/bge-reranker-v2-m3` se cargan una vez por
  contenedor. El re-ranker cabe en 8 GB, así que se incluye; si no carga,
  `/rerank` responde 501 como hoy.
- Extractor: `Qwen/Qwen3.5-0.8B` en 4-bit + adapter `extractor-v2` desde el
  volumen `relevo-adapters`. `GET /salud` devuelve `{"ok": true, "version": "v2"}`.
- Pesos de Hugging Face en el volumen `relevo-hf-cache` (sin descargas en
  arranque en frío).
- Auth: `Authorization: Bearer <MODELOS_TOKEN>` en todo menos `GET /salud`
  (401 si falta o no coincide; si el servicio no tiene token, rechaza todo).

## Comandos, en orden

Desde la raíz del repo, con el cliente instalado (`pip install -r deploy/modal/requirements.txt`).

```bash
# 1. Login (lo hace el usuario, interactivo; abre el navegador)
modal token new

# 2. Volúmenes (los crea también app.py, pero así queda explícito)
modal volume create relevo-hf-cache
modal volume create relevo-adapters

# 3. Subir el adapter (no está en git)
modal volume put relevo-adapters ml/models/extractor-v2 /extractor-v2

# 4. Secreto compartido. Genera el token UNA vez, guárdalo en .env como
#    MODELOS_TOKEN (y luego en Vercel) y pásalo por variable de entorno,
#    sin escribirlo en la línea de comandos ni mostrarlo:
export MODELOS_TOKEN="$(openssl rand -hex 32)"
modal secret create relevo-modelos MODELOS_TOKEN="$MODELOS_TOKEN"

# 5. Descargar pesos al volumen (una vez, ~6 GB, unos minutos)
modal run deploy/modal/app.py::descargar_modelos

# 6. Desplegar
modal deploy deploy/modal/app.py
```

Verifica que el adapter quedó donde se espera: `modal volume ls relevo-adapters /extractor-v2`
debe listar `adapter_config.json` y `adapter_model.safetensors`.

## URLs y comprobaciones

`modal deploy` imprime las URLs. Siguen el patrón
`https://<workspace>--relevo-embeddings.modal.run` y
`https://<workspace>--relevo-extractor.modal.run`.
Estas, sin barra final, son `EMBED_SERVICE_URL` y `EXTRACTOR_URL` del web.

```bash
EMB=https://<workspace>--relevo-embeddings.modal.run
EXT=https://<workspace>--relevo-extractor.modal.run

curl $EMB/salud                      # {"ok":true}
curl $EXT/salud                      # {"ok":true,"version":"v2"}  (arranque en frío: 30-90 s)

# sin token: 401
curl -i -X POST $EMB/embed -H 'Content-Type: application/json' -d '{"textos":["hola"]}'

# con token: 1024 dimensiones
curl -s -X POST $EMB/embed -H "Authorization: Bearer $MODELOS_TOKEN" \
  -H 'Content-Type: application/json' -d '{"textos":["recargo nocturno"]}' | head -c 120

curl -s -X POST $EXT/extraer -H "Authorization: Bearer $MODELOS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"orden":"ponle el de la noche a Ana el puente","fecha_referencia":"2026-10-12"}'
```

## Cambios que necesita el web para el token

Los clientes actuales no envían el encabezado; aplicar tras fusionar ambas ramas
(`MODELOS_TOKEN` es una variable de entorno nueva en Vercel; si falta, no se
envía nada y el comportamiento local no cambia).

1. `mcp/consultas.ts`, en `embedPorHttp` y en `rerankPorHttp`, cambiar
   `headers: { "Content-Type": "application/json" },` por
   una línea con el spread de la constante de abajo:
   `headers: { "Content-Type": "application/json", ...AUTH_MODELOS },`
2. `lib/agente/extraccion.ts`, en `extraerConLora` (la línea 151), mismo cambio.

Con esta constante a nivel de módulo en cada archivo:

```ts
const AUTH_MODELOS: Record<string, string> = process.env.MODELOS_TOKEN
  ? { Authorization: `Bearer ${process.env.MODELOS_TOKEN}` }
  : {};
```

## Arranque en frío y costo

- **Embeddings**: `min_containers=1` (constante `MIN_CONTAINERS_EMBED` en `app.py`).
  El web corta `/embed` a los 3 s; un contenedor frío tarda decenas de segundos
  cargando bge-m3 y el re-ranker, y el web caería en silencio a búsqueda léxica.
  Con el contenedor caliente, una consulta tarda del orden de 0,3-1 s en CPU
  (estimado, no medido).
- **Extractor**: `min_containers=0`, se apaga a los 120 s sin tráfico. La primera
  orden tras un periodo inactivo supera los 8 s del web y cae a Grok; las
  siguientes usan el modelo afinado. Antes de la demo, caliéntalo con
  `curl $EXT/salud` (no cobra GPU extra más que mientras está encendido).

Costo estimado (tarifas públicas de Modal que conozco; **verificar en
modal.com/pricing**, la documentación instalada del cliente no trae precios):

| Recurso | Tarifa | Por hora |
|---|---|---|
| CPU | US$0,0000131 / núcleo-s | 2 núcleos: ~US$0,094 |
| Memoria | US$0,00000222 / GiB-s | 8 GiB: ~US$0,064 |
| **Embeddings caliente** | | **~US$0,16/h, ~US$3,8/día, ~US$115/mes** |
| GPU L4 | ~US$0,80/h | solo mientras está encendida |
| GPU T4 (alternativa) | ~US$0,59/h | |

Un día entero de keep-warm consume ~US$3,8 del crédito mensual (~US$30). Por eso
no se deja un mes caliente: encender para el ensayo y la presentación y apagar
después. Una sesión de demo del extractor (unos minutos de GPU) cuesta centavos.

## Apagar después de la demo

```bash
# Solo bajar el costo: redeploy con el contenedor de embeddings apagable
RELEVO_EMBED_MIN_CONTAINERS=0 modal deploy deploy/modal/app.py

# Parar todo (las URLs dejan de responder; volúmenes y secreto se conservan)
modal app stop relevo-modelos
```

## Notas

- Kernels rápidos de Qwen3.5 (`flash-linear-attention`, `causal-conv1d`): no se
  instalan por defecto, porque la imagen no se pudo probar sin cuenta. Sin ellos
  transformers usa la ruta en PyTorch (más lenta, mismo resultado, es lo que se
  usó localmente en Windows). Para probarlos: `RELEVO_KERNELS_RAPIDOS=1 modal deploy ...`
  (solo `flash-linear-attention`; `causal-conv1d` exige compilar y se omite).
- Pruebas locales sin Modal: `pytest deploy/modal/test_app.py` (usa modelos falsos).
- GPU: L4 y no T4 porque el entrenamiento y la carga 4-bit usan cómputo en
  bfloat16, que la T4 no soporta de forma nativa. Ambas sobran en memoria
  (el 0.8B en 4-bit ocupa menos de 2 GB).
