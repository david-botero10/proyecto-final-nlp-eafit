"use client";

import { useState, type FormEvent } from "react";

export function FormularioAcceso() {
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/acceso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      if (respuesta.ok) {
        window.location.assign("/");
        return;
      }
      setError(
        respuesta.status === 401
          ? "Código incorrecto."
          : "No se pudo validar el código.",
      );
    } catch {
      setError("No se pudo validar el código.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3">
      <label htmlFor="codigo" className="text-sm font-semibold text-ink">
        Código de acceso
      </label>
      <input
        id="codigo"
        type="password"
        autoComplete="current-password"
        autoFocus
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        className="rounded-boton border border-line bg-surface px-3 py-2.5 text-sm text-ink"
      />
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={enviando || codigo.length === 0}
        className="rounded-boton bg-primary px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        Entrar
      </button>
    </form>
  );
}
