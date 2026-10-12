# Reporte — guion de la presentación y runbook de la demo

Rama `docs/guion-presentacion`.

## Qué quedó

- `informe/GUION_PRESENTACION.md` (nuevo): supuesto de 20 minutos (13 de charla, 5 de demo, 2 de colchón), variante comprimida de 12 minutos, 15 bloques de lámina en el orden de `deck.json` (tiempo, quién como sugerencia, qué decir, teoría, preguntas del jurado, plan B), mapa de la rúbrica, glosario de 25 términos y checklist del ensayo.
- `informe/GUION_DEMO.md` (actualizado): runbook operativo con preparación del día anterior, SQL de reseteo limitado a lo creado por los ensayos, pila mínima por memoria, comandos de 30 minutos antes, las cuatro interacciones verificadas el 12 de octubre de 2026, plan B y cierre. Se quitó `grok-4.6` y la nota de la columna Grok pendiente.
- `informe/figuras/componentes.md`: «Grok 4.6» pasa a «Grok 4.7» donde nombra el modelo del asistente.

## Afirmaciones que no se pudieron fundamentar por completo

1. **Recall léxico de 12,5 % (lámina 7).** Está en la lámina, pero `evaluacion/resultados/citas.json` solo trae filas híbridas (20 híbrida, 0 léxica) y `F3_CIERRE_REPORT.md` decidió no citarlo. El guion lo marca como cifra de una primera corrida no versionada y propone correr `npm run eval:citas` sin el servicio de embeddings para versionarla.
2. **Lámina 4, «nace un par de preferencia».** Una aprobación limpia crea un par con `rechazada` nula (origen `aprobacion`), que no es un par DPO. El guion lo aclara.
3. **Por qué las fechas no se movieron con el DPO** y **DPO frente a SFT**: el guion las presenta como hipótesis. No hay control SFT ni diagnóstico de fechas en el repositorio.
4. **Ley 1581 de 2012** (contexto de datos personales en Colombia), **Cormack et al. 2009 para k = 60 en RRF**, y los detalles teóricos de HNSW, NF4, DPO y A2A son conocimiento general y no salen del informe; se redactaron sin parámetros de versión inventados. El ejemplo de LoRA (d = k = 1 024) está marcado como ilustrativo.
5. **PDF del curso**: no se pudo renderizar con `pdftoppm`; se leyó el texto con `pypdf` (primeras páginas) y se usó el resumen de objetivos de la solicitud para la rúbrica.
6. **La demo en modo léxico**: la corrida verificada del 12 de octubre no tenía el servicio de embeddings, así que no hay evidencia de la demo en modo híbrido en esta máquina; el runbook lo dice.
7. El SQL de reseteo del runbook **no se ejecutó** contra la base (la base no estaba disponible desde este worktree); está escrito contra el esquema de `db/migrations/0003_gobernanza.sql` y delimita el borrado por `orden_texto NOT LIKE '[simulador%'`.
