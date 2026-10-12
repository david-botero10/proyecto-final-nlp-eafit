import { Repeat2 } from "lucide-react";

/** Marca de Relevo: cuadrado redondeado en verde azulado con el símbolo de relevo. */
export function Marca({ tamano = 32 }: { tamano?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-[9px] bg-primary text-white shadow-suave"
      style={{ width: tamano, height: tamano }}
    >
      <Repeat2 size={Math.round(tamano * 0.56)} strokeWidth={2.2} />
    </span>
  );
}
