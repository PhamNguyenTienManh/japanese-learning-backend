import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Model, Types } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";
import {
  AIChatSession,
  ChatMessage,
  ChatMessageAction,
} from "./schemas/ai_chat_sessions.schema";
import { AIChatDailyUsage } from "./schemas/ai_chat_daily_usage.schema";
import {
  ConfirmNotebookAddDto,
  ConfirmNotebookCreateDto,
  CreateMessageDto,
} from "./dto/ai-chat.dto";
import { ChatAgent } from "../ai/agent/chat.agent";
import { AiLangfuseTracingService } from "../ai/service/ai-langfuse-tracing.service";
import { MAX_NOTEBOOK_ITEMS_PER_ACTION } from "../ai/tools/notebookTools";

const DAILY_AI_LIMIT = 50;
const DAILY_AI_LIMIT_CODE = "DAILY_AI_LIMIT_EXCEEDED";
const HANOI_TIMEZONE = "Asia/Ho_Chi_Minh";

const NOTEBOOK_TOOL_NAMES = new Set([
  "create_notebook",
  "create_named_notebook",
  "search_notebook_by_name",
  "add_notebook_items",
  "list_user_notebooks",
  "get_notebook_items",
]);

function buildNotebookActions(
  toolName: string,
  output: any,
): ChatMessageAction[] {
  if (!output || typeof output !== "object") return [];
  if (output.success !== true) return [];

  if (
    (toolName === "create_notebook" || toolName === "create_named_notebook") &&
    output.needsLimitConfirmation
  ) {
    return [
      {
        type: "confirm_create_limited_notebook",
        label: `Tạo ${output.limitedCount || 30} từ vựng`,
        notebookName: output.notebookName,
        prompt: output.prompt,
        requestedCount:
          typeof output.requestedCount === "number"
            ? output.requestedCount
            : undefined,
        limitedCount:
          typeof output.limitedCount === "number"
            ? output.limitedCount
            : undefined,
      },
    ];
  }

  if (toolName === "search_notebook_by_name") {
    const prompt =
      typeof output.addPrompt === "string" ? output.addPrompt.trim() : "";
    if (!prompt) return [];

    if (output.autoConfirmed) return [];

    if (
      output.needsAddLimitConfirmation &&
      output.bestCandidate?.id &&
      output.limitedPrompt
    ) {
      return [
        {
          type: "confirm_add_limited_to_notebook",
          label: `Thêm ${output.limitedCount || 30} từ vựng`,
          notebookId: String(output.bestCandidate.id),
          notebookName: output.bestCandidate.name,
          prompt: String(output.limitedPrompt),
          requestedCount:
            typeof output.requestedCount === "number"
              ? output.requestedCount
              : undefined,
          limitedCount:
            typeof output.limitedCount === "number"
              ? output.limitedCount
              : undefined,
        },
      ];
    }

    const candidates = Array.isArray(output.candidates)
      ? output.candidates
          .filter((candidate: any) => candidate?.id && candidate?.name)
          .slice(0, 10)
          .map((candidate: any) => ({
            id: String(candidate.id),
            name: String(candidate.name),
            score:
              typeof candidate.score === "number" ? candidate.score : undefined,
          }))
      : [];

    if (output.needsConfirmation && output.bestCandidate?.id) {
      return [
        {
          type: "confirm_add_to_notebook",
          label: `Có, thêm vào "${output.bestCandidate.name}"`,
          notebookId: String(output.bestCandidate.id),
          notebookName: output.bestCandidate.name,
          prompt,
          candidates,
        },
      ];
    }

    if (candidates.length > 0) {
      return [
        {
          type: "select_notebook_for_add",
          label: output.noMatch
            ? "Chọn một sổ tay để thêm"
            : "Chọn sổ tay phù hợp",
          prompt,
          candidates,
        },
      ];
    }

    return [];
  }

  // list_user_notebooks: 1 action cho mỗi sổ
  if (toolName === "list_user_notebooks" && Array.isArray(output.notebooks)) {
    return output.notebooks
      .filter((nb: any) => nb && nb.id)
      .map((nb: any) => ({
        type: "view_notebook" as const,
        label: nb.name ? `Mở "${nb.name}"` : "Mở sổ tay",
        notebookId: String(nb.id),
        notebookName: nb.name,
      }));
  }

  // Còn lại: 1 action duy nhất khi output có notebookId
  const notebookId = output.notebookId;
  if (!notebookId) return [];

  let label = "Xem sổ tay đã tạo";
  if (toolName === "add_notebook_items") label = "Xem sổ tay đã cập nhật";
  else if (toolName === "get_notebook_items") label = "Mở sổ tay";

  return [
    {
      type: "view_notebook",
      label,
      notebookId: String(notebookId),
      notebookName: output.notebookName,
    },
  ];
}

function isNotebookChoiceResolvedByAdd(
  action: ChatMessageAction,
  updatedNotebookIds: Set<string>,
) {
  if (
    action.type !== "confirm_add_to_notebook" &&
    action.type !== "select_notebook_for_add" &&
    action.type !== "confirm_add_limited_to_notebook"
  ) {
    return false;
  }

  if (action.notebookId && updatedNotebookIds.has(action.notebookId)) {
    return true;
  }

  return (
    Array.isArray(action.candidates) &&
    action.candidates.some((candidate) => updatedNotebookIds.has(candidate.id))
  );
}

function mergeNotebookActions(
  currentActions: ChatMessageAction[],
  toolName: string,
  newActions: ChatMessageAction[],
) {
  if (toolName === "add_notebook_items") {
    const updatedNotebookIds = new Set(
      newActions
        .filter(
          (action) => action.type === "view_notebook" && action.notebookId,
        )
        .map((action) => action.notebookId as string),
    );

    if (updatedNotebookIds.size > 0) {
      for (let index = currentActions.length - 1; index >= 0; index -= 1) {
        if (
          isNotebookChoiceResolvedByAdd(
            currentActions[index],
            updatedNotebookIds,
          )
        ) {
          currentActions.splice(index, 1);
        }
      }
    }
  }

  if (toolName === "create_notebook" || toolName === "create_named_notebook") {
    const createdNotebookNames = new Set(
      newActions
        .filter(
          (action) =>
            action.type === "view_notebook" && action.notebookName,
        )
        .map((action) => action.notebookName as string),
    );

    if (createdNotebookNames.size > 0) {
      for (let index = currentActions.length - 1; index >= 0; index -= 1) {
        const action = currentActions[index];
        if (
          action.type === "confirm_create_limited_notebook" &&
          action.notebookName &&
          createdNotebookNames.has(action.notebookName)
        ) {
          currentActions.splice(index, 1);
        }
      }
    }
  }

  const addedActions: ChatMessageAction[] = [];

  for (const action of newActions) {
    const exists = currentActions.some(
      (currentAction) =>
        currentAction.notebookId === action.notebookId &&
        currentAction.type === action.type,
    );

    if (!exists) {
      currentActions.push(action);
      addedActions.push(action);
    }
  }

  return addedActions;
}

function shouldStreamNotebookAction(action: ChatMessageAction) {
  return (
    action.type !== "confirm_add_to_notebook" &&
    action.type !== "select_notebook_for_add" &&
    action.type !== "confirm_add_limited_to_notebook" &&
    action.type !== "confirm_create_limited_notebook"
  );
}

function isPendingNotebookAction(action: ChatMessageAction) {
  return !shouldStreamNotebookAction(action);
}

