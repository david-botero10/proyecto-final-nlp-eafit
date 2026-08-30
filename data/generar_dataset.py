"""Genera el dataset sintético de nómina (Faker es_CO, semilla 42)."""

from __future__ import annotations

import random
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path

from faker import Faker

SEED = 42
INICIO = date(2026, 8, 3)  # lunes
SEMANAS = 8
N_EMPLEADOS = 40
N_AUSENCIAS = 30

EQUIPOS: dict[str, int] = {
    "enfermeria": 20,
    "recepcion": 10,
    "vigilancia": 10,
}

DURACIONES: dict[str, tuple[int, int]] = {
    "vacaciones": (5, 10),
    "incapacidad": (2, 5),
    "permiso": (1, 2),
    "licencia": (3, 7),
}

TURNOS = [
    {
        "id": 1,
        "codigo": "M",
        "nombre": "Mañana",
        "hora_inicio": "06:00:00",
        "hora_fin": "14:00:00",
        "cruza_medianoche": False,
    },
    {
        "id": 2,
        "codigo": "T",
        "nombre": "Tarde",
        "hora_inicio": "14:00:00",
        "hora_fin": "22:00:00",
        "cruza_medianoche": False,
    },
    {
        "id": 3,
        "codigo": "N",
        "nombre": "Noche",
        "hora_inicio": "22:00:00",
        "hora_fin": "06:00:00",
        "cruza_medianoche": True,
    },
]

SEED_DIR = Path(__file__).resolve().parent.parent / "db" / "seed"
FIN_PERIODO = INICIO + timedelta(days=SEMANAS * 7 - 1)


def sql_lit(valor: object) -> str:
    """Literal SQL seguro para el seed sintético."""
    if valor is None:
        return "NULL"
    if isinstance(valor, bool):
        return "TRUE" if valor else "FALSE"
    if isinstance(valor, date):
        return f"'{valor.isoformat()}'"
    if isinstance(valor, int):
        return str(valor)
    texto = str(valor).replace("'", "''")
    return f"'{texto}'"


def documento_sintetico(rng: random.Random, usados: set[str]) -> str:
    """Cédula ficticia de 10 dígitos, única en el dataset."""
    while True:
        doc = f"{rng.randint(10_000_000, 1_099_999_999):010d}"
        if doc not in usados:
            usados.add(doc)
            return doc


def rol_de(equipo: str, indice: int, rng: random.Random) -> str:
    """Rol coherente con el equipo. El índice 0 es el cargo de jefatura."""
    if equipo == "enfermeria":
        if indice == 0:
            return "jefe de enfermería"
        return rng.choice(["enfermero", "enfermera", "auxiliar de enfermería"])
    if equipo == "recepcion":
        if indice == 0:
            return "coordinador de admisión"
        return rng.choice(["recepcionista", "auxiliar administrativo"])
    if indice == 0:
        return "supervisor de seguridad"
    return rng.choice(["vigilante", "portero"])


def construir_empleados(fake: Faker, rng: random.Random) -> list[dict]:
    """40 empleados sintéticos en tres equipos."""
    empleados: list[dict] = []
    usados: set[str] = set()
    emp_id = 1
    for equipo, cupo in EQUIPOS.items():
        for indice in range(cupo):
            empleados.append(
                {
                    "id": emp_id,
                    "nombre": fake.name(),
                    "documento": documento_sintetico(rng, usados),
                    "rol": rol_de(equipo, indice, rng),
                    "equipo": equipo,
                    "fecha_ingreso": fake.date_between(
                        start_date=date(2016, 1, 1),
                        end_date=date(2026, 6, 1),
                    ),
                    "activo": True,
                }
            )
            emp_id += 1
    return empleados


def subgrupo_por_empleado(empleados: list[dict]) -> dict[int, int]:
    """Reparte cada equipo en 3 subgrupos para la rotación M→T→N."""
    por_equipo: dict[str, list[int]] = defaultdict(list)
    for emp in empleados:
        por_equipo[emp["equipo"]].append(emp["id"])
    subgrupo: dict[int, int] = {}
    for ids in por_equipo.values():
        for i, emp_id in enumerate(ids):
            subgrupo[emp_id] = i % 3
    return subgrupo


