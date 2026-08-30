"""Conteo y partición de tokens para el chunking estructural.

Un token es una palabra separada por espacio. Así el umbral de 1200/800
es determinista y no requiere cargar el tokenizador de bge-m3.
"""

from __future__ import annotations


def tokenizar(texto: str) -> list[str]:
    """Separa el texto en tokens por espacio."""
    return texto.split()


def contar_tokens(texto: str) -> int:
    """Cuenta tokens por espacio."""
    return len(tokenizar(texto))


def partir_con_solape(
    texto: str,
    max_tokens: int,
    solape: int,
) -> list[str]:
    """Parte `texto` en ventanas de `max_tokens` con solape `solape`.

    La última ventana puede ser más corta. Si el texto cabe, se devuelve
    íntegro.
    """
    if max_tokens <= 0:
        raise ValueError("max_tokens debe ser positivo")
    if solape < 0 or solape >= max_tokens:
        raise ValueError("solape debe ser >= 0 y menor que max_tokens")

    tokens = tokenizar(texto)
    if len(tokens) <= max_tokens:
        return [texto.strip()] if texto.strip() else []

    partes: list[str] = []
    inicio = 0
    total = len(tokens)
    while inicio < total:
        fin = min(inicio + max_tokens, total)
        partes.append(" ".join(tokens[inicio:fin]))
        if fin >= total:
            break
        inicio = fin - solape
    return partes