function normalizeActionReply(value: string) {
  return (value || "")
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAffirmativeActionReply(value: string) {
  const normalized = normalizeActionReply(value);
  if (!normalized) return false;

  return [
    "ok",
    "oke",
    "okay",
    "yes",
    "co",
    "co nhe",
    "co ban",
    "dong y",
    "duoc",
    "duoc nhe",
    "xac nhan",
    "chap nhan",
    "lam di",
    "tao di",
    "them di",
    "tiep tuc",
    "nhat tri",
    "uh",
    "u",
  ].includes(normalized);
}

function isNegativeActionReply(value: string) {
  const normalized = normalizeActionReply(value);
  if (!normalized) return false;

  return [
    "khong",
    "ko",
    "k",
    "no",
    "huy",
    "thoi",
    "khong can",
    "bo qua",
    "dung lai",
  ].includes(normalized);
}

function getLatestPendingNotebookAction(
  session: AIChatSession,
): ChatMessageAction | null {
  const messages = session.messages || [];

  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const actions = messages[messageIndex].actions || [];

    for (let actionIndex = actions.length - 1; actionIndex >= 0; actionIndex -= 1) {
      const action = actions[actionIndex];
      if (isPendingNotebookAction(action) && !action.consumed) {
        return action;
      }
    }
  }

  return null;
}

function findRequestedNotebookCountMatch(value: string): RegExpMatchArray | null {
  const text = value || "";

  return (
    text.match(
      /\b(\d{1,6})\s*(?:từ\s+vựng|tu\s+vung|từ|tu|kanji|mục|muc|items?|words?)\b/i,
    ) ||
    text.match(
      /\b(?:thêm|them|tạo|tao|sinh|generate|add|make|create)\s+(\d{1,6})\b/i,
    )
  );
}

function parseRequestedNotebookCount(value: string): number | null {
  const match = findRequestedNotebookCountMatch(value);
  if (!match) return null;

  const count = Number(match[1]);
  return Number.isFinite(count) && count > 0 ? count : null;
}

function buildLimitedNotebookPrompt(
  prompt: string,
  limit = MAX_NOTEBOOK_ITEMS_PER_ACTION,
) {
  const originalPrompt = (prompt || "").trim();
  if (!originalPrompt) return `${limit} từ vựng`;

  const countMatch = findRequestedNotebookCountMatch(originalPrompt);
  if (countMatch?.[1]) {
    return (
      originalPrompt.slice(0, countMatch.index) +
      countMatch[0].replace(countMatch[1], String(limit)) +
      originalPrompt.slice((countMatch.index || 0) + countMatch[0].length)
    );
  }

  return `${limit} từ vựng. ${originalPrompt}`;
}

function buildNotebookItemsPrompt(notebookName: string, count: number) {
  const topic = topicFromNotebookName(notebookName) || notebookName;
  return `${count} từ vựng về ${topic}`;
}

function cleanNotebookTopic(value: string) {
  return (value || "")
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .replace(/^(?:về|ve)\s+/i, "")
    .replace(/\s*(?:nhé|nhe|đi|di|cho tôi|cho mình|của tôi|của mình)\s*$/i, "")
    .replace(/[.,!?;:]+$/g, "")
    .trim();
}

function topicFromNotebookName(notebookName: string) {
  return cleanNotebookTopic(
    (notebookName || "")
      .replace(/^sổ\s*tay\s+/i, "")
      .replace(/^từ\s+vựng\s+(?:về\s+)?/i, ""),
  );
}

function buildNotebookNameFromTopic(topic: string) {
  const cleanedTopic = cleanNotebookTopic(topic);
  if (!cleanedTopic) return "Từ vựng mới";

  if (/^(?:từ\s+vựng|kanji|ngữ\s+pháp|sổ\s*tay)\b/i.test(cleanedTopic)) {
    return cleanedTopic;
  }

  return `Từ vựng về ${cleanedTopic}`;
}

function extractRequestedNotebookName(message: string) {
  const text = (message || "").replace(/\s+/g, " ").trim();

  const quoted =
    text.match(/sổ\s*tay\s+(?:tên\s*)?["“']([^"”']+)["”']/i) ||
    text.match(/(?:tên|name)\s+["“']([^"”']+)["”']/i);
  if (quoted?.[1]) return cleanNotebookTopic(quoted[1]);

  const afterNotebook = text.match(
    /sổ\s*tay\s+(.+?)(?:\s+(?:và\s+)?(?:thêm|tạo|sinh|generate|add|make|create)\b|\s+với\s+\d|\s+\d{1,6}\s*(?:từ\s+vựng|từ|kanji|mục|items?|words?)|$)/i,
  );
  if (afterNotebook?.[1]) {
    return buildNotebookNameFromTopic(afterNotebook[1]);
  }

  const topic = text.match(
    /(?:về|chủ\s*đề)\s+(.+?)(?:\s+(?:và\s+)?(?:thêm|tạo|sinh|generate|add|make|create)\b|\s+\d{1,6}\s*(?:từ\s+vựng|từ|kanji|mục|items?|words?)|$)/i,
  );
  if (topic?.[1]) {
    return buildNotebookNameFromTopic(topic[1]);
  }

  return "Từ vựng mới";
}

function parseNotebookCreateRequest(message: string) {
  const requestedCount = parseRequestedNotebookCount(message);
  if (!requestedCount) return null;

  const normalized = normalizeActionReply(message);
  const wantsNotebook = /\bso tay\b/.test(normalized);
  const wantsCreate = /\b(?:tao|lam|lap|create|make)\b/.test(normalized);
  const wantsItems =
    /\b(?:tu vung|kanji|tu|muc|item|items|word|words)\b/.test(normalized);

  if (!wantsNotebook || !wantsCreate || !wantsItems) return null;

  const notebookName = extractRequestedNotebookName(message);
  const limitedCount = Math.min(requestedCount, MAX_NOTEBOOK_ITEMS_PER_ACTION);

  return {
    notebookName,
    requestedCount,
    limitedCount,
    prompt: buildNotebookItemsPrompt(notebookName, limitedCount),
  };
}

function parseNotebookCreateLimitIntent(
  message: string,
): ChatMessageAction | null {
  const request = parseNotebookCreateRequest(message);
  if (
    !request ||
    request.requestedCount <= MAX_NOTEBOOK_ITEMS_PER_ACTION
  ) {
    return null;
  }

  return {
    type: "confirm_create_limited_notebook",
    label: `Tạo ${MAX_NOTEBOOK_ITEMS_PER_ACTION} từ vựng`,
    notebookName: request.notebookName,
    prompt: request.prompt,
    requestedCount: request.requestedCount,
    limitedCount: MAX_NOTEBOOK_ITEMS_PER_ACTION,
  };
}

function parseNotebookCreateImmediateIntent(message: string) {
  const request = parseNotebookCreateRequest(message);
  if (
    !request ||
    request.requestedCount > MAX_NOTEBOOK_ITEMS_PER_ACTION
  ) {
    return null;
  }

  return {
    notebookName: request.notebookName,
    prompt: request.prompt,
    requestedCount: request.requestedCount,
  };
}

function parsePendingCreateCountChange(
  session: AIChatSession,
  message: string,
) {
  const requestedCount = parseRequestedNotebookCount(message);
  if (
    !requestedCount ||
    requestedCount > MAX_NOTEBOOK_ITEMS_PER_ACTION
  ) {
    return null;
  }

  const normalized = normalizeActionReply(message);
  const mentionsItems =
    /\b(?:tu vung|kanji|tu|muc|item|items|word|words)\b/.test(normalized);
  if (!mentionsItems) return null;

  const pendingAction = getLatestPendingNotebookAction(session);
  const recoveredAction =
    pendingAction?.type === "confirm_create_limited_notebook"
      ? null
      : recoverCreateLimitActionFromLastAiMessage(session);
  const notebookName =
    pendingAction?.type === "confirm_create_limited_notebook"
      ? pendingAction.notebookName
      : recoveredAction?.notebookName;

  if (!notebookName) {
    return null;
  }

  return {
    notebookName,
    prompt: buildNotebookItemsPrompt(notebookName, requestedCount),
    requestedCount,
  };
}

