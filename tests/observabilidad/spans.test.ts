/** @vitest-environment node */
import { trace } from "@opentelemetry/api";
import {
  OpenInferenceSpanKind,
  SemanticConventions,
} from "@arizeai/openinference-semantic-conventions";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { responderConAsistente } from "@/lib/agente/asistente";
import {
  atributosTurno,
  conSpan,
  trazarLlamada,
} from "@/lib/observabilidad/spans";

const exporter = new InMemorySpanExporter();
const provider = new BasicTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(exporter)],
});

beforeAll(() => {
  trace.setGlobalTracerProvider(provider);
});

afterAll(async () => {
  await provider.shutdown();
});

beforeEach(() => {
  exporter.reset();
});

describe("spans de un turno", () => {
  it("un turno simulado lleva los atributos del agente", async () => {
    const respuesta = await responderConAsistente(
      {
        messages: [
          {
            role: "user",
            parts: [{ type: "text", text: "¿cuánto es el recargo nocturno?" }],
          },
        ],
      },
      "¿cuánto es el recargo nocturno?",
      {
        usuario: "gerencia",
        conversacionId: "11111111-1111-4111-8111-111111111111",
        clasificar: async () => ({
          intencion: "consulta_norma",
          confianza: 0.91,
          razon: "Pregunta por la norma.",
        }),
        completarTexto: async () => "La jornada depende del sector.",
      },
    );

    expect(respuesta.status).toBe(200);
    const texto = await respuesta.text();
    expect(texto).toContain("Esta respuesta no cita la norma; verifícala");

    const turno = exporter
      .getFinishedSpans()
      .find((span) => span.name === "relevo.turno");
    expect(turno).toBeDefined();
    expect(turno?.attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe(
      OpenInferenceSpanKind.AGENT,
    );
    expect(turno?.attributes.conversacion_id).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(turno?.attributes.usuario).toBe("gerencia");
    expect(turno?.attributes.intencion).toBe("consulta_norma");
    expect(turno?.attributes.confianza).toBe(0.91);
    expect(turno?.attributes["guardrail.citas"]).toBe(false);
    expect(String(turno?.attributes[SemanticConventions.INPUT_VALUE])).toContain(
      "recargo",
    );

    const router = exporter
      .getFinishedSpans()
      .find((span) => span.name === "relevo.router");
    expect(router?.attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe(
      OpenInferenceSpanKind.LLM,
    );
    expect(router?.attributes[SemanticConventions.LLM_MODEL_NAME]).toBeTruthy();
  });

  it("buscar_norma es RETRIEVER con modo y k", async () => {
    await trazarLlamada(
      "buscar_norma",
      { consulta: "jornada", k: 4 },
      async (span) => {
        span.setAttribute("modo", "lexica");
        return { modo: "lexica" };
      },
    );

    const span = exporter
      .getFinishedSpans()
      .find((item) => item.name === "relevo.tool.buscar_norma");
    expect(span?.attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe(
      OpenInferenceSpanKind.RETRIEVER,
    );
    expect(span?.attributes.k).toBe(4);
    expect(span?.attributes.modo).toBe("lexica");
    expect(String(span?.attributes[SemanticConventions.INPUT_VALUE])).toContain(
      "jornada",
    );
  });

  it("una tool de datos queda como TOOL", async () => {
    await conSpan(
      "relevo.turno",
      atributosTurno({
        conversacionId: null,
        usuario: "anonimo",
        intencion: "consulta_datos",
        confianza: 0.5,
        entrada: "quién trabaja",
      }),
      async (span) => {
        span.setAttribute(SemanticConventions.OUTPUT_VALUE, "lista");
        return trazarLlamada("listar_empleados", { activo: true }, async () => ({
          empleados: [],
        }));
      },
    );

    const tool = exporter
      .getFinishedSpans()
      .find((span) => span.name === "relevo.tool.listar_empleados");
    expect(tool?.attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND]).toBe(
      OpenInferenceSpanKind.TOOL,
    );
  });
});
