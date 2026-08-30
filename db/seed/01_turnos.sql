-- Dataset sintético Relevo. Semilla 42. Sin datos reales.
INSERT INTO turnos (id, codigo, nombre, hora_inicio, hora_fin, cruza_medianoche) VALUES
    (1, 'M', 'Mañana', '06:00:00', '14:00:00', FALSE),
    (2, 'T', 'Tarde', '14:00:00', '22:00:00', FALSE),
    (3, 'N', 'Noche', '22:00:00', '06:00:00', TRUE);
SELECT setval(pg_get_serial_sequence('turnos', 'id'), (SELECT MAX(id) FROM turnos));