function getLatestNotebookContext(session: AIChatSession) {
  const messages = session.messages || [];

  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const actions = messages[messageIndex].actions || [];

    for (let actionIndex = actions.length - 1; actionIndex >= 0; actionIndex -= 1) {
      const action = actions[actionIndex];
      if (action.type === "view_notebook" && action.notebookId) {
        return {
          notebookId: action.notebookId,
          notebookName: action.notebookName || "sổ tay đã chọn",
        };
      }
    }
  }

  return null;
}

function parseRecentNotebookAddIntent(
  session: AIChatSession,
  message: string,
) {
  if (parseNotebookCreateRequest(message)) return null;

  const requestedCount = parseRequestedNotebookCount(message);
  if (
    !requestedCount ||
    requestedCount > MAX_NOTEBOOK_ITEMS_PER_ACTION
  ) {
    return null;
  }

  const normalized = normalizeActionReply(message);
  const mentionsItems =
    /\b(?:tu vung|kanji|tu|muc|item|items|word|words)\b/.test(normalized);
  const addIntent =
    /\b(?:them|bo sung|add|generate|sinh)\b/.test(normalized) ||
    (/\btao\b/.test(normalized) && /\b(?:them|nua)\b/.test(normalized));

  if (!mentionsItems || !addIntent) return null;

  const notebook = getLatestNotebookContext(session);
  if (!notebook) return null;

  return {
    ...notebook,
    prompt: buildNotebookItemsPrompt(notebook.notebookName, requestedCount),
    requestedCount,
  };
}

function isNotebookMutationIntent(message: string) {
  const normalized = normalizeActionReply(message);
  return (
    normalized.includes("so tay") &&
    /\b(?:tao|lam|lap|them|create|make|add)\b/.test(normalized)
  );
}

function isNotebookPromiseWithoutTool(userMessage: string, aiMessage: string) {
  if (!isNotebookMutationIntent(userMessage)) return false;

  const normalized = normalizeActionReply(aiMessage);
  if (!normalized.includes("so tay")) return false;

  return /\b(?:minh se|toi se|dang tao|da tao|da them|se them|tao xong|them xong)\b/.test(
    normalized,
  );
}

function recoverCreateLimitActionFromLastAiMessage(
  session: AIChatSession,
): ChatMessageAction | null {
  const messages = session.messages || [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "ai" || !message.content) continue;

    const content = message.content;
    const normalized = normalizeActionReply(content);
    const nameMatch = content.match(/sổ\s*tay\s+["“']([^"”']+)["”']/i);
    if (!nameMatch?.[1]) return null;

    const notebookName = cleanNotebookTopic(nameMatch[1]);
    const looksLikeLimitQuestion =
      normalized.includes("ban co muon") &&
      normalized.includes("toi da") &&
      normalized.includes(String(MAX_NOTEBOOK_ITEMS_PER_ACTION)) &&
      normalized.includes("so tay");

    const promisedCreate =
      normalized.includes("so tay") &&
      /\b(?:se tao|dang tao|tao)\b/.test(normalized) &&
      /\b(?:tu vung|kanji|tu|muc|item|items|word|words)\b/.test(normalized);
    const requestedCount =
      parseRequestedNotebookCount(content) || MAX_NOTEBOOK_ITEMS_PER_ACTION;

    if (
      !looksLikeLimitQuestion &&
      (!promisedCreate ||
        requestedCount > MAX_NOTEBOOK_ITEMS_PER_ACTION)
    ) {
      return null;
    }

    const limitedCount = Math.min(
      requestedCount,
      MAX_NOTEBOOK_ITEMS_PER_ACTION,
    );

    return {
      type: "confirm_create_limited_notebook",
      label: `Tạo ${limitedCount} từ vựng`,
      notebookName,
      prompt: buildNotebookItemsPrompt(notebookName, limitedCount),
      requestedCount,
      limitedCount,
    };
  }

  return null;
}

@Injectable()
export class AiChatSessionsService {
  constructor(
    @InjectModel(AIChatSession.name)
    private aiChatSessionModel: Model<AIChatSession>,
    @InjectModel(AIChatDailyUsage.name)
    private aiChatDailyUsageModel: Model<AIChatDailyUsage>,
    private readonly chatAgent: ChatAgent,
    private readonly aiLangfuseTracing: AiLangfuseTracingService,
  ) {}

  private readonly logger = new Logger(AiChatSessionsService.name);

  private getUserSessionQuery(userId: string) {
    const ownerQuery =
      Types.ObjectId.isValid(userId)
        ? {
            $or: [
              { userId: new Types.ObjectId(userId) },
              { userId },
            ],
          }
        : { userId };

    return {
      ...ownerQuery,
      isDeleted: { $ne: true },
      deletedAt: null,
    };
  }

  private getContextMessages(messages: ChatMessage[]): ChatMessage[] {
    return (messages || [])
      .filter((message) => message?.content)
      .slice(-10);
  }

