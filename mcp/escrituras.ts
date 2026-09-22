import {
  diasEntre,
  fechaIsoBogota,
  fechaIsoValida,
  HORIZONTE_DIAS,
} from "@/lib/agente/fechas";
import type { Sql } from "@/lib/db/cliente";
import {
  USUARIO_TARJETA,
  type Accion,
  type AccionExtraccion,
  type AusenciaEnRango,
  type ContextoPropuesta,
  type Decision,
  type EstadoPropuesta,
  type Extraccion,
  type NombreEmpleado,
  type Propuesta,
  type ResumenEjecucion,
  type SolapeDetectado,
  type Turno,
  type Veredicto,
  type VeredictoAuditor,
} from "@/lib/tipos";
import { accionSchema, extraccionSchema } from "./esquemas";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CodigoError = "validacion" | "no_encontrada" | "ya_decidida" | "escritura";

export class ErrorPropuesta extends Error {
  readonly codigo: CodigoError;

  constructor(codigo: CodigoError, message: string) {
    super(message);
    this.name = "ErrorPropuesta";
    this.codigo = codigo;
  }
}

const ESTADO_POR_DECISION: Record<Decision, EstadoPropuesta> = {
  aprobar: "aprobada",
  corregir: "corregida",
  rechazar: "rechazada",
};

const ORIGEN_PAR: Record<Decision, "aprobacion" | "correccion" | "rechazo"> = {
  aprobar: "aprobacion",
  corregir: "correccion",
  rechazar: "rechazo",
};

type FilaPropuesta = {
  id: string;
  estado: string;
  usuario: string;
  orden_texto: string;
  extraccion: unknown;
  acciones: unknown;
  veredicto_auditor: unknown;
};

function jsonValor(valor: unknown): Parameters<Sql["json"]>[0] {
  return JSON.parse(JSON.stringify(valor)) as Parameters<Sql["json"]>[0];
}

function codigoPg(error: unknown): string | null {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return null;
}

function comoJson(valor: unknown): unknown {
  if (typeof valor !== "string") {
    return valor;
  }
  try {
    return JSON.parse(valor) as unknown;
  } catch {
    return valor;
  }
}

export function parsearAcciones(valor: unknown): Accion[] {
  return accionSchema.array().parse(comoJson(valor));
}

export function parsearExtraccion(valor: unknown): Extraccion {
  return extraccionSchema.parse(comoJson(valor));
}

function exigirFecha(fecha: string, hoy: string): void {
  if (!fechaIsoValida(fecha) || !fechaIsoValida(hoy)) {
    throw new ErrorPropuesta(
      "validacion",
      "La fecha debe ser ISO (YYYY-MM-DD).",
    );
  }
  if (Math.abs(diasEntre(hoy, fecha)) > HORIZONTE_DIAS) {
    throw new ErrorPropuesta(
      "validacion",
      `La fecha ${fecha} está fuera de la ventana de 92 días respecto a ${hoy}.`,
    );
  }
}

function exigirRango(inicio: string, fin: string, hoy: string): void {
  exigirFecha(inicio, hoy);
  exigirFecha(fin, hoy);
  if (inicio > fin) {
    throw new ErrorPropuesta(
      "validacion",
      "La fecha de inicio no puede ser posterior a la de fin.",
    );
  }
  if (diasEntre(inicio, fin) > HORIZONTE_DIAS) {
    throw new ErrorPropuesta(
      "validacion",
      "El rango de la ausencia no puede superar 92 días.",
    );
  }
}

async function validarAcciones(
  sql: Sql,
  acciones: Accion[],
  hoy: string,
): Promise<void> {
  if (acciones.length === 0) {
    throw new ErrorPropuesta("validacion", "La propuesta no tiene acciones.");
  }
  const ids = [...new Set(acciones.map((accion) => accion.empleado_id))];
  const empleados = await sql<{ id: number; activo: boolean }[]>`
    SELECT id, activo
    FROM empleados
    WHERE id IN ${sql(ids)}
  `;
  const activos = new Map(
    empleados.map((fila) => [Number(fila.id), fila.activo]),
  );
  for (const id of ids) {
    if (activos.get(id) !== true) {
      throw new ErrorPropuesta(
        "validacion",
        `El empleado ${id} no existe o no está activo.`,
      );
    }
  }

  const turnos = new Set<string>();
  for (const accion of acciones) {
    if (accion.tipo === "registrar_ausencia") {
      exigirRango(accion.fecha_inicio, accion.fecha_fin, hoy);
    } else {
      exigirFecha(accion.fecha, hoy);
    }
    if (accion.tipo === "asignar_turno") {
      turnos.add(accion.turno);
    }
  }

  if (turnos.size === 0) {
    return;
  }
  const codigos = [...turnos];
  const filas = await sql<{ codigo: string }[]>`
    SELECT btrim(codigo) AS codigo
    FROM turnos
    WHERE btrim(codigo) IN ${sql(codigos)}
  `;
  const existentes = new Set(filas.map((fila) => fila.codigo.trim()));
  for (const turno of codigos) {
    if (!existentes.has(turno)) {
      throw new ErrorPropuesta("validacion", `El turno ${turno} no existe.`);
    }
  }
}

