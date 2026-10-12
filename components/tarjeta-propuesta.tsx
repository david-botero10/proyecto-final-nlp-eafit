"use client";

import {
  CircleCheck,
  CircleHelp,
  CircleX,
  Hourglass,
  PencilLine,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import {
  USUARIO_TARJETA,
  type Accion,
  type EstadoPropuesta,
  type Propuesta,
  type ResumenEjecucion,
  type Turno,
  type TipoAusencia,
  type Veredicto,
} from "@/lib/tipos";

const PROVEEDOR_ETIQUETA: Record<"xai" | "lora", string> = {
  xai: "Interpretó Grok 4.7",
  lora: "Interpretó el extractor propio",
};

// «cst_pr006» → «CST», «ley_2466_2025» → «Ley 2466 de 2025».
function etiquetaNorma(fuente: string, articulo: string): string {
  const ley = /^ley_(\d+)_(\d{4})$/.exec(fuente);
  const origen = fuente.startsWith("cst")
    ? "CST"
    : ley
      ? `Ley ${ley[1]} de ${ley[2]}`
      : fuente;
  return `art. ${articulo} (${origen})`;
}

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

type Franja = {
  texto: string;
  icono: LucideIcon;
  clases: string;
};

const FRANJAS: Record<EstadoPropuesta, Franja> = {
  pendiente: {
    texto: "Esperando tu aprobación",
    icono: Hourglass,
    clases: "bg-amber text-deep",
  },
  aprobada: {
    texto: "Aprobada · escrita en la nómina",
    icono: CircleCheck,
    clases: "bg-success text-white",
  },
  corregida: {
    texto: "Corregida · escrita en la nómina",
    icono: PencilLine,
    clases: "bg-primary text-white",
  },
  rechazada: {
    texto: "Rechazada",
    icono: CircleX,
    clases: "bg-muted text-white",
  },
  expirada: {
    texto: "Expirada",
    icono: CircleX,
    clases: "bg-muted text-white",
  },
};

const MARCO: Record<EstadoPropuesta, string> = {
  pendiente: "border-amber bg-amber-tint ring-2 ring-amber/35",
  aprobada: "border-success/40 bg-surface",
  corregida: "border-primary/40 bg-surface",
  rechazada: "border-line bg-surface",
  expirada: "border-line bg-surface",
};

type Insignia = { icono: LucideIcon; clases: string };

const INSIGNIA_VEREDICTO: Record<Veredicto, Insignia> = {
  aprobado: { icono: ShieldCheck, clases: "bg-success-tint text-success" },
  observaciones: { icono: ShieldAlert, clases: "bg-amber-tint text-amber-ink" },
  rechazado: { icono: ShieldX, clases: "bg-danger-tint text-danger" },
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

const CLASE_CAMPO =
  "rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink";

const BOTON_BASE =
  "rounded-boton px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const BOTON_PRIMARIO = `${BOTON_BASE} bg-primary text-white hover:bg-primary-hover`;
const BOTON_SECUNDARIO = `${BOTON_BASE} border border-line bg-surface text-ink hover:bg-sand`;
const BOTON_PELIGRO = `${BOTON_BASE} text-danger hover:bg-danger-tint`;

function Titulo({ children }: { children: string }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">
      {children}
    </h3>
  );
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
  const estadoVisual: EstadoPropuesta = resumen
    ? resumen.estado
    : propuesta.estado;
  const franja = FRANJAS[estadoVisual];
  const IconoFranja = franja.icono;
  const veredicto = propuesta.veredicto_auditor;

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
    <article
      aria-label="Tarjeta de aprobación"
      className={`mt-4 overflow-hidden rounded-tarjeta border shadow-suave ${MARCO[estadoVisual]}`}
    >
      <div
        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold ${franja.clases}`}
      >
        <IconoFranja size={16} aria-hidden="true" />
        <span>{franja.texto}</span>
      </div>

      <div className="px-4 py-4">
        <h2 className="text-[15px] font-bold text-ink">
          Tarjeta de aprobación
        </h2>
        <p className="mt-0.5 text-[12.5px] text-muted">
          Lo que ves aquí es exactamente lo que se escribirá al aprobar.
        </p>

        <section className="mt-4" aria-label="Orden original">
          <Titulo>Orden original</Titulo>
          <p className="mt-1.5 whitespace-pre-wrap rounded-fila border border-line bg-surface px-3 py-2 text-sm text-ink">
            {propuesta.orden_texto}
          </p>
        </section>

        <section className="mt-4" aria-label="Extracción interpretada">
          <Titulo>Interpretación</Titulo>
          <p className="mt-1.5 text-sm text-ink">
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
          <p className="mt-1 text-xs text-muted">
            {propuesta.extraccion.justificacion ?? "Sin justificación"}
            {" · "}
            {PROVEEDOR_ETIQUETA[propuesta.extraccion.proveedor]}
          </p>
        </section>

        <section className="mt-4" aria-label="Acciones exactas">
          <Titulo>Lo que se escribirá</Titulo>
          {acciones.length === 0 ? (
            <p className="mt-1.5 text-sm text-muted">
              No quedan acciones en la corrección.
            </p>
          ) : (
            <div className="mt-1.5 overflow-x-auto rounded-fila border border-line bg-surface">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-sand/70 text-xs text-muted">
                    <th className="px-3 py-2 font-semibold">Empleado</th>
                    <th className="px-3 py-2 font-semibold">Fecha</th>
                    <th className="px-3 py-2 font-semibold">Turno o tipo</th>
                    {editando ? (
                      <th className="px-3 py-2 font-semibold"> </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {acciones.map((accion, indice) => (
                    <tr
                      key={`${accion.tipo}-${indice}`}
                      className="border-t border-line"
                    >
                      <td className="px-3 py-2.5 align-top font-medium text-ink">
                        {nombreDe(propuesta, accion.empleado_id)}
                        <span className="mt-0.5 block text-xs font-normal text-muted">
                          {ACCION_ETIQUETA[accion.tipo]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-top text-ink">
                        {editando ? (
                          accion.tipo === "registrar_ausencia" ? (
                            <span className="flex flex-col gap-1">
                              <input
                                aria-label={`Inicio de la fila ${indice + 1}`}
                                className={CLASE_CAMPO}
                                type="date"
                                value={accion.fecha_inicio}
                                onChange={(evento) =>
                                  setBorrador((previo) =>
                                    previo.map((fila, i) =>
                                      i === indice &&
                                      fila.tipo === "registrar_ausencia"
                                        ? {
                                            ...fila,
                                            fecha_inicio: evento.target.value,
                                          }
                                        : fila,
                                    ),
                                  )
                                }
                              />
                              <input
                                aria-label={`Fin de la fila ${indice + 1}`}
                                className={CLASE_CAMPO}
                                type="date"
                                value={accion.fecha_fin}
                                onChange={(evento) =>
                                  setBorrador((previo) =>
                                    previo.map((fila, i) =>
                                      i === indice &&
                                      fila.tipo === "registrar_ausencia"
                                        ? {
                                            ...fila,
                                            fecha_fin: evento.target.value,
                                          }
                                        : fila,
                                    ),
                                  )
                                }
                              />
                            </span>
                          ) : (
                            <input
                              aria-label={`Fecha de la fila ${indice + 1}`}
                              className={CLASE_CAMPO}
                              type="date"
                              value={accion.fecha}
                              onChange={(evento) =>
                                setBorrador((previo) =>
                                  previo.map((fila, i) => {
                                    if (
                                      i !== indice ||
                                      fila.tipo === "registrar_ausencia"
                                    ) {
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
                      <td className="px-3 py-2.5 align-top text-ink">
                        {editando && accion.tipo === "asignar_turno" ? (
                          <select
                            aria-label={`Turno de la fila ${indice + 1}`}
                            className={CLASE_CAMPO}
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
                            className={CLASE_CAMPO}
                            value={accion.tipo_ausencia}
                            onChange={(evento) => {
                              const tipo = evento.target.value as TipoAusencia;
                              setBorrador((previo) =>
                                previo.map((fila, i) =>
                                  i === indice &&
                                  fila.tipo === "registrar_ausencia"
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
                          <span className="inline-flex rounded-md bg-primary-tint px-2 py-0.5 text-[13px] font-semibold text-primary">
                            {detalleDe(accion)}
                          </span>
                        )}
                      </td>
                      {editando ? (
                        <td className="px-3 py-2.5 align-top">
                          <button
                            type="button"
                            className="text-xs font-medium text-danger underline"
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

        <section className="mt-4" aria-label="Avisos">
          <Titulo>Avisos</Titulo>
          {propuesta.contexto.solapes_detectados.length === 0 &&
          propuesta.contexto.ausencias_en_rango.length === 0 ? (
            <p className="mt-1.5 text-sm text-muted">
              No hay solapes con asignaciones ni ausencias aprobadas.
            </p>
          ) : (
            <ul className="mt-1.5 space-y-1.5 text-sm text-amber-ink">
              {propuesta.contexto.solapes_detectados.map((solape) => (
                <li
                  key={`${solape.empleado_id}-${solape.fecha}-${solape.turno}`}
                  className="flex items-start gap-2"
                >
                  <TriangleAlert
                    size={15}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0"
                  />
                  <span>
                    Solape: {solape.empleado} ya tiene turno {solape.turno} el{" "}
                    {solape.fecha} ({solape.estado}).
                  </span>
                </li>
              ))}
              {propuesta.contexto.ausencias_en_rango.map((ausencia) => (
                <li
                  key={`${ausencia.empleado_id}-${ausencia.tipo}-${ausencia.fecha_inicio}`}
                  className="flex items-start gap-2"
                >
                  <TriangleAlert
                    size={15}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0"
                  />
                  <span>
                    Ausencia aprobada: {ausencia.empleado}, {ausencia.tipo} del{" "}
                    {ausencia.fecha_inicio} al {ausencia.fecha_fin}.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-4" aria-label="Auditoría">
          <Titulo>Auditoría</Titulo>
          {veredicto ? (
            <div className="mt-1.5">
              <InsigniaVeredicto veredicto={veredicto.veredicto} />
              {veredicto.razones.length > 0 ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-ink">
                  {veredicto.razones.map((razon, indice) => (
                    <li key={`${indice}-${razon}`}>{razon}</li>
                  ))}
                </ul>
              ) : null}
              {veredicto.normas_citadas.length > 0 ? (
                <p className="mt-2 text-xs text-muted">
                  Normas citadas:{" "}
                  {veredicto.normas_citadas
                    .map((norma) => etiquetaNorma(norma.fuente, norma.articulo))
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-sand px-3 py-1 text-[13px] font-semibold text-muted">
              <CircleHelp size={14} aria-hidden="true" />
              <span>sin auditar</span>
            </p>
          )}
          {auditorRechazo && !decidida ? (
            <p className="mt-2 text-sm text-ink">
              El auditor rechazó la propuesta. No se puede aprobar tal cual;
              puedes corregirla o rechazarla.
            </p>
          ) : null}
        </section>

        {resumen ? (
          <p className="mt-4 text-sm font-semibold text-ink" role="status">
            {textoResumen(resumen)}
          </p>
        ) : propuesta.estado !== "pendiente" ? (
          <p className="mt-4 text-sm font-semibold text-ink" role="status">
            Esta propuesta ya está {propuesta.estado}.
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {enviando ? (
          <p className="mt-3 text-xs text-muted" aria-live="polite">
            Guardando la decisión…
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={BOTON_PRIMARIO}
            disabled={enviando || decidida || auditorRechazo}
            onClick={() => void decidir("aprobar")}
          >
            Aprobar
          </button>
          {editando ? (
            <button
              type="button"
              className={BOTON_SECUNDARIO}
              disabled={enviando || decidida}
              onClick={() => void decidir("corregir")}
            >
              Enviar corrección
            </button>
          ) : (
            <button
              type="button"
              className={BOTON_SECUNDARIO}
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
              className={BOTON_SECUNDARIO}
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
            className={BOTON_PELIGRO}
            disabled={enviando || decidida}
            onClick={() => void decidir("rechazar")}
          >
            Rechazar
          </button>
        </div>
      </div>
    </article>
  );
}

function InsigniaVeredicto({ veredicto }: { veredicto: Veredicto }) {
  const { icono: Icono, clases } = INSIGNIA_VEREDICTO[veredicto];
  return (
    <p
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold capitalize ring-1 ring-inset ring-current/25 ${clases}`}
    >
      <Icono size={15} aria-hidden="true" />
      <span>{veredicto}</span>
    </p>
  );
}
