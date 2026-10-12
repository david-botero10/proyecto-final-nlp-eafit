"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversacionResumen } from "./agrupar-historial";

/** Lista del historial del usuario y borrado, contra /api/conversaciones. */
export function useHistorial(usuario: string) {
  const [conversaciones, setConversaciones] = useState<ConversacionResumen[]>(
    [],
  );
  const [cargando, setCargando] = useState(true);
  const usuarioActual = useRef(usuario);
  usuarioActual.current = usuario;

  const refrescar = useCallback(async () => {
    const pedido = usuarioActual.current;
    try {
      const respuesta = await fetch(
        `/api/conversaciones?usuario=${encodeURIComponent(pedido)}`,
      );
      if (!respuesta.ok) {
        return;
      }
      const datos = (await respuesta.json()) as {
        conversaciones?: ConversacionResumen[];
      };
      if (pedido === usuarioActual.current && Array.isArray(datos.conversaciones)) {
        setConversaciones(datos.conversaciones);
      }
    } catch {
      // Sin historial la app sigue funcionando.
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    setConversaciones([]);
    setCargando(true);
    void refrescar();
  }, [usuario, refrescar]);

  const eliminar = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const respuesta = await fetch(
          `/api/conversaciones/${id}?usuario=${encodeURIComponent(usuarioActual.current)}`,
          { method: "DELETE" },
        );
        if (!respuesta.ok) {
          return false;
        }
        setConversaciones((previas) =>
          previas.filter((conversacion) => conversacion.id !== id),
        );
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  return { conversaciones, cargando, refrescar, eliminar };
}
