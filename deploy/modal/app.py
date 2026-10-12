"""Servicios de modelos de Relevo en Modal (app `relevo-modelos`).

Dos servicios web con los mismos contratos HTTP que el montaje local:

- Embeddings (CPU): POST /embed, POST /rerank, GET /salud  (ml/servir.py).
- Extractor (GPU L4): POST /extraer, GET /salud  (ml/servir_extractor.py).

No se copia lógica: la imagen incluye `ml/servir.py`, `ml/servir_extractor.py`,
`ml/corpus_lib/` y `ml/extractor/`, y aquí solo se envuelven con autenticación
por token y con el ciclo de vida de Modal.

Despliegue: ver deploy/modal/README.md.
"""

from __future__ import annotations

import hmac
import os
from pathlib import Path

import modal

# --- Configuración fácil de cambiar -----------------------------------------

# Contenedores de embeddings siempre calientes. 1 = el web (timeout de embed
# de 3 s) nunca ve un arranque en frío. Ponlo en 0 después de la presentación:
#   RELEVO_EMBED_MIN_CONTAINERS=0 modal deploy deploy/modal/app.py
MIN_CONTAINERS_EMBED = int(os.environ.get("RELEVO_EMBED_MIN_CONTAINERS", "1"))

# Segundos sin tráfico antes de apagar un contenedor.
VENTANA_APAGADO_EMBED = 300
VENTANA_APAGADO_EXTRACTOR = 120

# L4 (24 GB, soporta bf16 como en el entrenamiento). T4 es más barata pero
# emula bf16; el 0.8B en 4-bit ocupa < 2 GB, sobra con cualquiera.
GPU_EXTRACTOR = "L4"

# flash-linear-attention acelera la capa Gated DeltaNet de Qwen3.5. Sin ella,
# transformers usa la implementación en PyTorch (más lenta, mismo resultado).
# Déjalo apagado salvo que se pruebe que instala limpio en la imagen.
INSTALAR_KERNELS_RAPIDOS = os.environ.get("RELEVO_KERNELS_RAPIDOS") == "1"

NOMBRE_APP = "relevo-modelos"
VOLUMEN_HF = "relevo-hf-cache"
VOLUMEN_ADAPTERS = "relevo-adapters"
SECRETO = "relevo-modelos"
RUTA_HF = "/hf-cache"
RUTA_ADAPTERS = "/adapters"
ADAPTER_EXTRACTOR = "extractor-v2"
VERSION_EXTRACTOR = "v2"

# En local, deploy/modal/app.py -> <repo>/ml. Dentro del contenedor el archivo
# vive en /root/app.py (sin dos niveles de padres) y ml/ ya está en la imagen.
_AQUI = Path(__file__).resolve()
_ML = _AQUI.parents[2] / "ml" if len(_AQUI.parents) > 2 else Path("/root")

# --- Autenticación y constructores (probados sin Modal) --------------------


def agregar_auth(app):
    """401 sin `Authorization: Bearer <MODELOS_TOKEN>`, salvo GET /salud.

    Falla cerrado: si el servicio no tiene MODELOS_TOKEN configurado,
    rechaza todo (excepto /salud).
    """
    from fastapi.responses import JSONResponse

    @app.middleware("http")
    async def exigir_token(request, call_next):
        if request.url.path == "/salud":
            return await call_next(request)
        esperado = os.environ.get("MODELOS_TOKEN", "")
        recibido = request.headers.get("authorization", "")
        prefijo = "Bearer "
        valido = (
            bool(esperado)
            and recibido.startswith(prefijo)
            and hmac.compare_digest(
                recibido[len(prefijo) :].encode(), esperado.encode()
            )
        )
        if not valido:
            return JSONResponse(
                status_code=401,
                content={"detail": "no autorizado"},
                headers={"WWW-Authenticate": "Bearer"},
            )
        return await call_next(request)

    return app


def construir_app_embeddings():
    """Rutas de ml/servir.py reutilizadas en una app nueva, con token."""
    import servir  # ml/servir.py (en /root dentro de la imagen)
    from fastapi import FastAPI

    app = FastAPI(title="Relevo embed (Modal)")
    app.include_router(servir.app.router)
    return agregar_auth(app)


def construir_app_extractor(completar, version: str = VERSION_EXTRACTOR):
    """crear_app de ml/servir_extractor.py, con token."""
    from servir_extractor import crear_app

    return agregar_auth(crear_app(completar=completar, version=version))


# --- Recursos de Modal ------------------------------------------------------

app = modal.App(NOMBRE_APP)

vol_hf = modal.Volume.from_name(VOLUMEN_HF, create_if_missing=True)
vol_adapters = modal.Volume.from_name(VOLUMEN_ADAPTERS, create_if_missing=True)
secreto = modal.Secret.from_name(SECRETO, required_keys=["MODELOS_TOKEN"])

_ENTORNO = {"HF_HOME": RUTA_HF, "PYTHONUNBUFFERED": "1"}