async function solapesEn(
  sql: Sql,
  empleadoId: number,
  desde: string,
  hasta: string,
  exceptoPropuesta: string | null,
): Promise<SolapeDetectado[]> {
  const filas = await sql<SolapeDetectado[]>`
    SELECT
      a.empleado_id,
      e.nombre AS empleado,
      a.fecha::text AS fecha,
      btrim(t.codigo) AS turno,
      a.estado
    FROM asignaciones a
    JOIN empleados e ON e.id = a.empleado_id
    JOIN turnos t ON t.id = a.turno_id
    WHERE a.empleado_id = ${empleadoId}
      AND a.fecha BETWEEN ${desde}::date AND ${hasta}::date
      AND a.estado <> 'cancelada'
      AND (
        ${exceptoPropuesta}::uuid IS NULL
        OR a.propuesta_id IS DISTINCT FROM ${exceptoPropuesta}::uuid
      )
    ORDER BY a.fecha, t.codigo
  `;
  return filas.map((fila) => ({
    empleado_id: Number(fila.empleado_id),
    empleado: fila.empleado,
    fecha: fila.fecha,
    turno: fila.turno.trim(),
    estado: fila.estado,
  }));
}

async function ausenciasEn(
  sql: Sql,
  empleadoId: number,
  desde: string,
  hasta: string,
  exceptoPropuesta: string | null,
): Promise<AusenciaEnRango[]> {
  const filas = await sql<AusenciaEnRango[]>`
    SELECT
      a.empleado_id,
      e.nombre AS empleado,
      a.tipo,
      a.fecha_inicio::text AS fecha_inicio,
      a.fecha_fin::text AS fecha_fin,
      a.estado
    FROM ausencias a
    JOIN empleados e ON e.id = a.empleado_id
    WHERE a.empleado_id = ${empleadoId}
      AND a.estado = 'aprobada'
      AND a.fecha_inicio <= ${hasta}::date
      AND a.fecha_fin >= ${desde}::date
      AND (
        ${exceptoPropuesta}::uuid IS NULL
        OR a.propuesta_id IS DISTINCT FROM ${exceptoPropuesta}::uuid
      )
    ORDER BY a.fecha_inicio
  `;
  return filas.map((fila) => ({
    empleado_id: Number(fila.empleado_id),
    empleado: fila.empleado,
    tipo: fila.tipo,
    fecha_inicio: fila.fecha_inicio,
    fecha_fin: fila.fecha_fin,
    estado: fila.estado,
  }));
}

async function detectarContexto(
  sql: Sql,
  acciones: Accion[],
  exceptoPropuesta: string | null = null,
): Promise<ContextoPropuesta> {
  const solapes = new Map<string, SolapeDetectado>();
  const ausencias = new Map<string, AusenciaEnRango>();
  for (const accion of acciones) {
    if (accion.tipo === "cancelar_turno") {
      continue;
    }
    const desde =
      accion.tipo === "registrar_ausencia" ? accion.fecha_inicio : accion.fecha;
    const hasta =
      accion.tipo === "registrar_ausencia" ? accion.fecha_fin : accion.fecha;
    for (const solape of await solapesEn(
      sql,
      accion.empleado_id,
      desde,
      hasta,
      exceptoPropuesta,
    )) {
      solapes.set(`${solape.empleado_id}|${solape.fecha}|${solape.turno}`, solape);
    }
    for (const ausencia of await ausenciasEn(
      sql,
      accion.empleado_id,
      desde,
      hasta,
      exceptoPropuesta,
    )) {
      ausencias.set(
        `${ausencia.empleado_id}|${ausencia.tipo}|${ausencia.fecha_inicio}|${ausencia.fecha_fin}`,
        ausencia,
      );
    }
  }
  return {
    solapes_detectados: [...solapes.values()],
    ausencias_en_rango: [...ausencias.values()],
  };
}

