import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@opentelemetry/sdk-node",
    "@opentelemetry/sdk-trace-base",
    "@opentelemetry/exporter-trace-otlp-http",
    "@opentelemetry/resources",
    "@opentelemetry/core",
    "@opentelemetry/exporter-trace-otlp-proto",
    "@opentelemetry/otlp-grpc-exporter-base",
    "@grpc/grpc-js",
  ],
};

export default nextConfig;
