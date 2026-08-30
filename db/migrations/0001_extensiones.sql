-- Extensiones y función inmutable para el tsvector en español.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE FUNCTION es_unaccent(text) RETURNS text AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

COMMENT ON FUNCTION es_unaccent(text) IS
  'Envoltorio inmutable de unaccent para columnas tsvector generadas.';
