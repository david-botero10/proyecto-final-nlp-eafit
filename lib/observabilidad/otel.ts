import { diag, DiagLogLevel, type DiagLogger } from "@opentelemetry/api";
import { ExportResultCode, type ExportResult } from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  BatchSpanProcessor,
  type ReadableSpan,
  type SpanExporter,
} from "@opentelemetry/sdk-trace-base";

const ENDPOINT_POR_DEFECTO = "http://localhost:6006/v1/traces";

// Phoenix rechaza OTLP/HTTP en JSON (415). El mismo endpoint acepta protobuf.

const silencio: DiagLogger = {
  error() {},
  warn() {},
  info() {},
  debug() {},
  verbose() {},
};

/**
 * El exportador OTLP avisa por diag cuando Phoenix no está.
 * Esas avisos no deben salir en cada request.
 */
function silenciarDiagnostico(): void {
  diag.setLogger(silencio, DiagLogLevel.NONE);
}

class ExportadorSilencioso implements SpanExporter {
  constructor(private readonly interno: SpanExporter) {}

  export(
    spans: ReadableSpan[],
    callback: (resultado: ExportResult) => void,
  ): void {
    try {
      this.interno.export(spans, () => {
        callback({ code: ExportResultCode.SUCCESS });
      });
    } catch {
      callback({ code: ExportResultCode.SUCCESS });
    }
  }

  shutdown(): Promise<void> {
    return this.interno.shutdown().catch(() => undefined);
  }

  forceFlush(): Promise<void> {
    if (!this.interno.forceFlush) {
      return Promise.resolve();
    }
    return this.interno.forceFlush().catch(() => undefined);
  }
}

let sdk: NodeSDK | null = null;

/** Registra el SDK una sola vez. Si Phoenix no responde, el proceso sigue. */
export function iniciarTelemetria(): void {
  if (sdk) {
    return;
  }
  silenciarDiagnostico();
  const endpoint =
    process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim() || ENDPOINT_POR_DEFECTO;
  const servicio = process.env.OTEL_SERVICE_NAME?.trim() || "relevo";
  const exportador = new ExportadorSilencioso(
    new OTLPTraceExporter({ url: endpoint }),
  );
  sdk = new NodeSDK({
    serviceName: servicio,
    instrumentations: [],
    spanProcessors: [
      new BatchSpanProcessor(exportador, { scheduledDelayMillis: 1000 }),
    ],
  });
  sdk.start();
}
