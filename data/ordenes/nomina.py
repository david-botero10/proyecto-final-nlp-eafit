"""Nombres de la nómina sintética y alias coloquiales inequívocos.

Lee `db/seed/02_empleados.sql` (semilla 42). No regenera con Faker: el SQL
comiteado es la nómina que ya está en la base.
"""

from __future__ import annotations

import re
from pathlib import Path

_FILA = re.compile(r"^\s*\(\d+, '([^']+)', '\d+',", re.MULTILINE)

# Primer nombre → género gramatical, solo cuando es claro. Sirve para no
# escribir «está incapacitada» referido a un hombre (y al revés).
FEMENINOS: frozenset[str] = frozenset(
    {
        "María",
        "Elizabeth",
        "Blanca",
        "Doris",
        "Luz",
        "Dayana",
        "Bibiana",
        "Mónica",
        "Nubia",
        "Marcela",
        "Liliana",
        "Ruth",
        "Johana",
        "Ana",
        "Karen",
        "Melissa",
        "Patricia",
        "Ruby",
        "Alejandra",
        "Diana",
        "Xiomara",
        "Camila",
    }
)
MASCULINOS: frozenset[str] = frozenset(
    {
        "David",
        "Rubén",
        "Javier",
        "Diego",
        "Alberto",
        "Efrain",
        "Luis",
        "Brayan",
        "Carlos",
        "Gilberto",
        "Ciro",
        "Bernardo",
        "Hernán",
        "Antonio",
        "Alejandro",
    }
)

# Diminutivos solo si el primer nombre ya es inequívoco.
DIMINUTIVOS: dict[str, tuple[str, ...]] = {
    "Ana": ("Anita",),
    "Carlos": ("Caritos",),
    "Camila": ("Cami",),
    "Mónica": ("Moni",),
    "Patricia": ("Paty",),
    "Alejandro": ("Alejo",),
    "Alejandra": ("Aleja",),
    "Hernán": ("Nano",),
    "Javier": ("Javi",),
    "Luis": ("Lucho",),
    "Alberto": ("Beto",),
    "Melissa": ("Meli",),
    "Xiomara": ("Xio",),
    "Bibiana": ("Bibi",),
    "Dayana": ("Daya",),
    "Brayan": ("Bryan",),
    "Antonio": ("Toño",),
    "Bernardo": ("Berna",),
    "Rubén": ("Ruben",),
}


def ruta_seed() -> Path:
    """Ruta del SQL de empleados relativa a este archivo."""
    return Path(__file__).resolve().parents[2] / "db" / "seed" / "02_empleados.sql"


def cargar_nombres(ruta: Path | None = None) -> list[str]:
    """Los 40 nombres completos, en el orden del seed."""
    archivo = ruta or ruta_seed()
    texto = archivo.read_text(encoding="utf-8-sig")
    nombres = _FILA.findall(texto)
    if len(nombres) != 40:
        raise RuntimeError(f"se esperaban 40 empleados y hay {len(nombres)}")
    if len(set(nombres)) != 40:
        raise RuntimeError("hay nombres duplicados en el seed")
    return nombres


def genero_de(nombre: str) -> str | None:
    """'f', 'm' o None si el primer nombre no está clasificado."""
    primero = nombre.split()[0]
    if primero in FEMENINOS and primero in MASCULINOS:
        raise RuntimeError(f"primer nombre en ambos géneros: {primero}")
    if primero in FEMENINOS:
        return "f"
    if primero in MASCULINOS:
        return "m"
    return None


def _unicos(nombres: list[str], pred) -> int:
    return sum(1 for nombre in nombres if pred(nombre))


def candidatos_base(nombre: str, nombres: list[str]) -> list[str]:
    """Formas del nombre que no colisionan con otro empleado."""
    partes = nombre.split()
    primero = partes[0]
    candidatos: list[str] = []
    if _unicos(nombres, lambda n: n.split()[0] == primero) == 1:
        candidatos.append(primero)
    if len(partes) >= 2 and partes[0] != partes[1]:
        dos = f"{partes[0]} {partes[1]}"
        if (
            _unicos(
                nombres,
                lambda n, prefijo=dos: n == prefijo or n.startswith(prefijo + " "),
            )
            == 1
            and dos not in candidatos
        ):
            candidatos.append(dos)
    if len(partes) >= 3:
        corto = f"{partes[0]} {partes[-1]}"
        if (
            _unicos(
                nombres,
                lambda n, p0=partes[0], ult=partes[-1]: (
                    n.split()[0] == p0 and n.split()[-1] == ult
                ),
            )
            == 1
            and corto not in candidatos
        ):
            candidatos.append(corto)
    if nombre not in candidatos:
        candidatos.append(nombre)
    return candidatos


def construir_alias(nombres: list[str] | None = None) -> dict[str, str]:
    """Mapa alias → nombre completo. Cada alias apunta a una sola persona."""
    lista = nombres if nombres is not None else cargar_nombres()
    por_nombre = {nombre: candidatos_base(nombre, lista) for nombre in lista}
    ocupados = {alias for formas in por_nombre.values() for alias in formas}
    for nombre, formas in por_nombre.items():
        primero = nombre.split()[0]
        if primero not in formas:
            continue
        for diminutivo in DIMINUTIVOS.get(primero, ()):
            if diminutivo in ocupados:
                continue
            formas.append(diminutivo)
            ocupados.add(diminutivo)
    alias: dict[str, str] = {}
    for nombre, formas in por_nombre.items():
        if not formas:
            raise RuntimeError(f"sin alias para {nombre}")
        for forma in formas:
            if forma in alias:
                raise RuntimeError(f"alias repetido: {forma}")
            alias[forma] = nombre
    if set(alias.values()) != set(lista):
        raise RuntimeError("algún empleado se quedó sin alias")
    return alias


def alias_de(nombre: str, alias: dict[str, str] | None = None) -> list[str]:
    """Alias de un empleado, del más corto al más largo."""
    mapa = alias if alias is not None else construir_alias()
    formas = [forma for forma, destino in mapa.items() if destino == nombre]
    return sorted(formas, key=lambda forma: (len(forma), forma))
