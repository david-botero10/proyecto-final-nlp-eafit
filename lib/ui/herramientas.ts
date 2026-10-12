export type ParteHerramienta = {
  type: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

export type EstadoHerramienta = "ejecutando" | "listo" | "error";

export type ActividadHerramienta = {
  nombre: string;
  estado: EstadoHerramienta;
  etiqueta: string;
  /** Resumen corto del resultado, p. ej. «8 resultados · búsqueda híbrida». */
  resultado: string | null;
  /** Pares clave/valor de la entrada, para el detalle plegable. */
  entrada: { clave: string; valor: string }[];
};

export function nombreDeHerramienta(parte: ParteHerramienta): string | null {
  if (parte.type === "dynamic-tool") {
    return parte.toolName ?? null;
  }
  if (parte.type.startsWith("tool-")) {
    return parte.type.slice("tool-".length);
  }
  return null;
}

function humanizar(nombre: string): string {
  const texto = nombre.replaceAll("_", " ").trim();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function estadoDe(parte: ParteHerramienta): EstadoHerramienta {
  if (parte.state === "output-error" || parte.state === "output-denied") {
    return "error";
  }
  if (parte.state === "output-available") {
    return "listo";
  }
  return "ejecutando";
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim().length > 0
    ? valor.trim()
    : null;
}

function campo(entrada: unknown, clave: string): unknown {
  return entrada && typeof entrada === "object"
    ? (entrada as Record<string, unknown>)[clave]
    : undefined;
}

const VERBOS: Record<
  string,
  { ejecutando: string; listo: string; objeto: string }
> = {
  listar_empleados: {
    ejecutando: "Consultando",
    listo: "Consultó",
    objeto: "empleados",
  },
  consultar_turnos: {
    ejecutando: "Consultando",
    listo: "Consultó",
    objeto: "turnos",
  },
  consultar_ausencias: {
    ejecutando: "Consultando",
    listo: "Consultó",
    objeto: "ausencias",
  },
  crear_propuesta: {
    ejecutando: "Preparando",
    listo: "Preparó",
    objeto: "la propuesta de cambio",
  },
};

function etiquetaDe(
  nombre: string,
  estado: EstadoHerramienta,
  entrada: unknown,
): string {
  if (nombre === "buscar_norma") {
    const consulta = texto(campo(entrada, "consulta"));
    const verbo = estado === "ejecutando" ? "Buscando" : "Buscó";
    return consulta
      ? `${verbo} en la norma: «${consulta}»`
      : `${verbo} en la norma`;
  }
  const verbos = VERBOS[nombre];
  if (!verbos) {
    return humanizar(nombre);
  }
  const verbo = estado === "ejecutando" ? verbos.ejecutando : verbos.listo;
  return `${verbo} ${verbos.objeto}`;
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

function resumenDeResultado(salida: unknown): string | null {
  if (!salida || typeof salida !== "object") {
    return null;
  }
  const fila = salida as Record<string, unknown>;
  if (typeof fila.error === "string") {
    return null;
  }
  const lista = Object.values(fila).find(Array.isArray) as
    | unknown[]
    | undefined;
  if (!lista) {
    return null;
  }
  const base = plural(lista.length, "resultado", "resultados");
  if (fila.modo === "hibrida") {
    return `${base} · búsqueda híbrida`;
  }
  if (fila.modo === "lexica") {
    return `${base} · búsqueda léxica`;
  }
  return base;
}

function pares(entrada: unknown): { clave: string; valor: string }[] {
  if (!entrada || typeof entrada !== "object") {
    return [];
  }
  return Object.entries(entrada as Record<string, unknown>).flatMap(
    ([clave, valor]) => {
      if (valor === undefined || valor === null || valor === "") {
        return [];
      }
      const plano =
        typeof valor === "object" ? JSON.stringify(valor) : String(valor);
      return [
        {
          clave,
          valor: plano.length > 140 ? `${plano.slice(0, 137)}…` : plano,
        },
      ];
    },
  );
}

export function actividadDe(
  parte: ParteHerramienta,
): ActividadHerramienta | null {
  const nombre = nombreDeHerramienta(parte);
  if (!nombre) {
    return null;
  }
  const estado = estadoDe(parte);
  return {
    nombre,
    estado,
    etiqueta: etiquetaDe(nombre, estado, parte.input),
    resultado: estado === "listo" ? resumenDeResultado(parte.output) : null,
    entrada: pares(parte.input),
  };
}
