import { NextResponse, type NextRequest } from "next/server";
import { codigoConfigurado, COOKIE_ACCESO, cookieValida } from "@/lib/acceso";

/** Rutas sin código de acceso. El A2A se protege con AUDITOR_TOKEN. */
const EXENTAS = new Set([
  "/acceso",
  "/api/acceso",
  "/.well-known/agent.json",
  "/a2a",
]);

export async function middleware(peticion: NextRequest) {
  const codigo = codigoConfigurado();
  if (!codigo) {
    return NextResponse.next();
  }

  const { pathname } = peticion.nextUrl;
  if (EXENTAS.has(pathname)) {
    return NextResponse.next();
  }

  if (await cookieValida(peticion.cookies.get(COOKIE_ACCESO)?.value, codigo)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Se necesita el código de acceso." },
      { status: 401 },
    );
  }

  const destino = peticion.nextUrl.clone();
  destino.pathname = "/acceso";
  destino.search = "";
  return NextResponse.redirect(destino);
}

export const config = {
  // Todo menos los recursos estáticos de Next.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
