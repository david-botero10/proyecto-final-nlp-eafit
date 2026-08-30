-- Roles de acceso. Las credenciales de aplicación viven en .env, no aquí.
-- relevo_lector: tools MCP de lectura y auditor A2A (solo SELECT).
-- relevo_escritor: crear_propuesta, ejecutar_propuesta y pipeline de indexación.
-- Los roles son de clúster: este script es idempotente ante --reset del esquema.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'relevo_lector') THEN
        CREATE ROLE relevo_lector NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'relevo_escritor') THEN
        CREATE ROLE relevo_escritor NOLOGIN;
    END IF;
END
$$;

COMMENT ON ROLE relevo_lector IS
  'Lectura: tools MCP de consulta y auditor A2A. Nunca escribe nómina.';
COMMENT ON ROLE relevo_escritor IS
  'Escritura gobernada: propuestas, ejecución de tarjeta e indexación del corpus.';

GRANT USAGE ON SCHEMA public TO relevo_lector;
GRANT USAGE ON SCHEMA public TO relevo_escritor;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO relevo_lector;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO relevo_lector;

GRANT relevo_lector TO relevo_escritor;

GRANT INSERT, UPDATE ON TABLE
    propuestas,
    aprobaciones,
    pares_preferencia,
    asignaciones,
    ausencias,
    documentos,
    chunks,
    conversaciones,
    mensajes,
    perfiles
TO relevo_escritor;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO relevo_escritor;

-- El usuario de desarrollo (relevo) puede impersonar los roles en pruebas.
GRANT relevo_lector TO relevo;
GRANT relevo_escritor TO relevo;