async function nombresDe(sql: Sql, acciones: Accion[]): Promise<NombreEmpleado[]> {
  const ids = [...new Set(acciones.map((accion) => accion.empleado_id))];
  if (ids.length === 0) {
    return [];
  }
  const filas = await sql<{ id: number; nombre: string }[]>`
    SELECT id, nombre
    FROM empleados
    WHERE id IN ${sql(ids)}
    ORDER BY nombre
  `;
  return filas.map((fila) => ({ id: Number(fila.id), nombre: fila.nombre }));
}

function leerVeredicto(valor: unknown, propuestaId: string): VeredictoAuditor | null {
  const crudo = comoJson(valor);
  if (!crudo || typeof crudo !== "object") {
    return null;
  }
  const fila = crudo as Partial<VeredictoAuditor>;
  const veredicto = fila.veredicto;
  if (
    veredicto !== "aprobado" &&
    veredicto !== "observaciones" &&
    veredicto !== "rechazado"
  ) {
    return null;
  }
  const verificaciones = fila.verificaciones;
  return {
    propuesta_id:
      typeof fila.propuesta_id === "string" ? fila.propuesta_id : propuestaId,
    veredicto: veredicto as Veredicto,
    razones: Array.isArray(fila.razones)
      ? fila.razones.filter((razon): razon is string => typeof razon === "string")
      : [],
    normas_citadas: Array.isArray(fila.normas_citadas) ? fila.normas_citadas : [],
    verificaciones: {
      empleado_existe: Boolean(verificaciones?.empleado_existe),
      sin_solapes: Boolean(verificaciones?.sin_solapes),
      jornada_dentro_de_limites: Boolean(
        verificaciones?.jornada_dentro_de_limites,
      ),
    },
  };
}

function fechasDe(acciones: Accion[]): string[] {
  const fechas = new Set<string>();
  for (const accion of acciones) {
    if (accion.tipo === "registrar_ausencia") {
      fechas.add(accion.fecha_inicio);
      fechas.add(accion.fecha_fin);
    } else {
      fechas.add(accion.fecha);
    }
  }
  return [...fechas].sort();
}

function accionDe(acciones: Accion[]): AccionExtraccion {
  if (acciones.every((accion) => accion.tipo === "cancelar_turno")) {
    return "quitar";
  }
  if (acciones.every((accion) => accion.tipo === "registrar_ausencia")) {
    return "ausencia";
  }
  return "asignar";
}

function turnoDe(acciones: Accion[]): Turno | null {
  for (const accion of acciones) {
    if (accion.tipo === "asignar_turno") {
      return accion.turno;
    }
  }
  return null;
}

/** Extracción que refleja la corrección humana, para el par de preferencia. */
export function extraccionElegida(
  original: Extraccion,
  acciones: Accion[],
): Extraccion {
  return {
    empleado: original.empleado,
    turno: turnoDe(acciones),
    fechas: fechasDe(acciones),
    justificacion: original.justificacion,
    accion: accionDe(acciones),
    proveedor: original.proveedor,
  };
}

export type EntradaCrear = {
  orden_texto: string;
  extraccion: Extraccion;
  acciones: Accion[];
  usuario?: string;
  hoy?: string;
};

export async function crearPropuesta(
  sql: Sql,
  entrada: EntradaCrear,
): Promise<Propuesta> {
  const hoy = entrada.hoy ?? fechaIsoBogota();
  const orden = entrada.orden_texto.trim();
  if (orden.length === 0) {
    throw new ErrorPropuesta("validacion", "La orden no puede estar vacía.");
  }
  const extraccion = parsearExtraccion(entrada.extraccion);
  const acciones = parsearAcciones(entrada.acciones);
  const usuario = entrada.usuario?.trim() || USUARIO_TARJETA;

  return sql.begin(async (tx) => {
    await tx`SET LOCAL ROLE relevo_escritor`;
    await validarAcciones(tx as unknown as Sql, acciones, hoy);
    const contexto = await detectarContexto(tx as unknown as Sql, acciones);
    const nombres = await nombresDe(tx as unknown as Sql, acciones);
    const [fila] = await tx<{ id: string }[]>`
      INSERT INTO propuestas (usuario, orden_texto, extraccion, acciones, estado)
      VALUES (
        ${usuario},
        ${orden},
        ${tx.json(jsonValor(extraccion))}::jsonb,
        ${tx.json(jsonValor(acciones))}::jsonb,
        'pendiente'
      )
      RETURNING id
    `;
    return {
      propuesta_id: fila.id,
      estado: "pendiente",
      usuario,
      orden_texto: orden,
      extraccion,
      acciones,
      contexto,
      veredicto_auditor: null,
      nombres,
    };
  });
}

