"use client";

import { useState } from "react";
import {
  USUARIO_TARJETA,
  type Accion,
  type Propuesta,
  type ResumenEjecucion,
  type Turno,
  type TipoAusencia,
} from "@/lib/tipos";

const TURNO_ETIQUETA: Record<Turno, string> = {
  M: "Mañana",
  T: "Tarde",
  N: "Noche",
};

const AUSENCIA_ETIQUETA: Record<TipoAusencia, string> = {
  vacaciones: "Vacaciones",
  incapacidad: "Incapacidad",
  permiso: "Permiso",
  licencia: "Licencia",
};

const ACCION_ETIQUETA: Record<Accion["tipo"], string> = {
  asignar_turno: "Asignar turno",
  registrar_ausencia: "Registrar ausencia",
  cancelar_turno: "Cancelar turno",
};

function nombreDe(propuesta: Propuesta, empleadoId: number): string {
  return (
    propuesta.nombres.find((empleado) => empleado.id === empleadoId)?.nombre ??
    `Empleado ${empleadoId}`
  );
}

function fechaDe(accion: Accion): string {
  if (accion.tipo === "registrar_ausencia") {
    return accion.fecha_inicio === accion.fecha_fin
      ? accion.fecha_inicio
      : `${accion.fecha_inicio} – ${accion.fecha_fin}`;
  }
  return accion.fecha;
}

function detalleDe(accion: Accion): string {
  if (accion.tipo === "asignar_turno") {
    return TURNO_ETIQUETA[accion.turno];
  }
  if (accion.tipo === "registrar_ausencia") {
    return AUSENCIA_ETIQUETA[accion.tipo_ausencia];
  }
  return "Quitar turno";
}

function fechaValida(accion: Accion): boolean {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (accion.tipo === "registrar_ausencia") {
    return iso.test(accion.fecha_inicio) && iso.test(accion.fecha_fin);
  }
  return iso.test(accion.fecha);
}

export function textoResumen(resumen: ResumenEjecucion): string {
  if (resumen.decision === "rechazar") {
    return "Quedó rechazada. No se escribió nada en la nómina.";
  }
  const titulo =
    resumen.decision === "aprobar" ? "Quedó aprobada" : "Quedó corregida";
  const { asignaciones, ausencias, cancelaciones } = resumen.filas;
  const cuenta = (n: number, uno: string, varios: string) =>
    `${n} ${n === 1 ? uno : varios}`;
  return `${titulo}. ${cuenta(asignaciones, "asignación", "asignaciones")}, ${cuenta(ausencias, "ausencia", "ausencias")} y ${cuenta(cancelaciones, "cancelación", "cancelaciones")}.`;
}

