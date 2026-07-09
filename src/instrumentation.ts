import * as dotenv from "dotenv";
import { Logger } from "@nestjs/common";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

dotenv.config();

const logger = new Logger("Langfuse");
const hasLangfuseCredentials =
  !!process.env.LANGFUSE_PUBLIC_KEY && !!process.env.LANGFUSE_SECRET_KEY;
const langfuseBaseUrl =
  process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com";
let langfuseSdk: NodeSDK | null = null;
let shutdownPromise: Promise<void> | null = null;

function isLangfuseDebugEnabled() {
  return (
    process.env.LANGFUSE_LOG_LEVEL?.toUpperCase() === "DEBUG" ||
    process.env.LANGFUSE_DEBUG?.toLowerCase() === "true"
  );
}

if (hasLangfuseCredentials) {
  langfuseSdk = new NodeSDK({
    spanProcessors: [
      new LangfuseSpanProcessor({
        baseUrl: langfuseBaseUrl,
      }),
    ],
  });

  void langfuseSdk.start();
}

logger.log(
  `tracing ${hasLangfuseCredentials ? "enabled" : "disabled"} baseUrl=${langfuseBaseUrl}`,
);
if (hasLangfuseCredentials && isLangfuseDebugEnabled()) {
  logger.debug("debug exporter logging requested by environment");
}

export async function shutdownLangfuseTracing() {
  if (!langfuseSdk) return;
  if (!shutdownPromise) {
    shutdownPromise = langfuseSdk
      .shutdown()
      .then(() => {
        if (isLangfuseDebugEnabled()) {
          logger.debug("tracing shutdown completed");
        }
      })
      .catch((error) => {
        logger.warn("tracing shutdown failed", error?.stack || error);
      });
  }

  await shutdownPromise;
}
