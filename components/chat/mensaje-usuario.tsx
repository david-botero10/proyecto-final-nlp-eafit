export function MensajeUsuario({ texto }: { texto: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-[14px] rounded-br-[4px] bg-primary px-4 py-2.5 text-[15px] leading-relaxed text-white shadow-suave">
        {texto}
      </p>
    </div>
  );
}
