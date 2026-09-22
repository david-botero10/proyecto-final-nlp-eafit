"""Carga 4-bit y plantilla de chat. Torch solo se importa al llamar."""

from __future__ import annotations

SUFIJOS_LORA = (
    "q_proj",
    "k_proj",
    "v_proj",
    "o_proj",
    "gate_proj",
    "up_proj",
    "down_proj",
    "in_proj_qkv",
    "in_proj_z",
    "out_proj",
)


def aplicar_plantilla(tokenizer, mensajes: list[dict], generar: bool) -> str:
    """Texto del chat. Pide modo sin pensamiento si el template lo permite."""
    kwargs = {"tokenize": False, "add_generation_prompt": generar}
    try:
        return tokenizer.apply_chat_template(
            mensajes, enable_thinking=False, **kwargs
        )
    except TypeError:
        return tokenizer.apply_chat_template(mensajes, **kwargs)


def regex_lora(modelo) -> str:
    """Regex de capas lineales del modelo de lenguaje, no del encoder de visión."""
    import torch.nn as nn

    tiene_lenguaje = any(
        "language_model" in nombre for nombre, _modulo in modelo.named_modules()
    )
    hojas: set[str] = set()
    for nombre, modulo in modelo.named_modules():
        if not isinstance(modulo, nn.Linear):
            continue
        if tiene_lenguaje and "language_model" not in nombre:
            continue
        hoja = nombre.rsplit(".", 1)[-1]
        if hoja in SUFIJOS_LORA:
            hojas.add(hoja)
    if not hojas:
        raise RuntimeError("no aparecieron capas lineales para LoRA")
    grupo = "|".join(sorted(hojas))
    if tiene_lenguaje:
        return rf".*\.language_model\..*\.(?:{grupo})$"
    return rf"(?:^|.*\.)(?:{grupo})$"


def cargar_4bit(modelo_id: str):
    """Modelo en NF4 (bitsandbytes) y su tokenizer, en la GPU 0."""
    import torch
    from transformers import AutoTokenizer, BitsAndBytesConfig

    config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.bfloat16,
    )
    tokenizer = AutoTokenizer.from_pretrained(modelo_id)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    kwargs = {
        "quantization_config": config,
        "device_map": {"": 0},
    }
    errores: list[str] = []
    modelo = None
    for nombre_clase in ("AutoModelForCausalLM", "AutoModelForImageTextToText"):
        try:
            import transformers

            clase = getattr(transformers, nombre_clase)
            modelo = clase.from_pretrained(modelo_id, **kwargs)
            break
        except (ValueError, TypeError, KeyError, AttributeError) as exc:
            errores.append(f"{nombre_clase}: {type(exc).__name__}: {exc}")
    if modelo is None:
        detalle = "\n".join(errores)
        raise RuntimeError(f"no se pudo cargar {modelo_id} en 4-bit\n{detalle}")
    modelo.config.use_cache = False
    return modelo, tokenizer