async function escribirAcciones(
  tx: Sql,
  propuestaId: string,
  acciones: Accion[],
): Promise<ResumenEjecucion["filas"]> {
  let asignaciones = 0;
  let ausencias = 0;
  let cancelaciones = 0;

  for (const accion of acciones) {
    if (accion.tipo === "asignar_turno") {
      try {
        const filas = await tx<{ id: number }[]>`
          INSERT INTO asignaciones (
            empleado_id, turno_id, fecha, estado, origen, propuesta_id
          )
          SELECT
            ${accion.empleado_id},
            t.id,
            ${accion.fecha}::date,
            'programada',
            'tarjeta',
            ${propuestaId}::uuid
          FROM turnos t
          WHERE btrim(t.codigo) = ${accion.turno}
          RETURNING id
        `;
        if (filas.length !== 1) {
          throw new ErrorPropuesta(
            "validacion",
            `El turno ${accion.turno} no existe.`,
          );
        }
        asignaciones += 1;
      } catch (error) {
        if (error instanceof ErrorPropuesta) {
          throw error;
        }
        if (codigoPg(error) === "23505") {
          throw new ErrorPropuesta(
            "escritura",
            "Ya existe una asignación igual para ese empleado, fecha y turno.",
          );
        }
        throw error;
      }
      continue;
    }

    if (accion.tipo === "registrar_ausencia") {
      const filas = await tx<{ id: number }[]>`
        INSERT INTO ausencias (
          empleado_id, tipo, fecha_inicio, fecha_fin, estado, motivo, propuesta_id
        )
        VALUES (
          ${accion.empleado_id},
          ${accion.tipo_ausencia},
          ${accion.fecha_inicio}::date,
          ${accion.fecha_fin}::date,
          'aprobada',
          ${accion.motivo},
          ${propuestaId}::uuid
        )
        RETURNING id
      `;
      ausencias += filas.length;
      continue;
    }

    const filas = await tx<{ id: number }[]>`
      UPDATE asignaciones
      SET estado = 'cancelada', propuesta_id = ${propuestaId}::uuid
      WHERE empleado_id = ${accion.empleado_id}
        AND fecha = ${accion.fecha}::date
        AND estado <> 'cancelada'
      RETURNING id
    `;
    cancelaciones += filas.length;
  }

  return { asignaciones, ausencias, cancelaciones };
}

export type EntradaEjecutar = {
  propuesta_id: string;
  decision: Decision;
  correccion?: Accion[];
  usuario: string;
  hoy?: string;
};