def _con_codigo_ml(imagen: modal.Image, extractor: bool) -> modal.Image:
    """Añade el código de ml/ a la imagen (sin copiar su lógica)."""
    imagen = imagen.add_local_dir(
        _ML / "corpus_lib", "/root/corpus_lib"
    ).add_local_file(_ML / "servir.py", "/root/servir.py")
    if extractor:
        imagen = imagen.add_local_dir(
            _ML / "extractor", "/root/extractor"
        ).add_local_file(_ML / "servir_extractor.py", "/root/servir_extractor.py")
    return imagen


# Versiones iguales a las de los venvs locales donde el código está probado.
imagen_embeddings = _con_codigo_ml(
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch==2.13.0",
        "transformers==5.16.1",
        "FlagEmbedding==1.4.2",
        "numpy==2.4.6",
        "fastapi==0.141.1",
        "uvicorn==0.53.0",
        "huggingface_hub",
    )
    .env({**_ENTORNO, "CUDA_VISIBLE_DEVICES": ""}),
    extractor=False,
)

_paquetes_extractor = [
    "torch==2.11.0",
    "transformers==5.17.0",
    "peft==0.21.0",
    "bitsandbytes==0.50.2",
    "accelerate==1.15.0",
    "numpy==2.4.6",
    "fastapi==0.141.1",
    "uvicorn==0.53.0",
    "huggingface_hub",
]
if INSTALAR_KERNELS_RAPIDOS:
    _paquetes_extractor.append("flash-linear-attention")

imagen_extractor = _con_codigo_ml(
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(*_paquetes_extractor)
    .env(_ENTORNO),
    extractor=True,
)

# --- Descarga única de pesos al volumen ------------------------------------


@app.function(
    image=imagen_embeddings,
    volumes={RUTA_HF: vol_hf},
    timeout=3600,
    cpu=2,
    memory=4096,
)
def descargar_modelos() -> None:
    """modal run deploy/modal/app.py::descargar_modelos

    Deja bge-m3, el re-ranker y Qwen3.5-0.8B en el volumen para que ningún
    arranque en frío descargue pesos.
    """
    from huggingface_hub import snapshot_download

    ignorar = ["*.onnx", "onnx/*", "*.msgpack", "*.h5", "imgs/*", "*.ot"]
    for repo in (
        "BAAI/bge-m3",
        "BAAI/bge-reranker-v2-m3",
        "Qwen/Qwen3.5-0.8B",
    ):
        print("descargando", repo, flush=True)
        snapshot_download(repo, ignore_patterns=ignorar)
    vol_hf.commit()
    print("listo", flush=True)


# --- Servicio de embeddings -------------------------------------------------


@app.cls(
    image=imagen_embeddings,
    cpu=2,
    memory=8192,  # bge-m3 + re-ranker en fp32 (~2.3 GB c/u) + torch
    volumes={RUTA_HF: vol_hf},
    secrets=[secreto],
    min_containers=MIN_CONTAINERS_EMBED,
    scaledown_window=VENTANA_APAGADO_EMBED,
    timeout=600,
)
@modal.concurrent(max_inputs=4)
class Embeddings:
    @modal.enter()
    def cargar(self) -> None:
        import servir
        from corpus_lib.embeddings import _cargar_modelo

        _cargar_modelo()  # bge-m3, una vez por contenedor
        try:
            servir._cargar_reranker()  # opcional: si falla, /rerank da 501
        except Exception as exc:  # noqa: BLE001
            print("re-ranker no disponible:", repr(exc), flush=True)

    @modal.asgi_app(label="relevo-embeddings")
    def web(self):
        return construir_app_embeddings()


# --- Servicio del extractor -------------------------------------------------


@app.cls(
    image=imagen_extractor,
    gpu=GPU_EXTRACTOR,
    volumes={RUTA_HF: vol_hf, RUTA_ADAPTERS: vol_adapters},
    secrets=[secreto],
    min_containers=0,  # escala a cero: si tarda, el web cae a Grok
    scaledown_window=VENTANA_APAGADO_EXTRACTOR,
    timeout=600,
)
class Extractor:
    @modal.enter()
    def cargar(self) -> None:
        import threading

        from extractor.constantes import MODELO_BASE
        from extractor.evaluar import generar_extraccion
        from extractor.modelo import cargar_para_servicio
        from peft import PeftModel

        ruta = Path(RUTA_ADAPTERS) / ADAPTER_EXTRACTOR
        if not (ruta / "adapter_config.json").is_file():
            raise RuntimeError(
                f"falta el adapter en el volumen {VOLUMEN_ADAPTERS}: {ruta}"
            )
        modelo, tokenizer = cargar_para_servicio(MODELO_BASE)
        modelo = PeftModel.from_pretrained(modelo, str(ruta))
        modelo.eval()
        cerrojo = threading.Lock()  # una generación a la vez por GPU

        def completar(orden: str, fecha_referencia: str) -> str:
            fila = {"orden": orden, "fecha_referencia": fecha_referencia}
            with cerrojo:
                return generar_extraccion(modelo, tokenizer, fila)

        self._completar = completar

    @modal.asgi_app(label="relevo-extractor")
    def web(self):
        return construir_app_extractor(self._completar)
