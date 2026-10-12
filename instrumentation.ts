export async function register(): Promise<void> {
  // Los imports deben quedar dentro de esta rama: Next reemplaza NEXT_RUNTIME
  // al compilar, así el paquete edge los descarta en vez de intentar resolver
  // módulos exclusivos de Node (grpc, stream) que trae el SDK de OpenTelemetry.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { afirmarSinEscrituraDirecta } = await import("./lib/guardrails/escritura");
    afirmarSinEscrituraDirecta();
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return;
    }
    const { iniciarTelemetria } = await import("./lib/observabilidad/otel");
    iniciarTelemetria();
  }
}
