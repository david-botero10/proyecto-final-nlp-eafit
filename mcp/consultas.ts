import type { Sql } from "../lib/db/cliente";
import type {
  BuscarNormaEntrada,
  ConsultarAusenciasEntrada,
  ConsultarTurnosEntrada,
  ListarEmpleadosEntrada,
} from "./esquemas";

type FiltroEmpleado = {
  id: number | null;
  nombre: string | null;
};

function filtroEmpleado(
  empleado: number | string | undefined,
): FiltroEmpleado {
  if (empleado === undefined) {
    return { id: null, nombre: null };
  }
  if (typeof empleado === "number" || /^[0-9]+$/.test(empleado)) {
    return { id: Number(empleado), nombre: null };
  }
  return { id: null, nombre: empleado };
}

export async function listarEmpleados(
  sql: Sql,
  filtros: ListarEmpleadosEntrada,
) {
  const equipo = filtros.equipo ?? null;
  const activo = filtros.activo ?? null;
  return sql<{
    id: number;
    nombre: string;
    rol: string;
    equipo: string;
  }[]>`
    SELECT id, nombre, rol, equipo
    FROM empleados
    WHERE (${equipo}::text IS NULL OR equipo = ${equipo})
      AND (${activo}::boolean IS NULL OR activo = ${activo})
    ORDER BY nombre
  `;
}

export async function consultarTurnos(
  sql: Sql,
  filtros: ConsultarTurnosEntrada,
) {
  const { id, nombre } = filtroEmpleado(filtros.empleado);
  const patron = nombre === null ? null : `%${nombre}%`;
  const turno = filtros.turno ?? null;
  return sql<{
    empleado: string;
    turno: string;
    turno_nombre: string;
    fecha: string;
    estado: string;
  }[]>`
    SELECT
      e.nombre AS empleado,
      t.codigo AS turno,
      t.nombre AS turno_nombre,
      a.fecha::text AS fecha,
      a.estado
    FROM asignaciones a
    JOIN empleados e ON e.id = a.empleado_id
    JOIN turnos t ON t.id = a.turno_id
    WHERE a.fecha BETWEEN ${filtros.desde}::date AND ${filtros.hasta}::date
      AND (${id}::int IS NULL OR e.id = ${id})
      AND (${patron}::text IS NULL OR e.nombre ILIKE ${patron})
      AND (${turno}::text IS NULL OR t.codigo = ${turno})
    ORDER BY a.fecha, e.nombre
  `;
}

export async function consultarAusencias(
  sql: Sql,
  filtros: ConsultarAusenciasEntrada,
) {
  const { id, nombre } = filtroEmpleado(filtros.empleado);
  const patron = nombre === null ? null : `%${nombre}%`;
  const tipo = filtros.tipo ?? null;
  return sql<{
    empleado: string;
    tipo: string;
    fecha_inicio: string;
    fecha_fin: string;
    estado: string;
    motivo: string | null;
  }[]>`
    SELECT
      e.nombre AS empleado,
      a.tipo,
      a.fecha_inicio::text AS fecha_inicio,
      a.fecha_fin::text AS fecha_fin,
      a.estado,
      a.motivo
    FROM ausencias a
    JOIN empleados e ON e.id = a.empleado_id
    WHERE a.fecha_inicio <= ${filtros.hasta}::date
      AND a.fecha_fin >= ${filtros.desde}::date
      AND (${id}::int IS NULL OR e.id = ${id})
      AND (${patron}::text IS NULL OR e.nombre ILIKE ${patron})
      AND (${tipo}::text IS NULL OR a.tipo = ${tipo})
    ORDER BY a.fecha_inicio, e.nombre
  `;
}

export async function buscarNorma(sql: Sql, filtros: BuscarNormaEntrada) {
  const k = filtros.k ?? 8;
  // S3: aquí entra la rama vectorial (embedding bge-m3 + fusión RRF + re-ranker).
  return sql<{
    chunk_id: number;
    ref: string | null;
    fuente: string;
    titulo: string;
    url: string | null;
    fragmento: string;
    score: number;
  }[]>`
    WITH consulta AS (
      SELECT websearch_to_tsquery('spanish', es_unaccent(${filtros.consulta})) AS tsq
    )
    SELECT
      c.id AS chunk_id,
      c.ref,
      d.fuente,
      d.titulo,
      d.url,
      COALESCE(
        NULLIF(
          ts_headline(
            'spanish',
            c.texto,
            consulta.tsq,
            'MaxFragments=1, MaxWords=50, MinWords=15'
          ),
          ''
        ),
        left(c.texto, 300)
      ) AS fragmento,
      ts_rank_cd(c.tsv, consulta.tsq) AS score
    FROM chunks c
    JOIN documentos d ON d.id = c.documento_id
    CROSS JOIN consulta
    WHERE consulta.tsq IS NOT NULL
      AND consulta.tsq::text <> ''
      AND c.tsv @@ consulta.tsq
    ORDER BY score DESC, c.id
    LIMIT ${k}
  `;
}