export function TarjetaPropuesta({
  propuesta,
  usuario = USUARIO_TARJETA,
}: {
  propuesta: Propuesta;
  usuario?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<Accion[]>(propuesta.acciones);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenEjecucion | null>(null);

  const decidida = propuesta.estado !== "pendiente" || resumen !== null;
  const auditorRechazo = propuesta.veredicto_auditor?.veredicto === "rechazado";
  const acciones = editando ? borrador : propuesta.acciones;

  async function decidir(decision: "aprobar" | "corregir" | "rechazar") {
    if (decision === "corregir") {
      if (borrador.length === 0) {
        setError("La corrección debe incluir al menos una acción.");
        return;
      }
      if (borrador.some((accion) => !fechaValida(accion))) {
        setError("Las fechas deben ser YYYY-MM-DD.");
        return;
      }
    }
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await fetch(
        `/api/propuestas/${propuesta.propuesta_id}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            usuario,
            ...(decision === "corregir" ? { correccion: borrador } : {}),
          }),
        },
      );
      const cuerpo = (await respuesta.json()) as ResumenEjecucion & {
        error?: string;
      };
      if (!respuesta.ok) {
        setError(cuerpo.error ?? "No se pudo registrar la decisión.");
        return;
      }
      setResumen(cuerpo);
      setEditando(false);
    } catch {
      setError("No se pudo registrar la decisión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <article className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
      <h2 className="text-sm font-semibold text-stone-900">
        Tarjeta de aprobación
      </h2>

      <section className="mt-3" aria-label="Orden original">
        <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500">
          Orden
        </h3>
        <p className="mt-1 whitespace-pre-wrap text-sm">{propuesta.orden_texto}</p>
      </section>

      <section className="mt-3" aria-label="Extracción interpretada">
        <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500">
          Interpretación
        </h3>
        <p className="mt-1 text-sm">
          {propuesta.extraccion.empleado}
          {" · "}
          {propuesta.extraccion.accion}
          {propuesta.extraccion.turno
            ? ` · ${TURNO_ETIQUETA[propuesta.extraccion.turno]}`
            : ""}
          {propuesta.extraccion.fechas.length > 0
            ? ` · ${propuesta.extraccion.fechas.join(", ")}`
            : ""}
        </p>
        <p className="mt-1 text-xs text-stone-500">
          {propuesta.extraccion.justificacion ?? "Sin justificación"}
          {" · "}
          {propuesta.extraccion.proveedor}
        </p>
      </section>

      <section className="mt-3" aria-label="Acciones exactas">
        <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500">
          Acciones
        </h3>
        {acciones.length === 0 ? (
          <p className="mt-1 text-sm text-stone-600">
            No quedan acciones en la corrección.
          </p>
        ) : (
          <div className="mt-1 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-stone-500">
                  <th className="py-1 pr-3 font-medium">Empleado</th>
                  <th className="py-1 pr-3 font-medium">Fecha</th>
                  <th className="py-1 pr-3 font-medium">Turno o tipo</th>
                  {editando ? <th className="py-1 font-medium"> </th> : null}
                </tr>
              </thead>
              <tbody>
                {acciones.map((accion, indice) => (
                  <tr
                    key={`${accion.tipo}-${indice}`}
                    className="border-t border-stone-200"
                  >
                    <td className="py-2 pr-3 align-top">
                      {nombreDe(propuesta, accion.empleado_id)}
                      <span className="mt-0.5 block text-xs text-stone-500">
                        {ACCION_ETIQUETA[accion.tipo]}
                      </span>
                    </td>
                    <td className="py-2 pr-3 align-top">
                      {editando ? (
                        accion.tipo === "registrar_ausencia" ? (
                          <span className="flex flex-col gap-1">
                            <input
                              aria-label={`Inicio de la fila ${indice + 1}`}
                              className="rounded border border-stone-300 px-2 py-1"
                              type="date"
                              value={accion.fecha_inicio}
                              onChange={(evento) =>
                                setBorrador((previo) =>
                                  previo.map((fila, i) =>
                                    i === indice && fila.tipo === "registrar_ausencia"
                                      ? { ...fila, fecha_inicio: evento.target.value }
                                      : fila,
                                  ),
                                )
                              }
                            />
                            <input
                              aria-label={`Fin de la fila ${indice + 1}`}
                              className="rounded border border-stone-300 px-2 py-1"
                              type="date"
                              value={accion.fecha_fin}
                              onChange={(evento) =>
                                setBorrador((previo) =>
                                  previo.map((fila, i) =>
                                    i === indice && fila.tipo === "registrar_ausencia"
                                      ? { ...fila, fecha_fin: evento.target.value }
                                      : fila,
                                  ),
                                )
                              }
                            />
                          </span>
                        ) : (
                          <input
                            aria-label={`Fecha de la fila ${indice + 1}`}
                            className="rounded border border-stone-300 px-2 py-1"
                            type="date"
                            value={accion.fecha}
                            onChange={(evento) =>
                              setBorrador((previo) =>
                                previo.map((fila, i) => {
                                  if (i !== indice || fila.tipo === "registrar_ausencia") {
                                    return fila;
                                  }
                                  return { ...fila, fecha: evento.target.value };
                                }),
                              )
                            }
                          />
                        )
                      ) : (
                        fechaDe(accion)
                      )}
                    </td>
                    <td className="py-2 pr-3 align-top">
                      {editando && accion.tipo === "asignar_turno" ? (
                        <select
                          aria-label={`Turno de la fila ${indice + 1}`}
                          className="rounded border border-stone-300 bg-white px-2 py-1"
                          value={accion.turno}
                          onChange={(evento) => {
                            const turno = evento.target.value as Turno;
                            setBorrador((previo) =>
                              previo.map((fila, i) =>
                                i === indice && fila.tipo === "asignar_turno"
                                  ? { ...fila, turno }
                                  : fila,
                              ),
                            );
                          }}
                        >
                          <option value="M">Mañana</option>
                          <option value="T">Tarde</option>
                          <option value="N">Noche</option>
                        </select>
                      ) : editando && accion.tipo === "registrar_ausencia" ? (
                        <select
                          aria-label="Tipo de ausencia"
                          className="rounded border border-stone-300 bg-white px-2 py-1"
                          value={accion.tipo_ausencia}
                          onChange={(evento) => {
                            const tipo = evento.target.value as TipoAusencia;
                            setBorrador((previo) =>
                              previo.map((fila, i) =>
                                i === indice && fila.tipo === "registrar_ausencia"
                                  ? { ...fila, tipo_ausencia: tipo }
                                  : fila,
                              ),
                            );
                          }}
                        >
                          <option value="vacaciones">Vacaciones</option>
                          <option value="incapacidad">Incapacidad</option>
                          <option value="permiso">Permiso</option>
                          <option value="licencia">Licencia</option>
                        </select>
                      ) : (
                        detalleDe(accion)
                      )}
                    </td>
                    {editando ? (
                      <td className="py-2 align-top">
                        <button
                          type="button"
                          className="text-xs text-stone-600 underline"
                          onClick={() =>
                            setBorrador((previo) =>
                              previo.filter((_, i) => i !== indice),
                            )
                          }
                        >
                          Quitar
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-3" aria-label="Avisos">
        <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500">
          Avisos
        </h3>
        {propuesta.contexto.solapes_detectados.length === 0 &&
        propuesta.contexto.ausencias_en_rango.length === 0 ? (
          <p className="mt-1 text-sm text-stone-600">
            No hay solapes con asignaciones ni ausencias aprobadas.
          </p>
        ) : (
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-amber-900">
            {propuesta.contexto.solapes_detectados.map((solape) => (
              <li key={`${solape.empleado_id}-${solape.fecha}-${solape.turno}`}>
                Solape: {solape.empleado} ya tiene turno {solape.turno} el{" "}
                {solape.fecha} ({solape.estado}).
              </li>
            ))}
            {propuesta.contexto.ausencias_en_rango.map((ausencia) => (
              <li
                key={`${ausencia.empleado_id}-${ausencia.tipo}-${ausencia.fecha_inicio}`}
              >
                Ausencia aprobada: {ausencia.empleado}, {ausencia.tipo} del{" "}
                {ausencia.fecha_inicio} al {ausencia.fecha_fin}.
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-3" aria-label="Auditoría">
        <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500">
          Auditoría
        </h3>
        {propuesta.veredicto_auditor ? (
          <div className="mt-1 text-sm">
            <p>{propuesta.veredicto_auditor.veredicto}</p>
            {propuesta.veredicto_auditor.razones.length > 0 ? (
              <ul className="mt-1 list-disc pl-4 text-stone-700">
                {propuesta.veredicto_auditor.razones.map((razon, indice) => (
                  <li key={`${indice}-${razon}`}>{razon}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="mt-1 text-sm text-stone-600">sin auditar</p>
        )}
        {auditorRechazo && !decidida ? (
          <p className="mt-1 text-sm text-stone-700">
            El auditor rechazó la propuesta. No se puede aprobar tal cual;
            puedes corregirla o rechazarla.
          </p>
        ) : null}
      </section>

      {resumen ? (
        <p className="mt-3 text-sm font-medium text-stone-900" role="status">
          {textoResumen(resumen)}
        </p>
      ) : propuesta.estado !== "pendiente" ? (
        <p className="mt-3 text-sm font-medium text-stone-900" role="status">
          Esta propuesta ya está {propuesta.estado}.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {enviando ? (
        <p className="mt-3 text-xs text-stone-500" aria-live="polite">
          Guardando la decisión…
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg bg-stone-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={enviando || decidida || auditorRechazo}
          onClick={() => void decidir("aprobar")}
        >
          Aprobar
        </button>
        {editando ? (
          <button
            type="button"
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
            disabled={enviando || decidida}
            onClick={() => void decidir("corregir")}
          >
            Enviar corrección
          </button>
        ) : (
          <button
            type="button"
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
            disabled={enviando || decidida}
            onClick={() => {
              setBorrador(propuesta.acciones.map((accion) => ({ ...accion })));
              setEditando(true);
              setError(null);
            }}
          >
            Corregir
          </button>
        )}
        {editando ? (
          <button
            type="button"
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
            disabled={enviando}
            onClick={() => {
              setBorrador(propuesta.acciones.map((accion) => ({ ...accion })));
              setEditando(false);
              setError(null);
            }}
          >
            Cancelar edición
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
          disabled={enviando || decidida}
          onClick={() => void decidir("rechazar")}
        >
          Rechazar
        </button>
      </div>
    </article>
  );
}