  private getHanoiDateKey(date = new Date()): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: HANOI_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );

    return `${values.year}-${values.month}-${values.day}`;
  }

  private getUsageUserId(userId: string) {
    return Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId;
  }

  private formatUsage(usage: any, dateKey: string) {
    const limit = DAILY_AI_LIMIT;
    const used = Math.min(Number(usage?.used || 0), limit);

    return {
      used,
      limit,
      remaining: Math.max(limit - used, 0),
      dateKey,
    };
  }

  async getTodayUsage(userId: string) {
    const dateKey = this.getHanoiDateKey();
    const usage = await this.aiChatDailyUsageModel
      .findOne({
        userId: this.getUsageUserId(userId),
        dateKey,
      })
      .lean();

    return this.formatUsage(usage, dateKey);
  }

  private async consumeTodayQuota(userId: string) {
    const dateKey = this.getHanoiDateKey();
    const usageUserId = this.getUsageUserId(userId);
    const incremented = await this.aiChatDailyUsageModel
      .findOneAndUpdate(
        {
          userId: usageUserId,
          dateKey,
          used: { $lt: DAILY_AI_LIMIT },
        },
        {
          $inc: { used: 1 },
          $set: { limit: DAILY_AI_LIMIT },
        },
        { new: true },
      )
      .lean();

    if (incremented) {
      return { allowed: true, usage: this.formatUsage(incremented, dateKey) };
    }

    const existing = await this.aiChatDailyUsageModel
      .findOne({ userId: usageUserId, dateKey })
      .lean();

    if (existing) {
      return { allowed: false, usage: this.formatUsage(existing, dateKey) };
    }

    try {
      const created = await this.aiChatDailyUsageModel.create({
        userId: usageUserId,
        dateKey,
        used: 1,
        limit: DAILY_AI_LIMIT,
      });

      return { allowed: true, usage: this.formatUsage(created, dateKey) };
    } catch {
      return this.consumeTodayQuota(userId);
    }
  }

  private buildQuotaExceededPayload(usage: any) {
    return {
      code: DAILY_AI_LIMIT_CODE,
      message:
        "Bạn đã dùng hết 50 request AI hôm nay. Quay lại vào ngày mai nhé.",
      usage,
    };
  }

  private buildTitleFromMessage(content: string): string {
    const normalized = (content || "").replace(/\s+/g, " ").trim();
    if (!normalized) return "Cuộc trò chuyện mới";
    return normalized.length > 48 ? `${normalized.slice(0, 48)}...` : normalized;
  }

  private buildNotebookAddResultMessage(result: any): string {
    const notebookName = result?.notebookName || "sổ tay đã chọn";
    const itemsCount = Number(result?.itemsCount || 0);
    const requestedCount = Number(result?.requestedCount || itemsCount);
    const addedItems = Array.isArray(result?.addedItems)
      ? result.addedItems
          .map((item: unknown) => String(item || "").trim())
          .filter(Boolean)
      : [];
    const addedItemsText =
      addedItems.length > 0
        ? `\n\nCác từ vừa thêm: ${addedItems.join(", ")}.`
        : "";

    if (itemsCount <= 0) {
      return `Mình chưa thêm được từ mới nào vào sổ tay "${notebookName}".`;
    }

    if (result?.isComplete) {
      return `Đã thêm đủ ${itemsCount}/${requestedCount} từ mới vào sổ tay "${notebookName}".${addedItemsText}`;
    }

    return `Mình chỉ thêm được ${itemsCount}/${requestedCount} từ mới vào sổ tay "${notebookName}" vì chưa sinh đủ mục không trùng.${addedItemsText}`;
  }

  private buildNotebookCreateResultMessage(result: any): string {
    const notebookName = result?.notebookName || "sổ tay mới";
    const itemsCount = Number(result?.itemsCount || 0);
    const requestedCount = Number(result?.requestedCount || itemsCount);

    if (result?.isEmptyNotebook) {
      return `Đã tạo sổ tay "${notebookName}". Bạn muốn thêm từ vựng gì vào sổ tay này?`;
    }

    if (itemsCount <= 0) {
      return `Mình chưa tạo được từ vựng nào cho sổ tay "${notebookName}".`;
    }

    if (result?.isComplete) {
      return `Đã tạo sổ tay "${notebookName}" với đủ ${itemsCount}/${requestedCount} từ vựng.`;
    }

    return `Đã tạo sổ tay "${notebookName}" với ${itemsCount}/${requestedCount} từ vựng.`;
  }

  private buildPendingNotebookActionMessage(
    actions: ChatMessageAction[],
    fallback: string,
  ) {
    const confirmAdd = actions.find(
      (action) => action.type === "confirm_add_to_notebook",
    );
    if (confirmAdd?.notebookName) {
      return `Ý bạn có phải là sổ tay "${confirmAdd.notebookName}" không?`;
    }

    const selectNotebook = actions.find(
      (action) => action.type === "select_notebook_for_add",
    );
    if (selectNotebook) {
      return "Mình chưa chắc sổ tay nào là đúng. Bạn chọn sổ tay muốn thêm từ nhé.";
    }

    const confirmAddLimited = actions.find(
      (action) => action.type === "confirm_add_limited_to_notebook",
    );
    if (confirmAddLimited) {
      const limitedCount = confirmAddLimited.limitedCount || 30;
      return `Mỗi lần mình chỉ có thể thêm tối đa ${limitedCount} từ vựng. Bạn có muốn mình thêm ${limitedCount} từ vựng${confirmAddLimited.notebookName ? ` vào sổ tay "${confirmAddLimited.notebookName}"` : ""} không?`;
    }

    const confirmCreate = actions.find(
      (action) => action.type === "confirm_create_limited_notebook",
    );
    if (confirmCreate) {
      const limitedCount = confirmCreate.limitedCount || 30;
      return `Mỗi lần mình chỉ có thể tạo tối đa ${limitedCount} từ vựng. Bạn có muốn mình tạo ${limitedCount} từ vựng${confirmCreate.notebookName ? ` cho sổ tay "${confirmCreate.notebookName}"` : ""} không?`;
    }

    return fallback;
  }

  private async appendNotebookCreateLimitConfirmation(
    session: AIChatSession,
    content: string,
    action: ChatMessageAction,
  ) {
    this.dismissPendingNotebookActions(session);

    const userMsg: ChatMessage = {
      role: "user",
      content,
      timestamp: new Date(),
    };
    const aiMsg: ChatMessage = {
      role: "ai",
      content: this.buildPendingNotebookActionMessage([action], ""),
      timestamp: new Date(),
      actions: [action],
    };

    session.messages.push(userMsg);
    session.messages.push(aiMsg);
    if (!session.title || session.title === "Cuộc trò chuyện mới") {
      session.title = this.buildTitleFromMessage(content);
    }
    await session.save();

    return {
      sessionId: session._id,
      userMessage: userMsg,
      aiMessage: aiMsg,
    };
  }

  private async createNotebookFromParsedRequest(
    session: AIChatSession,
    content: string,
    userId: string,
    request: {
      notebookName: string;
      prompt: string;
      requestedCount: number;
    },
  ) {
    this.dismissPendingNotebookActions(session);

    const result = await this.aiLangfuseTracing.runChatObservation(
      {
        workflow: "notebook-action",
        userId,
        sessionId: String(session._id),
        input: {
          notebookName: request.notebookName,
          prompt: request.prompt,
        },
      },
      () =>
        this.chatAgent.createNotebookFromAction(
          userId,
          request.notebookName,
          request.prompt,
        ),
      (response) => ({
        notebookId: response?.notebookId,
        notebookName: response?.notebookName,
        itemsCount: response?.itemsCount,
        requestedCount: response?.requestedCount,
        success: response?.success,
      }),
    );

    const notebookName = result?.notebookName || request.notebookName;
    const userMsg: ChatMessage = {
      role: "user",
      content,
      timestamp: new Date(),
    };
    const aiMsg: ChatMessage = {
      role: "ai",
      content: this.buildNotebookCreateResultMessage(result),
      timestamp: new Date(),
      actions: this.buildNotebookViewActions(
        "Xem sổ tay đã tạo",
        result,
        true,
      ),
    };

    session.messages.push(userMsg);
    session.messages.push(aiMsg);
    if (!session.title || session.title === "Cuộc trò chuyện mới") {
      session.title = this.buildTitleFromMessage(content);
    }
    await session.save();

    return {
      sessionId: session._id,
      userMessage: userMsg,
      aiMessage: aiMsg,
      result: {
        ...result,
        notebookName,
      },
    };
  }

  private async addNotebookItemsFromParsedRequest(
    session: AIChatSession,
    content: string,
    userId: string,
    request: {
      notebookId: string;
      notebookName: string;
      prompt: string;
      requestedCount: number;
    },
  ) {
    const result = await this.aiLangfuseTracing.runChatObservation(
      {
        workflow: "notebook-action",
        userId,
        sessionId: String(session._id),
        input: {
          notebookId: request.notebookId,
          prompt: request.prompt,
        },
      },
      () =>
        this.chatAgent.addItemsToNotebook(
          userId,
          request.notebookId,
          request.prompt,
        ),
      (response) => ({
        notebookId: response?.notebookId,
        notebookName: response?.notebookName,
        itemsCount: response?.itemsCount,
        requestedCount: response?.requestedCount,
        success: response?.success,
      }),
    );

    const notebookName = result?.notebookName || request.notebookName;
    const userMsg: ChatMessage = {
      role: "user",
      content,
      timestamp: new Date(),
    };
    const aiMsg: ChatMessage = {
      role: "ai",
      content: this.buildNotebookAddResultMessage({
        ...result,
        notebookName,
      }),
      timestamp: new Date(),
      actions: this.buildNotebookViewActions(
        "Xem sổ tay đã cập nhật",
        {
          ...result,
          notebookId: request.notebookId,
          notebookName,
        },
        false,
      ),
    };

    session.messages.push(userMsg);
    session.messages.push(aiMsg);
    await session.save();

    return {
      sessionId: session._id,
      userMessage: userMsg,
      aiMessage: aiMsg,
      result: {
        ...result,
        notebookId: request.notebookId,
        notebookName,
      },
    };
  }

  private consumeNotebookChoiceActions(
    session: AIChatSession,
    prompt: string,
    notebookId: string,
  ) {
    const normalizedPrompt = (prompt || "").trim();

    for (const message of session.messages || []) {
      if (!Array.isArray(message.actions)) continue;

      message.actions = message.actions.map((action) => {
        if (
          action.type !== "confirm_add_to_notebook" &&
          action.type !== "select_notebook_for_add" &&
          action.type !== "confirm_add_limited_to_notebook"
        ) {
          return action;
        }

        const samePrompt = (action.prompt || "").trim() === normalizedPrompt;
        const sameNotebook =
          action.notebookId === notebookId ||
          (Array.isArray(action.candidates) &&
            action.candidates.some((candidate) => candidate.id === notebookId));

        return samePrompt && sameNotebook
          ? { ...action, consumed: true }
          : action;
      });
    }
  }

  private consumeNotebookCreateActions(
    session: AIChatSession,
    prompt: string,
    notebookName: string,
  ) {
    const normalizedPrompt = (prompt || "").trim();
    const normalizedName = (notebookName || "").trim();

    for (const message of session.messages || []) {
      if (!Array.isArray(message.actions)) continue;

      message.actions = message.actions.map((action) => {
        if (action.type !== "confirm_create_limited_notebook") {
          return action;
        }

        const samePrompt = (action.prompt || "").trim() === normalizedPrompt;
        const sameNotebookName =
          (action.notebookName || "").trim() === normalizedName;

        return samePrompt && sameNotebookName
          ? { ...action, consumed: true }
          : action;
      });
    }
  }

  private dismissPendingNotebookActions(session: AIChatSession) {
    let changed = false;

    for (const message of session.messages || []) {
      if (!Array.isArray(message.actions)) continue;

      message.actions = message.actions.map((action) => {
        if (!isPendingNotebookAction(action) || action.consumed) {
          return action;
        }

        changed = true;
        return { ...action, consumed: true };
      });
    }

    if (changed) {
      session.markModified("messages");
    }
  }

  private consumeSpecificPendingAction(
    session: AIChatSession,
    targetAction: ChatMessageAction,
  ) {
    let changed = false;

    for (const message of session.messages || []) {
      if (!Array.isArray(message.actions)) continue;

      message.actions = message.actions.map((action) => {
        const sameAction =
          action.type === targetAction.type &&
          (action.notebookId || "") === (targetAction.notebookId || "") &&
          (action.notebookName || "") === (targetAction.notebookName || "") &&
          (action.prompt || "") === (targetAction.prompt || "");

        if (!sameAction || action.consumed) return action;

        changed = true;
        return { ...action, consumed: true };
      });
    }

    if (changed) {
      session.markModified("messages");
    }
  }

  private buildNotebookViewActions(
    label: string,
    result: any,
    includeWhenEmpty = true,
  ): ChatMessageAction[] {
    const notebookId = result?.notebookId;
    const itemsCount = Number(result?.itemsCount || 0);

    if (!notebookId || (!includeWhenEmpty && itemsCount <= 0)) return [];

    return [
      {
        type: "view_notebook",
        label,
        notebookId: String(notebookId),
        notebookName: result?.notebookName,
      },
    ];
  }

  private buildPendingSelectionReminder(
    action: ChatMessageAction,
  ): ChatMessageAction[] {
    if (
      action.type !== "select_notebook_for_add" ||
      !Array.isArray(action.candidates) ||
      action.candidates.length === 0
    ) {
      return [];
    }

    return [{ ...action }];
  }

  private async handlePendingNotebookActionReply(
    session: AIChatSession,
    content: string,
    userId: string,
  ) {
    const isConfirmed = isAffirmativeActionReply(content);
    const isDeclined = isNegativeActionReply(content);
    if (!isConfirmed && !isDeclined) return null;

    const pendingAction =
      getLatestPendingNotebookAction(session) ||
      (isConfirmed ? recoverCreateLimitActionFromLastAiMessage(session) : null);
    if (!pendingAction) return null;

    const usage = await this.getTodayUsage(userId);
    const userMsg: ChatMessage = {
      role: "user",
      content,
      timestamp: new Date(),
    };

    if (isDeclined) {
      this.consumeSpecificPendingAction(session, pendingAction);

      const aiMsg: ChatMessage = {
        role: "ai",
        content: "Được rồi, mình sẽ không thực hiện thao tác này.",
        timestamp: new Date(),
        actions: [],
      };

      session.messages.push(userMsg);
      session.messages.push(aiMsg);
      await session.save();

      return {
        sessionId: session._id,
        userMessage: userMsg,
        aiMessage: aiMsg,
        usage,
      };
    }

    if (pendingAction.type === "select_notebook_for_add") {
      const reminderActions = this.buildPendingSelectionReminder(pendingAction);
      this.consumeSpecificPendingAction(session, pendingAction);

      const aiMsg: ChatMessage = {
        role: "ai",
        content:
          "Mình cần bạn chọn một sổ tay cụ thể trong danh sách trước khi thêm từ nhé.",
        timestamp: new Date(),
        actions: reminderActions,
      };

      session.messages.push(userMsg);
      session.messages.push(aiMsg);
      await session.save();

      return {
        sessionId: session._id,
        userMessage: userMsg,
        aiMessage: aiMsg,
        usage,
      };
    }

    if (
      (pendingAction.type === "confirm_add_to_notebook" ||
        pendingAction.type === "confirm_add_limited_to_notebook") &&
      pendingAction.notebookId &&
      pendingAction.prompt
    ) {
      const result = await this.aiLangfuseTracing.runChatObservation(
        {
          workflow: "notebook-action",
          userId,
          sessionId: String(session._id),
          input: {
            notebookId: pendingAction.notebookId,
            prompt: pendingAction.prompt,
          },
        },
        () =>
          this.chatAgent.addItemsToNotebook(
            userId,
            pendingAction.notebookId as string,
            pendingAction.prompt as string,
          ),
        (response) => ({
          notebookId: response?.notebookId,
          notebookName: response?.notebookName,
          itemsCount: response?.itemsCount,
          requestedCount: response?.requestedCount,
          success: response?.success,
        }),
      );

      this.consumeNotebookChoiceActions(
        session,
        pendingAction.prompt,
        pendingAction.notebookId,
      );
      session.markModified("messages");

      const aiMsg: ChatMessage = {
        role: "ai",
        content: this.buildNotebookAddResultMessage(result),
        timestamp: new Date(),
        actions: this.buildNotebookViewActions(
          "Xem sổ tay đã cập nhật",
          result,
          false,
        ),
      };

      session.messages.push(userMsg);
      session.messages.push(aiMsg);
      await session.save();

      return {
        sessionId: session._id,
        userMessage: userMsg,
        aiMessage: aiMsg,
        result,
        usage,
      };
    }

    if (
      pendingAction.type === "confirm_create_limited_notebook" &&
      pendingAction.notebookName &&
      pendingAction.prompt
    ) {
      const result = await this.aiLangfuseTracing.runChatObservation(
        {
          workflow: "notebook-action",
          userId,
          sessionId: String(session._id),
          input: {
            notebookName: pendingAction.notebookName,
            prompt: pendingAction.prompt,
          },
        },
        () =>
          this.chatAgent.createNotebookFromAction(
            userId,
            pendingAction.notebookName as string,
            pendingAction.prompt as string,
          ),
        (response) => ({
          notebookId: response?.notebookId,
          notebookName: response?.notebookName,
          itemsCount: response?.itemsCount,
          requestedCount: response?.requestedCount,
          success: response?.success,
        }),
      );

      const notebookName = result?.notebookName || pendingAction.notebookName;
      this.consumeNotebookCreateActions(
        session,
        pendingAction.prompt,
        notebookName,
      );
      session.markModified("messages");

      const aiMsg: ChatMessage = {
        role: "ai",
        content: this.buildNotebookCreateResultMessage(result),
        timestamp: new Date(),
        actions: this.buildNotebookViewActions(
          "Xem sổ tay đã tạo",
          result,
          true,
        ),
      };

      session.messages.push(userMsg);
      session.messages.push(aiMsg);
      await session.save();

      return {
        sessionId: session._id,
        userMessage: userMsg,
        aiMessage: aiMsg,
        result,
        usage,
      };
    }

    return null;
  }

  private assertSessionOwner(session: AIChatSession, userId: string) {
    if (session.userId?.toString() !== userId) {
      throw new ForbiddenException("You do not own this session");
    }

    if (session.isDeleted || session.deletedAt) {
      throw new NotFoundException("Session not found");
    }
  }

  async createSession(userId: string) {
    return this.aiChatSessionModel.create({
      userId,
      messages: [],
      title: "Cuộc trò chuyện mới",
      isActive: true,
      isDeleted: false,
      deletedAt: null,
    });
  }

  public async sendMessage(
    sessionId: string,
    createMessageDto: { content: string },
    userId: string
  ) {
    this.logger.debug(
      `sendMessage called with sessionId=${sessionId}, userId=${userId}`
    );

    // Tìm session
    const session = await this.aiChatSessionModel.findById(sessionId);
    if (!session) throw new NotFoundException("Session not found");
    this.assertSessionOwner(session, userId);

    const pendingActionResponse = await this.handlePendingNotebookActionReply(
      session,
      createMessageDto.content,
      userId,
    );
    if (pendingActionResponse) {
      return {
        sessionId: pendingActionResponse.sessionId,
        userMessage: pendingActionResponse.userMessage.content,
        aiMessage: pendingActionResponse.aiMessage.content,
        timestamp: pendingActionResponse.aiMessage.timestamp,
        actions: pendingActionResponse.aiMessage.actions || [],
        result: pendingActionResponse.result,
        usage: pendingActionResponse.usage,
        notebookActionResolved: true,
      };
    }

    const recentNotebookAddRequest = parseRecentNotebookAddIntent(
      session,
      createMessageDto.content,
    );
    if (recentNotebookAddRequest) {
      const quota = await this.consumeTodayQuota(userId);
      if (!quota.allowed) {
        throw new HttpException(
          this.buildQuotaExceededPayload(quota.usage),
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const response = await this.addNotebookItemsFromParsedRequest(
        session,
        createMessageDto.content,
        userId,
        recentNotebookAddRequest,
      );

      return {
        sessionId: response.sessionId,
        userMessage: response.userMessage.content,
        aiMessage: response.aiMessage.content,
        timestamp: response.aiMessage.timestamp,
        actions: response.aiMessage.actions || [],
        result: response.result,
        usage: quota.usage,
        notebookActionResolved: true,
      };
    }

    const createImmediateRequest =
      parsePendingCreateCountChange(session, createMessageDto.content) ||
      parseNotebookCreateImmediateIntent(createMessageDto.content);
    if (createImmediateRequest) {
      const quota = await this.consumeTodayQuota(userId);
      if (!quota.allowed) {
        throw new HttpException(
          this.buildQuotaExceededPayload(quota.usage),
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const response = await this.createNotebookFromParsedRequest(
        session,
        createMessageDto.content,
        userId,
        createImmediateRequest,
      );

      return {
        sessionId: response.sessionId,
        userMessage: response.userMessage.content,
        aiMessage: response.aiMessage.content,
        timestamp: response.aiMessage.timestamp,
        actions: response.aiMessage.actions || [],
        result: response.result,
        usage: quota.usage,
        notebookActionResolved: true,
      };
    }

    const createLimitAction = parseNotebookCreateLimitIntent(
      createMessageDto.content,
    );
    if (createLimitAction) {
      const quota = await this.consumeTodayQuota(userId);
      if (!quota.allowed) {
        throw new HttpException(
          this.buildQuotaExceededPayload(quota.usage),
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const response = await this.appendNotebookCreateLimitConfirmation(
        session,
        createMessageDto.content,
        createLimitAction,
      );

      return {
        sessionId: response.sessionId,
        userMessage: response.userMessage.content,
        aiMessage: response.aiMessage.content,
        timestamp: response.aiMessage.timestamp,
        actions: response.aiMessage.actions || [],
        usage: quota.usage,
        notebookActionPending: true,
      };
    }

    const fastReply = this.chatAgent.getFastReply(createMessageDto.content);
    if (fastReply) {
      this.dismissPendingNotebookActions(session);

      const userMsg: ChatMessage = {
        role: "user",
        content: createMessageDto.content,
        timestamp: new Date(),
      };
      const aiMsg: ChatMessage = {
        role: "ai",
        content: fastReply,
        timestamp: new Date(),
      };

      session.messages.push(userMsg);
      session.messages.push(aiMsg);
      if (!session.title || session.title === "Cuộc trò chuyện mới") {
        session.title = this.buildTitleFromMessage(createMessageDto.content);
      }
      await session.save();

      return {
        sessionId: session._id,
        userMessage: userMsg.content,
        aiMessage: aiMsg.content,
        timestamp: aiMsg.timestamp,
        usage: await this.getTodayUsage(userId),
        fastReply: true,
      };
    }

    const quota = await this.consumeTodayQuota(userId);
    if (!quota.allowed) {
      throw new HttpException(
        this.buildQuotaExceededPayload(quota.usage),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const contextMessages = this.getContextMessages(session.messages);

    this.dismissPendingNotebookActions(session);

    // Push user message vào session
    const userMsg: ChatMessage = {
      role: "user",
      content: createMessageDto.content,
      timestamp: new Date(),
    };
    session.messages.push(userMsg);
    if (!session.title || session.title === "Cuộc trò chuyện mới") {
      session.title = this.buildTitleFromMessage(createMessageDto.content);
    }

    try {
      // GỌI CHAT AGENT
      const aiResponse = await this.aiLangfuseTracing.runChatObservation(
        {
          workflow: "message",
          userId,
          sessionId,
          input: {
            messages: [...contextMessages, userMsg],
          },
        },
        () =>
          this.chatAgent.chatReply(
            session.messages, // messages
            createMessageDto.content, // userMessage
            sessionId, // sessionId
            userId, // userId
            contextMessages,
          ),
        (response) => ({
          aiMessage: response,
        }),
      );

      // Lưu message AI
      const aiMsg: ChatMessage = {
        role: "ai",
        content: aiResponse,
        timestamp: new Date(),
      };
      session.messages.push(aiMsg);

      await session.save();

      // Trả kết quả về client
      return {
        sessionId: session._id,
        userMessage: userMsg.content,
        aiMessage: aiMsg.content,
        timestamp: new Date(),
        usage: quota.usage,
      };
    } catch (error) {
      // rollback nếu lỗi
      session.messages.pop();
      await session.save();

      this.logger.error("Failed to get AI response", error);
      throw new InternalServerErrorException("AI service unavailable");
    }
  }

  /**
   * Stream phản hồi AI dạng SSE event.
   * Yield: { type: "progress", ... }, { type: "chunk", text } cho token,
   * sau đó { type: "done", ... }.
   * Lưu cả user message và AI message vào DB ở cuối.
   */
  public async *streamMessage(
    sessionId: string,
    createMessageDto: { content: string },
    userId: string,
    signal?: AbortSignal,
  ): AsyncGenerator<Record<string, any>, void, void> {
    const session = await this.aiChatSessionModel.findById(sessionId);
    if (!session) throw new NotFoundException("Session not found");

    this.assertSessionOwner(session, userId);

    const pendingActionResponse = await this.handlePendingNotebookActionReply(
      session,
      createMessageDto.content,
      userId,
    );
    if (pendingActionResponse) {
      const aiMsg = pendingActionResponse.aiMessage;
      yield { type: "chunk", text: aiMsg.content };
      yield {
        type: "done",
        sessionId: pendingActionResponse.sessionId,
        aiMessage: aiMsg.content,
        timestamp: aiMsg.timestamp,
        actions: aiMsg.actions || [],
        result: pendingActionResponse.result,
        usage: pendingActionResponse.usage,
        notebookActionResolved: true,
      };
      return;
    }

    const recentNotebookAddRequest = parseRecentNotebookAddIntent(
      session,
      createMessageDto.content,
    );
    if (recentNotebookAddRequest) {
      const quota = await this.consumeTodayQuota(userId);
      if (!quota.allowed) {
        yield {
          type: "error",
          ...this.buildQuotaExceededPayload(quota.usage),
        };
        return;
      }

      yield {
        type: "progress",
        stage: "generate_notebook_items",
        message: `Đang tạo ${recentNotebookAddRequest.requestedCount} từ vựng mới...`,
        current: 0,
        total: recentNotebookAddRequest.requestedCount,
      };

      const response = await this.addNotebookItemsFromParsedRequest(
        session,
        createMessageDto.content,
        userId,
        recentNotebookAddRequest,
      );
      const aiMsg = response.aiMessage;

      yield { type: "chunk", text: aiMsg.content };
      yield {
        type: "done",
        sessionId: response.sessionId,
        aiMessage: aiMsg.content,
        timestamp: aiMsg.timestamp,
        actions: aiMsg.actions || [],
        result: response.result,
        usage: quota.usage,
        notebookActionResolved: true,
      };
      return;
    }

    const createImmediateRequest =
      parsePendingCreateCountChange(session, createMessageDto.content) ||
      parseNotebookCreateImmediateIntent(createMessageDto.content);
    if (createImmediateRequest) {
      const quota = await this.consumeTodayQuota(userId);
      if (!quota.allowed) {
        yield {
          type: "error",
          ...this.buildQuotaExceededPayload(quota.usage),
        };
        return;
      }

      yield {
        type: "progress",
        stage: "create_notebook",
        message: `Đang tạo sổ tay "${createImmediateRequest.notebookName}"...`,
      };
      yield {
        type: "progress",
        stage: "generate_notebook_items",
        message: `Đang tạo ${createImmediateRequest.requestedCount} từ vựng mới...`,
        current: 0,
        total: createImmediateRequest.requestedCount,
      };

      const response = await this.createNotebookFromParsedRequest(
        session,
        createMessageDto.content,
        userId,
        createImmediateRequest,
      );
      const aiMsg = response.aiMessage;

      yield { type: "chunk", text: aiMsg.content };
      yield {
        type: "done",
        sessionId: response.sessionId,
        aiMessage: aiMsg.content,
        timestamp: aiMsg.timestamp,
        actions: aiMsg.actions || [],
        result: response.result,
        usage: quota.usage,
        notebookActionResolved: true,
      };
      return;
    }

    const createLimitAction = parseNotebookCreateLimitIntent(
      createMessageDto.content,
    );
    if (createLimitAction) {
      const quota = await this.consumeTodayQuota(userId);
      if (!quota.allowed) {
        yield {
          type: "error",
          ...this.buildQuotaExceededPayload(quota.usage),
        };
        return;
      }

      const response = await this.appendNotebookCreateLimitConfirmation(
        session,
        createMessageDto.content,
        createLimitAction,
      );
      const aiMsg = response.aiMessage;

      yield { type: "chunk", text: aiMsg.content };
      yield {
        type: "done",
        sessionId: response.sessionId,
        aiMessage: aiMsg.content,
        timestamp: aiMsg.timestamp,
        actions: aiMsg.actions || [],
        usage: quota.usage,
        notebookActionPending: true,
      };
      return;
    }

    const fastReply = this.chatAgent.getFastReply(createMessageDto.content);
    if (fastReply) {
      this.dismissPendingNotebookActions(session);

      const userMsg: ChatMessage = {
        role: "user",
        content: createMessageDto.content,
        timestamp: new Date(),
      };
      const aiMsg: ChatMessage = {
        role: "ai",
        content: fastReply,
        timestamp: new Date(),
        actions: [],
      };

      session.messages.push(userMsg);
      session.messages.push(aiMsg);
      if (!session.title || session.title === "Cuộc trò chuyện mới") {
        session.title = this.buildTitleFromMessage(createMessageDto.content);
      }
      await session.save();

      yield { type: "chunk", text: fastReply };
      yield {
        type: "done",
        sessionId: session._id,
        aiMessage: aiMsg.content,
        timestamp: aiMsg.timestamp,
        actions: [],
        usage: await this.getTodayUsage(userId),
        fastReply: true,
      };
      return;
    }

    const quota = await this.consumeTodayQuota(userId);
    if (!quota.allowed) {
      yield {
        type: "error",
        ...this.buildQuotaExceededPayload(quota.usage),
      };
      return;
    }

    const contextMessages = this.getContextMessages(session.messages);

    this.dismissPendingNotebookActions(session);

    const userMsg: ChatMessage = {
      role: "user",
      content: createMessageDto.content,
      timestamp: new Date(),
    };
    session.messages.push(userMsg);
    if (!session.title || session.title === "Cuộc trò chuyện mới") {
      session.title = this.buildTitleFromMessage(createMessageDto.content);
    }

    let fullText = "";
    const actions: ChatMessageAction[] = [];
    let wasAborted = false;
    const chatTrace = this.aiLangfuseTracing.startChatObservation({
      workflow: "stream",
      userId,
      sessionId,
      input: {
        messages: [...contextMessages, userMsg],
      },
    });
    let traceEnded = false;
    const finishTrace = (output: Record<string, any>) => {
      chatTrace.finish(output);
      traceEnded = true;
    };
    const failTrace = (error: unknown, output?: Record<string, any>) => {
      chatTrace.fail(error, output);
      traceEnded = true;
    };

    try {
      yield {
        type: "progress",
        stage: "start",
        message: "Đang phân tích yêu cầu của bạn...",
      };

      for await (const evt of this.chatAgent.streamReply(
        createMessageDto.content,
        sessionId,
        userId,
        contextMessages,
        signal,
      )) {
        if (signal?.aborted) {
          wasAborted = true;
          break;
        }

        if (evt.kind === "token") {
          fullText += evt.text;
          yield { type: "chunk", text: evt.text };
        } else if (evt.kind === "progress") {
          yield {
            type: "progress",
            stage: evt.stage,
            message: evt.message,
            current: evt.current,
            total: evt.total,
          };
        } else if (
          evt.kind === "tool" &&
          NOTEBOOK_TOOL_NAMES.has(evt.toolName)
        ) {
          const newActions = buildNotebookActions(evt.toolName, evt.output);
          const addedActions = mergeNotebookActions(
            actions,
            evt.toolName,
            newActions,
          );

          for (const action of addedActions.filter(shouldStreamNotebookAction)) {
            yield { type: "action", action };
          }
        }
      }

      if (signal?.aborted) {
        wasAborted = true;
      }

      const fallbackContent =
        fullText.trim().length > 0
          ? fullText
          : wasAborted
            ? "Đã dừng phản hồi."
            : "Xin lỗi, mình chưa có phản hồi phù hợp";
      const guardedFallbackContent =
        actions.length === 0 &&
        isNotebookPromiseWithoutTool(createMessageDto.content, fallbackContent)
          ? "Mình chưa thực hiện được thao tác tạo/thêm sổ tay vì công cụ chưa chạy. Bạn hãy gửi lại yêu cầu theo dạng: tạo sổ tay [chủ đề] với [số lượng] từ vựng."
          : fallbackContent;

      const aiMsg: ChatMessage = {
        role: "ai",
        content: this.buildPendingNotebookActionMessage(
          actions,
          guardedFallbackContent,
        ),
        timestamp: new Date(),
        actions,
      };
      session.messages.push(aiMsg);
      await session.save();
      finishTrace({
        status: wasAborted ? "aborted" : "done",
        aiMessage: aiMsg.content,
        actions,
      });

      yield {
        type: wasAborted ? "aborted" : "done",
        sessionId: session._id,
        aiMessage: aiMsg.content,
        timestamp: aiMsg.timestamp,
        actions,
        usage: quota.usage,
      };
    } catch (error) {
      if (signal?.aborted) {
        if (fullText.length === 0) {
          const aiMsg: ChatMessage = {
            role: "ai",
            content: "Đã dừng phản hồi.",
            timestamp: new Date(),
            actions,
          };
          session.messages.push(aiMsg);
        } else {
          const aiMsg: ChatMessage = {
            role: "ai",
            content: fullText,
            timestamp: new Date(),
            actions,
          };
          session.messages.push(aiMsg);
        }
        await session.save();
        finishTrace({
          status: "aborted",
          aiMessage: fullText || "Đã dừng phản hồi.",
          actions,
        });
        return;
      }

      // rollback user message nếu lỗi và chưa có chunk nào được sinh
      if (fullText.length === 0) {
        session.messages.pop();
        await session.save();
      } else {
        // đã sinh được một phần, lưu phần đã có để không mất
        const aiMsg: ChatMessage = {
          role: "ai",
          content: fullText,
          timestamp: new Date(),
          actions,
        };
        session.messages.push(aiMsg);
        await session.save();
      }

      this.logger.error("Failed to stream AI response", error);
      failTrace(error, {
        status: "error",
        partialAiMessage: fullText || null,
        actions,
      });
      yield {
        type: "error",
        message: "AI service unavailable",
      };
    } finally {
      if (!traceEnded) {
        finishTrace({
          status: signal?.aborted ? "aborted" : "closed",
          partialAiMessage: fullText || null,
          actions,
        });
      }
    }
  }

  async getSessionHistory(sessionId: string, userId: string) {
    const session = await this.aiChatSessionModel.findById(sessionId);
    if (!session) throw new NotFoundException("Session not found");
    this.assertSessionOwner(session, userId);
    return session;
  }

  public async addNotebookItemsFromAction(
    sessionId: string,
    payload: ConfirmNotebookAddDto,
    userId: string,
  ) {
    const session = await this.aiChatSessionModel.findById(sessionId);
    if (!session) throw new NotFoundException("Session not found");
    this.assertSessionOwner(session, userId);

    const usage = await this.getTodayUsage(userId);

    const result = await this.aiLangfuseTracing.runChatObservation(
      {
        workflow: "notebook-action",
        userId,
        sessionId,
        input: {
          notebookId: payload.notebookId,
          prompt: payload.prompt,
        },
      },
      () =>
        this.chatAgent.addItemsToNotebook(
          userId,
          payload.notebookId,
          payload.prompt,
        ),
      (response) => ({
        notebookId: response?.notebookId,
        notebookName: response?.notebookName,
        itemsCount: response?.itemsCount,
        requestedCount: response?.requestedCount,
        success: response?.success,
      }),
    );
    const notebookName = result?.notebookName || "sổ tay đã chọn";

    this.consumeNotebookChoiceActions(
      session,
      payload.prompt,
      payload.notebookId,
    );
    session.markModified("messages");

    const userMsg: ChatMessage = {
      role: "user",
      content: `Xác nhận thêm từ vào sổ tay "${notebookName}".`,
      timestamp: new Date(),
    };
    const actions: ChatMessageAction[] = this.buildNotebookViewActions(
      "Xem sổ tay đã cập nhật",
      result,
      false,
    );
    const aiMsg: ChatMessage = {
      role: "ai",
      content: this.buildNotebookAddResultMessage(result),
      timestamp: new Date(),
      actions,
    };

    session.messages.push(userMsg);
    session.messages.push(aiMsg);
    await session.save();

    return {
      sessionId: session._id,
      userMessage: userMsg,
      aiMessage: aiMsg,
      result,
      usage,
    };
  }

  public async createNotebookFromAction(
    sessionId: string,
    payload: ConfirmNotebookCreateDto,
    userId: string,
  ) {
    const session = await this.aiChatSessionModel.findById(sessionId);
    if (!session) throw new NotFoundException("Session not found");
    this.assertSessionOwner(session, userId);

    const usage = await this.getTodayUsage(userId);

    const result = await this.aiLangfuseTracing.runChatObservation(
      {
        workflow: "notebook-action",
        userId,
        sessionId,
        input: {
          notebookName: payload.name,
          prompt: payload.prompt,
        },
      },
      () =>
        this.chatAgent.createNotebookFromAction(
          userId,
          payload.name,
          payload.prompt,
        ),
      (response) => ({
        notebookId: response?.notebookId,
        notebookName: response?.notebookName,
        itemsCount: response?.itemsCount,
        requestedCount: response?.requestedCount,
        success: response?.success,
      }),
    );
    const notebookName = result?.notebookName || payload.name;

    this.consumeNotebookCreateActions(session, payload.prompt, notebookName);
    session.markModified("messages");

    const userMsg: ChatMessage = {
      role: "user",
      content: `Xác nhận tạo ${result?.requestedCount || 30} từ vựng cho sổ tay "${notebookName}".`,
      timestamp: new Date(),
    };
    const actions: ChatMessageAction[] = this.buildNotebookViewActions(
      "Xem sổ tay đã tạo",
      result,
      true,
    );
    const aiMsg: ChatMessage = {
      role: "ai",
      content: this.buildNotebookCreateResultMessage(result),
      timestamp: new Date(),
      actions,
    };

    session.messages.push(userMsg);
    session.messages.push(aiMsg);
    await session.save();

    return {
      sessionId: session._id,
      userMessage: userMsg,
      aiMessage: aiMsg,
      result,
      usage,
    };
  }

  async getUserSessions(userId: string) {
    if (!userId) return [];

    return this.aiChatSessionModel
      .find(this.getUserSessionQuery(userId))
      .sort({ isPinned: -1, updatedAt: -1 })
      .limit(50)
      .lean();
  }

  async getLastUserSession(userId: string) {
    if (!userId) return null;

    const session = await this.aiChatSessionModel
      .findOne(this.getUserSessionQuery(userId)) // findOne sẽ lấy 1 document
      .sort({ isPinned: -1, updatedAt: -1 }) // sắp xếp theo cập nhật mới nhất
      .lean();

    return session || null; // trả về null nếu không tìm thấy
  }

  async getGuestSessions() {
    return this.aiChatSessionModel
      .find({ userId: null, isDeleted: { $ne: true }, deletedAt: null })
      .sort({ updatedAt: -1 })
      .limit(10);
  }

  async updateSession(
    sessionId: string,
    userId: string,
    payload: { title?: string; isPinned?: boolean },
  ) {
    const session = await this.aiChatSessionModel.findById(sessionId);
    if (!session) throw new NotFoundException("Session not found");
    this.assertSessionOwner(session, userId);

    if (typeof payload.title === "string") {
      const title = payload.title.replace(/\s+/g, " ").trim();
      session.title = title || "Cuộc trò chuyện mới";
    }

    if (typeof payload.isPinned === "boolean") {
      session.isPinned = payload.isPinned;
    }

    await session.save();
    return session;
  }

  async deleteSession(sessionId: string, userId: string) {
    const session = await this.aiChatSessionModel.findById(sessionId);
    if (!session) throw new NotFoundException("Session not found");
    this.assertSessionOwner(session, userId);

    session.isDeleted = true;
    session.deletedAt = new Date();
    session.isActive = false;
    await session.save();

    return { message: "Session deleted successfully" };
  }

  async closeSession(sessionId: string, userId: string) {
    const session = await this.aiChatSessionModel.findById(sessionId);
    if (!session) throw new NotFoundException("Session not found");
    this.assertSessionOwner(session, userId);
    session.isActive = false;
    await session.save();
    return session;
  }
}
