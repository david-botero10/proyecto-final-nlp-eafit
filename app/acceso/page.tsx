import { Marca } from "@/components/shell/marca";
import { FormularioAcceso } from "./formulario";

export const metadata = { title: "Relevo · Acceso" };

export default function PaginaAcceso() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-10">
      <div className="w-full max-w-sm rounded-tarjeta border border-line bg-surface p-7 shadow-elevada">
        <div className="flex items-center gap-3">
          <Marca tamano={40} />
          <span className="text-2xl font-bold tracking-tight text-ink">
            Relevo
          </span>
        </div>
        <h1 className="mt-6 text-xl font-bold text-ink">Acceso a la demo</h1>
        <p className="mt-1.5 mb-5 text-sm leading-relaxed text-muted">
          Esta demo está protegida. Escribe el código de acceso para continuar.
        </p>
        <FormularioAcceso />
      </div>
    </main>
  );
}