def construir_asignaciones(
    empleados: list[dict],
) -> list[dict]:
    """8 semanas desde 2026-08-03: rotación semanal, máx. 6 días, domingos alternados."""
    subgrupo = subgrupo_por_empleado(empleados)
    asignaciones: list[dict] = []
    asig_id = 1
    for emp in empleados:
        emp_id = emp["id"]
        g = subgrupo[emp_id]
        for semana in range(SEMANAS):
            turno_id = TURNOS[(g + semana) % 3]["id"]
            trabaja_domingo = (emp_id + semana) % 2 == 0
            inicio_semana = INICIO + timedelta(days=7 * semana)
            for dia in range(7):
                fecha = inicio_semana + timedelta(days=dia)
                es_domingo = dia == 6
                if es_domingo and not trabaja_domingo:
                    continue
                if (not es_domingo) and trabaja_domingo and dia == 5:
                    # Si trabaja el domingo, libera el sábado para no pasar de 6 días.
                    continue
                asignaciones.append(
                    {
                        "id": asig_id,
                        "empleado_id": emp_id,
                        "turno_id": turno_id,
                        "fecha": fecha,
                        "estado": "programada",
                        "origen": "seed",
                        "propuesta_id": None,
                    }
                )
                asig_id += 1
    return asignaciones


def se_solapan(a1: date, a2: date, b1: date, b2: date) -> bool:
    """True si los rangos [a1, a2] y [b1, b2] se intersectan."""
    return not (a2 < b1 or b2 < a1)


def construir_ausencias(
    fake: Faker, rng: random.Random, empleados: list[dict]
) -> list[dict]:
    """~30 ausencias sin solaparse entre sí para el mismo empleado."""
    tipos = (
        ["vacaciones"] * 8
        + ["incapacidad"] * 8
        + ["permiso"] * 8
        + ["licencia"] * 6
    )
    rng.shuffle(tipos)
    estados = ["aprobada"] * 24 + ["pendiente"] * 4 + ["rechazada"] * 2
    rng.shuffle(estados)
    emp_ids = [emp["id"] for emp in empleados]
    ocupado: dict[int, list[tuple[date, date]]] = defaultdict(list)
    ausencias: list[dict] = []
    intentos = 0
    while len(ausencias) < N_AUSENCIAS and intentos < 10_000:
        intentos += 1
        emp_id = emp_ids[rng.randrange(len(emp_ids))]
        tipo = tipos[len(ausencias)]
        estado = estados[len(ausencias)]
        lo, hi = DURACIONES[tipo]
        duracion = rng.randint(lo, hi)
        inicio = INICIO + timedelta(days=rng.randint(0, SEMANAS * 7 - 1))
        fin = min(inicio + timedelta(days=duracion - 1), FIN_PERIODO)
        if fin < inicio:
            continue
        if any(se_solapan(inicio, fin, a, b) for a, b in ocupado[emp_id]):
            continue
        ocupado[emp_id].append((inicio, fin))
        ausencias.append(
            {
                "id": len(ausencias) + 1,
                "empleado_id": emp_id,
                "tipo": tipo,
                "fecha_inicio": inicio,
                "fecha_fin": fin,
                "estado": estado,
                "motivo": fake.sentence(nb_words=8).rstrip("."),
                "propuesta_id": None,
            }
        )
    if len(ausencias) != N_AUSENCIAS:
        raise RuntimeError(f"solo se generaron {len(ausencias)} ausencias")
    return ausencias


def dias_bloqueados(ausencias: list[dict]) -> set[tuple[int, date]]:
    """Días cubiertos por ausencias aprobadas (empleado, fecha)."""
    bloqueados: set[tuple[int, date]] = set()
    for au in ausencias:
        if au["estado"] != "aprobada":
            continue
        actual = au["fecha_inicio"]
        while actual <= au["fecha_fin"]:
            bloqueados.add((au["empleado_id"], actual))
            actual += timedelta(days=1)
    return bloqueados


def omitir_conflictos(
    asignaciones: list[dict], ausencias: list[dict]
) -> list[dict]:
    """Omite asignaciones que caen en una ausencia aprobada."""
    bloqueados = dias_bloqueados(ausencias)
    filtradas = [
        a
        for a in asignaciones
        if (a["empleado_id"], a["fecha"]) not in bloqueados
    ]
    for i, fila in enumerate(filtradas, start=1):
        fila["id"] = i
    return filtradas


