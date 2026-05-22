import { Injectable, Logger } from "@nestjs/common";
import { CallbackHandler } from "@langfuse/langchain";
import {
  LangfuseAgent,
  propagateAttributes,
  startActiveObservation,
  startObservation,
} from "@langfuse/tracing";

export const AI_CHAT_RUN_OBSERVATION = "ai-chat-run";

type ChatTraceInput = {
  workflow: "message" | "stream" | "notebook-action";
  userId: string;
  sessionId: string;
  input: unknown;
};

type ChatTraceHandle = {
  finish: (output: unknown) => void;
  fail: (error: unknown, output?: unknown) => void;
};

const NOOP_TRACE_HANDLE: ChatTraceHandle = {
  finish: () => undefined,
  fail: () => undefined,
};

@Injectable()
export class AiLangfuseTracingService {
  private readonly logger = new Logger(AiLangfuseTracingService.name);

  private isConfigured() {
    return !!process.env.LANGFUSE_PUBLIC_KEY && !!process.env.LANGFUSE_SECRET_KEY;
  }

  createLangChainCallbacks({
    userId,
    sessionId,
    workflow,
  }: Omit<ChatTraceInput, "input">) {
    if (!this.isConfigured()) return [];

    return [
      new CallbackHandler({
        userId,
        sessionId,
        tags: ["ai-chat", workflow],
        traceMetadata: {
          feature: "ai-chat",
          workflow,
        },
      }),
    ];
  }

  async runChatObservation<T>(
    traceInput: ChatTraceInput,
    work: () => Promise<T>,
    formatOutput: (result: T) => unknown = (result) => result,
  ) {
    if (!this.isConfigured()) {
      return work();
    }

    this.debugTrace("start", traceInput);
    return startActiveObservation(
      AI_CHAT_RUN_OBSERVATION,
      async (observation) => {
        observation.update({
          input: traceInput.input,
          metadata: {
            feature: "ai-chat",
            workflow: traceInput.workflow,
          },
        });
        observation.setTraceIO({ input: traceInput.input });

        return propagateAttributes(
          this.getTraceAttributes(traceInput),
          async () => {
            try {
              const result = await work();
              const output = formatOutput(result);
              observation.update({ output });
              observation.setTraceIO({ output });
              this.debugTrace("finish", traceInput);
              return result;
            } catch (error: any) {
              observation.update({
                level: "ERROR",
                statusMessage: error?.message || "AI chat run failed",
              });
              this.debugTrace("fail", traceInput, error);
              throw error;
            }
          },
        );
      },
      { asType: "agent" },
    );
  }

  startChatObservation(traceInput: ChatTraceInput): ChatTraceHandle {
    if (!this.isConfigured()) {
      return NOOP_TRACE_HANDLE;
    }

    const observation = propagateAttributes(
      this.getTraceAttributes(traceInput),
      () =>
        startObservation(
          AI_CHAT_RUN_OBSERVATION,
          {
            input: traceInput.input,
            metadata: {
              feature: "ai-chat",
              workflow: traceInput.workflow,
            },
          },
          { asType: "agent" },
        ),
    );
    observation.setTraceIO({ input: traceInput.input });
    this.debugTrace("start", traceInput);

    return this.createTraceHandle(observation, traceInput);
  }

  private getTraceAttributes(traceInput: ChatTraceInput) {
    return {
      traceName: AI_CHAT_RUN_OBSERVATION,
      userId: traceInput.userId,
      sessionId: traceInput.sessionId,
      tags: ["ai-chat", traceInput.workflow],
      metadata: {
        feature: "ai-chat",
        workflow: traceInput.workflow,
      },
    };
  }

  private createTraceHandle(
    observation: LangfuseAgent,
    traceInput: ChatTraceInput,
  ): ChatTraceHandle {
    let ended = false;

    const finish = (output: unknown) => {
      if (ended) return;
      observation.update({ output });
      observation.setTraceIO({ output });
      observation.end();
      ended = true;
      this.debugTrace("finish", traceInput);
    };

    return {
      finish,
      fail: (error: any, output?: unknown) => {
        if (ended) return;
        observation.update({
          ...(output !== undefined ? { output } : {}),
          level: "ERROR",
          statusMessage: error?.message || "AI chat run failed",
        });
        if (output !== undefined) {
          observation.setTraceIO({ output });
        }
        observation.end();
        ended = true;
        this.debugTrace("fail", traceInput, error);
      },
    };
  }

  private debugTrace(
    event: "start" | "finish" | "fail",
    traceInput: ChatTraceInput,
    error?: unknown,
  ) {
    if (!this.isDebugEnabled()) return;

    const errorMessage =
      error instanceof Error ? ` error=${error.message}` : "";
    this.logger.debug(
      `Langfuse root ${event} workflow=${traceInput.workflow} sessionId=${traceInput.sessionId}${errorMessage}`,
    );
  }

  private isDebugEnabled() {
    return (
      process.env.LANGFUSE_LOG_LEVEL?.toUpperCase() === "DEBUG" ||
      process.env.LANGFUSE_DEBUG?.toLowerCase() === "true"
    );
  }
}
