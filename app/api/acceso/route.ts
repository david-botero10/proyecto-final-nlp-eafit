import { NextResponse } from "next/server";
import {
  codigoConfigurado,
  codigoCorrecto,
  COOKIE_ACCESO,
  DURACION_COOKIE_S,
  firmaDeAcceso,
} from "@/lib/acceso";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(peticion: Request) {
  const codigo = codigoConfigurado();
  if (!codigo) {
    // Sin ACCESS_CODE (modo local) no hay nada que desbloquear.
    return NextResponse.json({ ok: true });
  }

  let intento: unknown;
  try {
    intento = ((await peticion.json()) as { codigo?: unknown }).codigo;
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la petición no es JSON válido." },
      { status: 400 },
    );
  }
  if (typeof intento !== "string" || !(await codigoCorrecto(intento, codigo))) {
    return NextResponse.json({ error: "Código incorrecto." }, { status: 401 });
  }

  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.set(COOKIE_ACCESO, await firmaDeAcceso(codigo), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_COOKIE_S,
  });
  return respuesta;
}
