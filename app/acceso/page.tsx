import { FormularioAcceso } from "./formulario";

export const metadata = { title: "Relevo · Acceso" };

export default function PaginaAcceso() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">Relevo</h1>
      <p className="text-sm text-stone-600">
        Esta demo está protegida. Escribe el código de acceso para continuar.
      </p>
      <FormularioAcceso />
    </main>
  );
}
