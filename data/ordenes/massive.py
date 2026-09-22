"""Negativos extraídos de MASSIVE es-ES, si Hugging Face responde.

Son utterances de dominios ajenos a la nómina (se excluyen calendar y alarm).
Van solo al split de entrenamiento. Si la descarga falla, el generador
sigue con lo sintético y deja constancia del error.
"""

from __future__ import annotations

import random

N_MASSIVE = 200
SEMILLA = 42
# Nombres del dataset original y, en el espejo parquet, el id de ClassLabel.
# Se excluyen calendar (2) y alarm (16): suenan a agenda, no a charla ajena.
ESCENARIOS_EXCLUIDOS = frozenset({"calendar", "alarm", 2, 16})
_REVISION_PARQUET = "refs/convert/parquet"
_RUTA_PARQUET = "es-ES/train/0000.parquet"


# La descarga es opcional: cualquier fallo de red o de formato se documenta
# y el generador sigue solo con lo sintético.
_FALLOS_DESCARGA = (
    ImportError,
    OSError,
    RuntimeError,
    ValueError,
    ConnectionError,
    TimeoutError,
)


def _abrir_massive() -> tuple[object | None, str]:
    """Intenta el config con script y, si ya no existe, el espejo parquet."""
    try:
        from datasets import load_dataset
    except ImportError as exc:
        return None, f"no se importó datasets ({type(exc).__name__}: {exc})"
    try:
        dataset = load_dataset("AmazonScience/massive", "es-ES", split="train")
        return dataset, "config es-ES del script original"
    except _FALLOS_DESCARGA as exc_script:
        nota_script = f"{type(exc_script).__name__}: {exc_script}"
    try:
        from huggingface_hub import hf_hub_download

        ruta = hf_hub_download(
            "AmazonScience/massive",
            _RUTA_PARQUET,
            repo_type="dataset",
            revision=_REVISION_PARQUET,
        )
        dataset = load_dataset("parquet", data_files=ruta, split="train")
    except _FALLOS_DESCARGA as exc:
        return None, (
            "falló AmazonScience/massive config es-ES "
            f"({nota_script}); el parquet también falló "
            f"({type(exc).__name__}: {exc})"
        )
    return dataset, (
        "parquet refs/convert/parquet es-ES/train "
        f"(el script falló: {nota_script})"
    )


def intentar_massive(n: int = N_MASSIVE) -> tuple[list[str], str]:
    """Devuelve utterances y un mensaje de diagnóstico (sin secretos)."""
    dataset, nota = _abrir_massive()
    if dataset is None:
        return [], nota
    frases: list[str] = []
    for fila in dataset:
        escenario = fila.get("scenario")
        if escenario in ESCENARIOS_EXCLUIDOS:
            continue
        texto = str(fila.get("utt") or "").strip()
        if texto:
            frases.append(texto)
    unicas = sorted(set(frases))
    if len(unicas) < n:
        return unicas, f"{nota}; parcial: solo {len(unicas)} utterances únicas"
    rng = random.Random(SEMILLA)
    rng.shuffle(unicas)
    elegidas = sorted(unicas[:n])
    return elegidas, (
        f"{nota}; {len(elegidas)} de {len(unicas)} "
        "(sin calendar ni alarm, semilla 42)"
    )
