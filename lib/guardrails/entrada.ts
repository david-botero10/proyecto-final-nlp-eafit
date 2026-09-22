export const LIMITE_CARACTERES = 2000;
export const LIMITE_POR_MINUTO = 30;

const VENTANA_MS = 60_000;
const ventanas = new Map<string, number[]>();

export function reiniciarCupos(): void {
  ventanas.clear();
}

/** True si el usuario todavía tiene cupo en la ventana de un minuto. */
export function consumirCupo(usuario: string, ahora = Date.now()): boolean {
  const previas = (ventanas.get(usuario) ?? []).filter(
    (marca) => ahora - marca < VENTANA_MS,
  );
  if (previas.length >= LIMITE_POR_MINUTO) {
    ventanas.set(usuario, previas);
    return false;
  }
  previas.push(ahora);
  ventanas.set(usuario, previas);
  return true;
}

type MensajeTexto = {
  role: string;
  parts: { type: string; text?: string }[];
};

export function textoCrudoUsuario(mensajes: MensajeTexto[]): string {
  const usuario = [...mensajes].reverse().find((mensaje) => mensaje.role === "user");
  if (!usuario) {
    return "";
  }
  return usuario.parts
    .filter((parte) => parte.type === "text")
    .map((parte) => parte.text ?? "")
    .join("");
}
