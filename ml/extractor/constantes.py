"""Modelo base del extractor.

Qwen/Qwen3.5-0.8B es el checkpoint post-entrenado (instruct) más pequeño de
la familia Qwen3.5 en Hugging Face. En 4-bit cabe en la RTX 4060 de 8 GB;
2B y 4B también cabrían en inferencia, pero la spec pide el más pequeño
que quepa. Hace falta transformers 5 por la arquitectura híbrida
(Gated DeltaNet + atención).
"""

MODELO_BASE = "Qwen/Qwen3.5-0.8B"