def validar(
    empleados: list[dict],
    asignaciones: list[dict],
    ausencias: list[dict],
) -> None:
    """Asserts internos: solapes, cupos semanales y FKs. Falla el proceso si no."""
    assert len(empleados) == N_EMPLEADOS
    assert len(ausencias) == N_AUSENCIAS
    cupos = Counter(emp["equipo"] for emp in empleados)
    assert cupos["enfermeria"] == 20
    assert cupos["recepcion"] == 10
    assert cupos["vigilancia"] == 10

    ids_emp = {emp["id"] for emp in empleados}
    ids_turno = {t["id"] for t in TURNOS}
    vistos: set[tuple[int, date]] = set()
    for a in asignaciones:
        assert a["empleado_id"] in ids_emp, "FK empleado inválida"
        assert a["turno_id"] in ids_turno, "FK turno inválida"
        clave = (a["empleado_id"], a["fecha"])
        assert clave not in vistos, f"solape de asignaciones {clave}"
        vistos.add(clave)

    bloqueados = dias_bloqueados(ausencias)
    for a in asignaciones:
        assert (a["empleado_id"], a["fecha"]) not in bloqueados, (
            "asignación durante ausencia aprobada"
        )

    for au in ausencias:
        assert au["empleado_id"] in ids_emp, "FK ausencia inválida"
        assert au["fecha_fin"] >= au["fecha_inicio"]

    por_semana: dict[tuple[int, int], int] = defaultdict(int)
    for a in asignaciones:
        semana = (a["fecha"] - INICIO).days // 7
        por_semana[(a["empleado_id"], semana)] += 1
    for clave, n in por_semana.items():
        assert n <= 6, f"empleado {clave[0]} semana {clave[1]} tiene {n} días"


def render_insert(tabla: str, columnas: list[str], filas: list[dict]) -> str:
    """INSERT multilínea con literales SQL."""
    lineas = [
        "-- Dataset sintético Relevo. Semilla 42. Sin datos reales.",
        f"INSERT INTO {tabla} ({', '.join(columnas)}) VALUES",
    ]
    valores = []
    for fila in filas:
        lits = ", ".join(sql_lit(fila[c]) for c in columnas)
        valores.append(f"    ({lits})")
    lineas.append(",\n".join(valores) + ";")
    lineas.append(
        f"SELECT setval(pg_get_serial_sequence('{tabla}', 'id'), "
        f"(SELECT MAX(id) FROM {tabla}));"
    )
    lineas.append("")
    return "\n".join(lineas)


def escribir(nombre: str, contenido: str) -> None:
    """Escribe un SQL de seed en UTF-8 sin BOM."""
    SEED_DIR.mkdir(parents=True, exist_ok=True)
    path = SEED_DIR / nombre
    path.write_text(contenido, encoding="utf-8", newline="\n")
    print(f"escrito {path}")


def main() -> int:
    rng = random.Random(SEED)
    fake = Faker("es_CO")
    Faker.seed(SEED)
    fake.seed_instance(SEED)

    empleados = construir_empleados(fake, rng)
    ausencias = construir_ausencias(fake, rng, empleados)
    asignaciones = omitir_conflictos(construir_asignaciones(empleados), ausencias)
    validar(empleados, asignaciones, ausencias)

    escribir(
        "01_turnos.sql",
        render_insert(
            "turnos",
            [
                "id",
                "codigo",
                "nombre",
                "hora_inicio",
                "hora_fin",
                "cruza_medianoche",
            ],
            TURNOS,
        ),
    )
    escribir(
        "02_empleados.sql",
        render_insert(
            "empleados",
            [
                "id",
                "nombre",
                "documento",
                "rol",
                "equipo",
                "fecha_ingreso",
                "activo",
            ],
            empleados,
        ),
    )
    escribir(
        "03_asignaciones.sql",
        render_insert(
            "asignaciones",
            [
                "id",
                "empleado_id",
                "turno_id",
                "fecha",
                "estado",
                "origen",
                "propuesta_id",
            ],
            asignaciones,
        ),
    )
    escribir(
        "04_ausencias.sql",
        render_insert(
            "ausencias",
            [
                "id",
                "empleado_id",
                "tipo",
                "fecha_inicio",
                "fecha_fin",
                "estado",
                "motivo",
                "propuesta_id",
            ],
            ausencias,
        ),
    )
    print(
        f"conteos: turnos={len(TURNOS)} empleados={len(empleados)} "
        f"asignaciones={len(asignaciones)} ausencias={len(ausencias)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