export async function ejecutarPropuesta(
  sql: Sql,
  entrada: EntradaEjecutar,
): Promise<ResumenEjecucion> {
  const hoy = entrada.hoy ?? fechaIsoBogota();
  const usuario = entrada.usuario.trim();
  if (usuario.length === 0) {
    throw new ErrorPropuesta("validacion", "El usuario es obligatorio.");
  }
  if (!UUID.test(entrada.propuesta_id)) {
    throw new ErrorPropuesta("no_encontrada", "No existe la propuesta.");
  }

  try {
    return await sql.begin(async (tx) => {
      const conexion = tx as unknown as Sql;
      await tx`SET LOCAL ROLE relevo_escritor`;
      const filas = await tx<FilaPropuesta[]>`
        SELECT id, estado, usuario, orden_texto, extraccion, acciones, veredicto_auditor
        FROM propuestas
        WHERE id = ${entrada.propuesta_id}::uuid
        FOR UPDATE
      `;
      const propuesta = filas[0];
      if (!propuesta) {
        throw new ErrorPropuesta("no_encontrada", "No existe la propuesta.");
      }
      if (propuesta.estado !== "pendiente") {
        throw new ErrorPropuesta(
          "ya_decidida",
          `La propuesta ya fue decidida (estado=${propuesta.estado}).`,
        );
      }

      const extraccion = parsearExtraccion(propuesta.extraccion);
      const congeladas = parsearAcciones(propuesta.acciones);
      const correccion =
        entrada.decision === "corregir"
          ? parsearAcciones(entrada.correccion ?? [])
          : [];
      if (entrada.decision === "corregir" && correccion.length === 0) {
        throw new ErrorPropuesta(
          "validacion",
          "Corregir exige una lista de acciones.",
        );
      }
      const aEscribir =
        entrada.decision === "corregir" ? correccion : congeladas;
      if (entrada.decision !== "rechazar") {
        await validarAcciones(conexion, aEscribir, hoy);
      }

      const filasEscritas =
        entrada.decision === "rechazar"
          ? { asignaciones: 0, ausencias: 0, cancelaciones: 0 }
          : await escribirAcciones(conexion, entrada.propuesta_id, aEscribir);

      const elegida =
        entrada.decision === "aprobar"
          ? extraccion
          : entrada.decision === "corregir"
            ? extraccionElegida(extraccion, aEscribir)
            : null;
      const rechazada = entrada.decision === "aprobar" ? null : extraccion;
      const correccionJson =
        entrada.decision === "corregir" ? tx.json(jsonValor(aEscribir)) : null;

      await tx`
        INSERT INTO aprobaciones (propuesta_id, usuario, decision, correccion)
        VALUES (
          ${entrada.propuesta_id}::uuid,
          ${usuario},
          ${entrada.decision},
          ${correccionJson}::jsonb
        )
      `;
      await tx`
        INSERT INTO pares_preferencia (
          propuesta_id, prompt_texto, elegida, rechazada, origen
        )
        VALUES (
          ${entrada.propuesta_id}::uuid,
          ${propuesta.orden_texto},
          ${elegida ? tx.json(jsonValor(elegida)) : null}::jsonb,
          ${rechazada ? tx.json(jsonValor(rechazada)) : null}::jsonb,
          ${ORIGEN_PAR[entrada.decision]}
        )
      `;
      await tx`
        UPDATE propuestas
        SET estado = ${ESTADO_POR_DECISION[entrada.decision]}, decidido_en = now()
        WHERE id = ${entrada.propuesta_id}::uuid
      `;

      return {
        propuesta_id: entrada.propuesta_id,
        decision: entrada.decision,
        estado: ESTADO_POR_DECISION[entrada.decision],
        filas: filasEscritas,
      };
    });
  } catch (error) {
    if (error instanceof ErrorPropuesta) {
      throw error;
    }
    const texto = error instanceof Error ? error.message : "";
    if (/password|postgresql:\/\//i.test(texto)) {
      throw new ErrorPropuesta(
        "escritura",
        "No se pudo ejecutar la propuesta.",
      );
    }
    throw new ErrorPropuesta(
      "escritura",
      texto.length > 0
        ? `No se pudo ejecutar la propuesta. ${texto}`
        : "No se pudo ejecutar la propuesta.",
    );
  }
}

/**
 * Guarda el veredicto del auditor A2A en la propuesta pendiente.
 * Solo se acepta sobre propuestas pendientes: una decidida ya no cambia.
 */
export async function guardarVeredicto(
  sql: Sql,
  propuestaId: string,
  veredicto: VeredictoAuditor,
): Promise<boolean> {
  if (!UUID.test(propuestaId) || veredicto.propuesta_id !== propuestaId) {
    return false;
  }
  const filas = await sql<{ id: string }[]>`
    UPDATE propuestas
    SET veredicto_auditor = ${sql.json(jsonValor(veredicto))}::jsonb
    WHERE id = ${propuestaId}::uuid AND estado = 'pendiente'
    RETURNING id
  `;
  return filas.length > 0;
}

export async function leerPropuesta(
  sql: Sql,
  id: string,
): Promise<Propuesta | null> {
  if (!UUID.test(id)) {
    return null;
  }
  const filas = await sql<FilaPropuesta[]>`
    SELECT
      id,
      estado,
      usuario,
      orden_texto,
      extraccion,
      acciones,
      veredicto_auditor
    FROM propuestas
    WHERE id = ${id}::uuid
  `;
  const fila = filas[0];
  if (!fila) {
    return null;
  }
  const acciones = parsearAcciones(fila.acciones);
  const extraccion = parsearExtraccion(fila.extraccion);
  const estado = fila.estado as EstadoPropuesta;
  return {
    propuesta_id: fila.id,
    estado,
    usuario: fila.usuario,
    orden_texto: fila.orden_texto,
    extraccion,
    acciones,
    contexto: await detectarContexto(sql, acciones, fila.id),
    veredicto_auditor: leerVeredicto(fila.veredicto_auditor, fila.id),
    nombres: await nombresDe(sql, acciones),
  };
}
