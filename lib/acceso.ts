/**
 * Código de acceso a la demo en la nube. Solo Web Crypto: lo usan el
 * middleware (edge) y la ruta `/api/acceso` (Node).
 * La cookie guarda un HMAC del código, nunca el código.
 */

export const COOKIE_ACCESO = "relevo_acceso";
export const DURACION_COOKIE_S = 7 * 24 * 60 * 60;

const MENSAJE = "relevo:acceso:v1";
const codificador = new TextEncoder();

export function codigoConfigurado(): string | null {
  const codigo = process.env.ACCESS_CODE;
  return codigo && codigo.length > 0 ? codigo : null;
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** HMAC-SHA256(código, mensaje fijo) en hexadecimal. */
export async function firmaDeAcceso(codigo: string): Promise<string> {
  const llave = await crypto.subtle.importKey(
    "raw",
    codificador.encode(codigo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", llave, codificador.encode(MENSAJE)));
}

/** Comparación de tiempo constante entre dos cadenas hex de igual longitud. */
export function igualesConstante(a: string, b: string): boolean {
  let diferencia = a.length ^ b.length;
  const largo = Math.max(a.length, b.length);
  for (let i = 0; i < largo; i += 1) {
    diferencia |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diferencia === 0;
}

/** ¿La cookie presentada corresponde al código vigente? */
export async function cookieValida(
  presentada: string | undefined,
  codigo: string,
): Promise<boolean> {
  if (!presentada) {
    return false;
  }
  return igualesConstante(presentada, await firmaDeAcceso(codigo));
}

/** ¿El código escrito coincide con el vigente? Compara firmas, no texto. */
export async function codigoCorrecto(
  intento: string,
  codigo: string,
): Promise<boolean> {
  return igualesConstante(
    await firmaDeAcceso(intento),
    await firmaDeAcceso(codigo),
  );
}
