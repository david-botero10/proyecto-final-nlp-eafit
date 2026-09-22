export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }
  const { afirmarSinEscrituraDirecta } = await import("./lib/guardrails/escritura");
  afirmarSinEscrituraDirecta();
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }
  const { iniciarTelemetria } = await import("./lib/observabilidad/otel");
  iniciarTelemetria();
}
