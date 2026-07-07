// notebookTools.ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { NotebookService } from "src/modules/notebook/notebook.service";
import { NotebookItemService } from "src/modules/notebook-item/notebook-item.service";
import { NotebookAIService } from "../service/notebook-ai.service";

const MAX_ADD_ITEM_ATTEMPTS = 3;
export const MAX_NOTEBOOK_ITEMS_PER_ACTION = 30;
const MAX_NOTEBOOK_CANDIDATES = 10;
const MIN_CONFIRM_SCORE = 0.45;
const MIN_SCORE_GAP = 0.15;

export type NotebookToolProgress = {
  stage: string;
  message: string;
  current?: number;
  total?: number;
};

export type NotebookToolProgressCallback = (
  progress: NotebookToolProgress,
) => void;

const NOTEBOOK_STOPWORDS = new Set([
  "so",
  "tay",
  "tu",
  "vung",
  "ve",
  "va",
  "la",
  "co",
  "cua",
  "toi",
  "minh",
  "ban",
  "muon",
  "them",
  "tao",
  "sinh",
  "cho",
  "moi",
  "nua",
  "trong",
  "notebook",
  "items",
  "words",
]);

const NOTEBOOK_SYNONYMS = [
  {
    canonical: "football",
    variants: ["da bong", "bong da", "da banh", "football", "soccer"],
  },
];

function normalizeItemName(name: string): string {
  return (name || "").trim().toLocaleLowerCase();
}

function findRequestedCountMatch(prompt: string): RegExpMatchArray | null {
  const text = prompt || "";

  return (
    text.match(
      /\b(\d{1,6})\s*(?:từ\s+vựng|tu\s+vung|từ|tu|kanji|mục|muc|items?|words?)\b/i,
    ) ||
    text.match(
      /\b(?:thêm|them|tạo|tao|sinh|generate|add|make|create)\s+(\d{1,6})\b/i,
    )
  );
}

function parseRequestedCount(prompt: string): number | null {
  const match = findRequestedCountMatch(prompt);
  if (!match) return null;

  const count = Number(match[1]);
  if (!Number.isFinite(count) || count <= 0) return null;
  return count;
}

function shouldGenerateItemsForNewNotebook(prompt: string): boolean {
  return parseRequestedCount(prompt) !== null;
}

async function createEmptyNotebook(
  notebookService: NotebookService,
  userId: string,
  notebookName: string,
) {
  return notebookService.create(userId, {
    user_id: userId,
    name: notebookName,
  });
}

function buildLimitedPrompt(prompt: string, limit = MAX_NOTEBOOK_ITEMS_PER_ACTION): string {
  const originalPrompt = (prompt || "").trim();
  if (!originalPrompt) return `${limit} từ vựng`;

  const countMatch = findRequestedCountMatch(originalPrompt);
  if (countMatch?.[1]) {
    return (
      originalPrompt.slice(0, countMatch.index) +
      countMatch[0].replace(countMatch[1], String(limit)) +
      originalPrompt.slice((countMatch.index || 0) + countMatch[0].length)
    );
  }

  return `${limit} từ vựng. ${originalPrompt}`;
}

function buildNotebookLimitConfirmation(input: {
  prompt: string;
  requestedCount: number;
  notebookName?: string;
}) {
  const limitedCount = MAX_NOTEBOOK_ITEMS_PER_ACTION;
  return {
    success: true,
    needsLimitConfirmation: true,
    requestedCount: input.requestedCount,
    limitedCount,
    prompt: buildLimitedPrompt(input.prompt, limitedCount),
    notebookName: input.notebookName,
    message: `Một lần mình chỉ có thể tạo tối đa ${limitedCount} từ vựng. Bạn có muốn mình tạo ${limitedCount} từ vựng${input.notebookName ? ` cho sổ tay "${input.notebookName}"` : ""} không?`,
  };
}

export async function createNotebookWithGeneratedItems(
  notebookAIService: NotebookAIService,
  notebookService: NotebookService,
  notebookItemService: NotebookItemService,
  userId: string,
  notebookName: string,
  prompt: string,
) {
  const requestedCount = parseRequestedCount(prompt);
  const limitedPrompt =
    requestedCount && requestedCount > MAX_NOTEBOOK_ITEMS_PER_ACTION
      ? buildLimitedPrompt(prompt)
      : prompt;

  const notebook = await notebookService.create(userId, {
    user_id: userId,
    name: notebookName,
  });

  const items = await notebookAIService.generateNotebookItems(limitedPrompt);
  const limitedItems = items.slice(0, MAX_NOTEBOOK_ITEMS_PER_ACTION);

  for (const item of limitedItems) {
    await notebookItemService.create(notebook.id.toString(), {
      notebook_id: notebook.id.toString(),
      name: item.name ?? "",
      notes: item.notes ?? "",
      mean: item.mean ?? "",
      phonetic: item.phonetic ?? "",
      type: "other",
    });
  }

  return {
    notebook,
    itemsCount: limitedItems.length,
    requestedCount:
      requestedCount && requestedCount > MAX_NOTEBOOK_ITEMS_PER_ACTION
        ? MAX_NOTEBOOK_ITEMS_PER_ACTION
        : (requestedCount ?? limitedItems.length),
  };
}

function buildSupplementPrompt(
  originalPrompt: string,
  neededCount: number,
  excludedNames: string[],
): string {
  const excluded = excludedNames.slice(-80).join(", ");
  return [
    originalPrompt,
    "",
    `Sinh thêm chính xác ${neededCount} mục mới khác.`,
    "Không được lặp lại hoặc dùng các mục đã có trong danh sách sau:",
    excluded || "(không có)",
  ].join("\n");
}

function normalizeNotebookText(value: string): string {
  let normalized = (value || "")
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const group of NOTEBOOK_SYNONYMS) {
    for (const variant of group.variants) {
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      normalized = normalized.replace(
        new RegExp(`\\b${escaped}\\b`, "g"),
        group.canonical,
      );
    }
  }

  return normalized.replace(/\s+/g, " ").trim();
}

function tokenizeNotebookText(value: string): string[] {
  return normalizeNotebookText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length > 1 &&
        !/^\d+$/.test(token) &&
        !NOTEBOOK_STOPWORDS.has(token),
    );
}

function scoreNotebookName(keyword: string, notebookName: string): number {
  const normalizedKeyword = normalizeNotebookText(keyword);
  const normalizedName = normalizeNotebookText(notebookName);
  const keywordTokens = Array.from(new Set(tokenizeNotebookText(keyword)));
  const nameTokens = Array.from(new Set(tokenizeNotebookText(notebookName)));

  if (!normalizedKeyword || !normalizedName) return 0;
  if (normalizedKeyword === normalizedName) return 1;

  let score = 0;
  if (
    normalizedName.includes(normalizedKeyword) ||
    normalizedKeyword.includes(normalizedName)
  ) {
    score += 0.35;
  }

  if (keywordTokens.length > 0 && nameTokens.length > 0) {
    const nameSet = new Set(nameTokens);
    const keywordSet = new Set(keywordTokens);
    const overlap = keywordTokens.filter((token) => nameSet.has(token)).length;
    const union = new Set([...keywordTokens, ...nameTokens]).size || 1;
    score += (overlap / keywordTokens.length) * 0.45;
    score += (overlap / union) * 0.2;

    for (const keywordToken of keywordSet) {
      if (
        [...nameSet].some(
          (nameToken) =>
            nameToken.includes(keywordToken) ||
            keywordToken.includes(nameToken),
        )
      ) {
        score += 0.05;
      }
    }
  }

  return Math.min(score, 1);
}

function isExactNotebookNameMatch(keyword: string, notebookName: string): boolean {
  const normalizedKeyword = normalizeNotebookText(keyword);
  const normalizedName = normalizeNotebookText(notebookName);

  return !!normalizedKeyword && normalizedKeyword === normalizedName;
}

function buildNotebookConfirmationToken(
  notebookId: string,
  prompt: string,
): string {
  const source = `${notebookId}:${normalizeNotebookText(prompt)}`;
  let hash = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function resolveNotebookCandidates(notebooks: any[], keyword: string) {
  const scored = notebooks
    .map((nb) => ({
      id: nb.id.toString(),
      name: nb.name,
      score: scoreNotebookName(keyword, nb.name),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const positiveCandidates = scored
    .filter((candidate) => candidate.score > 0)
    .slice(0, MAX_NOTEBOOK_CANDIDATES);
  const fallbackCandidates = scored.slice(0, MAX_NOTEBOOK_CANDIDATES);
  const candidates =
    positiveCandidates.length > 0 ? positiveCandidates : fallbackCandidates;
  const bestCandidate = positiveCandidates[0] || null;
  const secondCandidate = positiveCandidates[1] || null;
  const needsConfirmation =
    !!bestCandidate &&
    bestCandidate.score >= MIN_CONFIRM_SCORE &&
    (!secondCandidate ||
      bestCandidate.score - secondCandidate.score >= MIN_SCORE_GAP);

  return {
    candidates,
    bestCandidate,
    needsConfirmation,
    needsSelection: !needsConfirmation,
    noMatch: positiveCandidates.length === 0,
  };
}

export async function addGeneratedNotebookItems(
  notebookAIService: NotebookAIService,
  notebookItemService: NotebookItemService,
  notebookId: string,
  prompt: string,
  onProgress?: NotebookToolProgressCallback,
) {
  if (!notebookId) throw new Error("notebookId is required");
  if (!prompt) throw new Error("prompt is required");

  const existingItems = await notebookItemService.getItemByNotebookId(
    notebookId,
  );
  const existingNames = new Set(
    existingItems.map((item) => normalizeItemName(item.name)),
  );
  const requestedCount = parseRequestedCount(prompt);
  const limitedPrompt =
    requestedCount && requestedCount > MAX_NOTEBOOK_ITEMS_PER_ACTION
      ? buildLimitedPrompt(prompt)
      : prompt;
  const requestedTargetCount = requestedCount
    ? Math.min(requestedCount, MAX_NOTEBOOK_ITEMS_PER_ACTION)
    : MAX_NOTEBOOK_ITEMS_PER_ACTION;

  onProgress?.({
    stage: "generate_notebook_items",
    message: requestedCount
      ? `Đang tạo ${requestedTargetCount} từ vựng mới...`
      : "Đang tạo từ vựng mới...",
    current: 0,
    total: requestedCount ? requestedTargetCount : undefined,
  });

  const firstBatch = await notebookAIService.generateNotebookItems(limitedPrompt);
  const targetCount = Math.min(
    requestedCount ?? firstBatch.length,
    MAX_NOTEBOOK_ITEMS_PER_ACTION,
  );

  if (!firstBatch || firstBatch.length === 0 || targetCount <= 0) {
    throw new Error("Failed to generate items from prompt");
  }

  console.log(
    `Requested ${targetCount} new items. Existing notebook items: ${existingItems.length}`,
  );
  onProgress?.({
    stage: "filter_notebook_items",
    message: `Đã tạo batch đầu tiên. Đang lọc từ trùng với ${existingItems.length} từ hiện có...`,
    current: 0,
    total: targetCount,
  });

  const addedItems: string[] = [];
  const skippedItems: { name: string; reason: string }[] = [];
  const seenNames = new Set(existingNames);
  let generatedCount = 0;
  let batch = firstBatch;

  for (
    let attempt = 1;
    attempt <= MAX_ADD_ITEM_ATTEMPTS && addedItems.length < targetCount;
    attempt += 1
  ) {
    const neededCount = targetCount - addedItems.length;
    if (attempt > 1) {
      onProgress?.({
        stage: "supplement_notebook_items",
        message: `Một số từ bị trùng. Đang tạo bổ sung ${neededCount} từ mới...`,
        current: addedItems.length,
        total: targetCount,
      });

      const excludedNames = Array.from(seenNames).filter(Boolean);
      const supplementPrompt = buildSupplementPrompt(
        prompt,
        neededCount,
        excludedNames,
      );
      batch = await notebookAIService.generateNotebookItems(supplementPrompt);
    }

    generatedCount += batch?.length || 0;
    console.log(
      `Attempt ${attempt}: generated ${batch?.length || 0}, need ${neededCount}`,
    );

    if (!batch || batch.length === 0) {
      skippedItems.push({
        name: "(batch)",
        reason: `Attempt ${attempt} generated no items`,
      });
      continue;
    }

    for (const item of batch) {
      if (addedItems.length >= targetCount) break;

      const name = (item.name ?? "").trim();
      const normalizedName = normalizeItemName(name);
      if (!name) {
        skippedItems.push({ name: "(empty)", reason: "Missing item name" });
        continue;
      }

      if (seenNames.has(normalizedName)) {
        skippedItems.push({
          name,
          reason: existingNames.has(normalizedName)
            ? "Already exists in notebook"
            : "Duplicated in generated batch",
        });
        continue;
      }

      try {
        await notebookItemService.create(notebookId, {
          notebook_id: notebookId,
          name,
          notes: item.notes ?? "",
          mean: item.mean ?? "",
          phonetic: item.phonetic ?? "",
          type: "other",
          ref_id: null,
        });
        addedItems.push(name);
        seenNames.add(normalizedName);
        if (
          addedItems.length === targetCount ||
          addedItems.length % 10 === 0
        ) {
          onProgress?.({
            stage: "save_notebook_items",
            message:
              addedItems.length >= targetCount
                ? `Đã thêm đủ ${addedItems.length}/${targetCount} từ mới. Sắp hoàn thành...`
                : `Đã thêm ${addedItems.length}/${targetCount} từ mới vào sổ tay...`,
            current: addedItems.length,
            total: targetCount,
          });
        }
      } catch (error: any) {
        const reason =
          error?.response?.message || error?.message || "Failed to save item";
        console.warn(`Skipped item "${name}": ${reason}`);
        skippedItems.push({ name, reason });
        seenNames.add(normalizedName);
      }
    }
  }

  const isComplete = addedItems.length >= targetCount;
  onProgress?.({
    stage: "complete_notebook_items",
    message: isComplete
      ? `Hoàn tất thêm ${addedItems.length}/${targetCount} từ mới.`
      : `Đã thêm ${addedItems.length}/${targetCount} từ mới, không sinh đủ mục không trùng.`,
    current: addedItems.length,
    total: targetCount,
  });

  return {
    success: addedItems.length > 0,
    notebookId,
    requestedCount: targetCount,
    generatedCount,
    itemsCount: addedItems.length,
    isComplete,
    addedItems,
    skippedItems,
    message:
      isComplete
        ? `Added ${addedItems.length}/${targetCount} requested items to notebook`
        : `Added ${addedItems.length}/${targetCount} requested items to notebook. Could not generate enough unique items.`,
  };
}

// ==================== TOOL 1: TẠO NOTEBOOK MỚI ====================
export const createNotebookTool = (
  notebookAIService: NotebookAIService,
  notebookService: NotebookService,
  notebookItemService: NotebookItemService,
  userId: string,
) => {
  const toolFunc = async (input: { prompt: string }) => {
    console.log("=== CREATE NOTEBOOK TOOL CALLED ===");
    console.log("Input:", input);

    if (!userId) {
      console.error("ERROR: userId not bound to tool!");
      throw new Error("userId is required");
    }

    console.log("Using userId:", userId);

    // Tạo tên notebook tự động
    const notebookName = `Notebook_GenAI_${new Date().toISOString().replace(/[:.]/g, "-")}`;
    const requestedCount = parseRequestedCount(input.prompt);

    if (!shouldGenerateItemsForNewNotebook(input.prompt)) {
      const notebook = await createEmptyNotebook(
        notebookService,
        userId,
        notebookName,
      );

      console.log("Created empty notebook ID:", notebook.id);
      console.log("================================");

      return JSON.stringify({
        success: true,
        notebookId: notebook.id.toString(),
        notebookName,
        itemsCount: 0,
        requestedCount: 0,
        isEmptyNotebook: true,
        message: `Đã tạo sổ tay "${notebookName}". Bạn muốn thêm từ vựng gì vào sổ tay này?`,
      });
    }

    if (requestedCount && requestedCount > MAX_NOTEBOOK_ITEMS_PER_ACTION) {
      return JSON.stringify(
        buildNotebookLimitConfirmation({
          prompt: input.prompt,
          requestedCount,
          notebookName,
        }),
      );
    }

    console.log("Creating notebook:", notebookName);

    const { notebook, itemsCount } = await createNotebookWithGeneratedItems(
      notebookAIService,
      notebookService,
      notebookItemService,
      userId,
      notebookName,
      input.prompt,
    );

    console.log("Created notebook ID:", notebook.id);
    console.log(`Added ${itemsCount} items`);
    console.log("================================");

    return JSON.stringify({
      success: true,
      notebookId: notebook.id.toString(),
      notebookName: notebookName,
      itemsCount,
      message: `Created notebook "${notebookName}" with ${itemsCount} items`,
    });
  };

  return tool(toolFunc, {
    name: "create_notebook",
    description:
      'Create a NEW Japanese learning notebook with vocabulary/kanji items. Use this when user says "create notebook", "make a notebook". Do NOT use when user mentions adding to an existing notebook.',
    schema: z.object({
      prompt: z.string().describe("What vocabulary/kanji to generate"),
    }),
  });
};

// ==================== TOOL 2: TÌM NOTEBOOK THEO TÊN ====================
export const searchNotebookByNameTool = (
  notebookService: NotebookService,
  userId: string,
  onProgress?: NotebookToolProgressCallback,
) => {
  const toolFunc = async (input: { keyword: string; addPrompt?: string }) => {
    console.log("=== SEARCH TOOL CALLED ===");
    console.log("Input:", input);

    if (!userId) {
      console.error("ERROR: userId not bound to tool!");
      throw new Error("userId is required");
    }

    console.log("Using userId:", userId);
    console.log("Searching for:", input.keyword);
    onProgress?.({
      stage: "search_notebook",
      message: `Đang tìm sổ tay "${input.keyword}"...`,
    });

    const notebooks = await notebookService.findByUserId(userId);

    console.log("=== SEARCH DEBUG ===");
    console.log("Total notebooks found:", notebooks.length);
    notebooks.forEach((nb) => {
      console.log(`  - ID: ${nb.id}, Name: "${nb.name}"`);
    });

    const resolved = resolveNotebookCandidates(notebooks, input.keyword);
    const addPrompt = (input.addPrompt || "").trim();
    const requestedCount = addPrompt ? parseRequestedCount(addPrompt) : null;
    const exactNotebookMatch =
      !!addPrompt &&
      !!resolved.bestCandidate &&
      resolved.needsConfirmation &&
      isExactNotebookNameMatch(input.keyword, resolved.bestCandidate.name);
    const needsAddLimitConfirmation =
      exactNotebookMatch &&
      !!requestedCount &&
      requestedCount > MAX_NOTEBOOK_ITEMS_PER_ACTION;
    const autoConfirmed = exactNotebookMatch && !needsAddLimitConfirmation;
    const confirmationToken =
      autoConfirmed && resolved.bestCandidate
        ? buildNotebookConfirmationToken(resolved.bestCandidate.id, addPrompt)
        : undefined;

    console.log("Matched results:", resolved.candidates.length);
    console.log("Best match:", resolved.bestCandidate);
    console.log("===================");
    if (resolved.bestCandidate?.name && resolved.needsConfirmation) {
      onProgress?.({
        stage: "found_notebook",
        message: `Đã tìm thấy sổ tay "${resolved.bestCandidate.name}".`,
      });
    } else if (resolved.noMatch) {
      onProgress?.({
        stage: "notebook_not_found",
        message: "Chưa tìm thấy sổ tay khớp chính xác, đang chuẩn bị danh sách gợi ý...",
      });
    } else {
      onProgress?.({
        stage: "select_notebook",
        message: "Có nhiều sổ tay gần giống nhau, đang chuẩn bị lựa chọn cho bạn...",
      });
    }

    return JSON.stringify({
      success: true,
      keyword: input.keyword,
      addPrompt,
      total: notebooks.length,
      ...resolved,
      autoConfirmed,
      exactNotebookMatch,
      needsAddLimitConfirmation,
      requestedCount: requestedCount || undefined,
      limitedCount: needsAddLimitConfirmation
        ? MAX_NOTEBOOK_ITEMS_PER_ACTION
        : undefined,
      limitedPrompt: needsAddLimitConfirmation
        ? buildLimitedPrompt(addPrompt)
        : undefined,
      autoAddNotebookId: autoConfirmed ? resolved.bestCandidate?.id : undefined,
      confirmationToken,
      message: resolved.needsConfirmation
        ? needsAddLimitConfirmation
          ? `Exact notebook match "${resolved.bestCandidate?.name}" needs limit confirmation`
          : autoConfirmed
          ? `Exact notebook match "${resolved.bestCandidate?.name}" confirmed`
          : `Found likely notebook "${resolved.bestCandidate?.name}"`
        : resolved.noMatch
          ? "No close notebook match found"
          : "Multiple possible notebooks found",
    });
  };

  return tool(toolFunc, {
    name: "search_notebook_by_name",
    description:
      "Find existing notebook by name, including fuzzy Vietnamese matches. ALWAYS use this FIRST when user mentions adding to a specific notebook or asks to inspect/count a named notebook. When the user wants to add items, pass the full add request as addPrompt. If the result has autoConfirmed=true, call add_notebook_items immediately with autoAddNotebookId and confirmationToken. Otherwise the UI will confirm/select before adding. For read-only inspect/count requests, do not pass addPrompt; if the result has needsConfirmation=true and bestCandidate.id, call get_notebook_items with that id instead of asking the user to confirm by text.",
    schema: z.object({
      keyword: z.string().describe("Notebook name to search"),
      addPrompt: z
        .string()
        .optional()
        .describe("Full user request for items to add, e.g. '10 từ vựng về bóng đá'"),
    }),
  });
};

// ==================== TOOL 3: THÊM ITEMS VÀO NOTEBOOK CÓ SẴN ====================
export const addNotebookItemsTool = (
  notebookAIService: NotebookAIService,
  notebookService: NotebookService,
  notebookItemService: NotebookItemService,
  userId: string,
  onProgress?: NotebookToolProgressCallback,
) => {
  const toolFunc = async (input: {
    notebookId: string;
    prompt: string;
    confirmationToken?: string;
  }) => {
    console.log("=== ADD ITEMS TOOL CALLED ===");
    console.log("Input:", input);

    const expectedToken = buildNotebookConfirmationToken(
      input.notebookId,
      input.prompt,
    );

    if (input.confirmationToken === expectedToken) {
      const notebooks = await notebookService.findByUserId(userId);
      const notebook = notebooks.find(
        (nb) => nb.id.toString() === input.notebookId,
      );

      if (!notebook) {
        throw new Error("Notebook not found");
      }

      const result = await addGeneratedNotebookItems(
        notebookAIService,
        notebookItemService,
        input.notebookId,
        input.prompt,
        onProgress,
      );

      console.log("Add confirmed by exact notebook match");
      console.log("================================");

      return JSON.stringify({
        ...result,
        notebookName: notebook.name,
      });
    }

    const result = {
      success: false,
      needsUserConfirmation: true,
      notebookId: input.notebookId,
      prompt: input.prompt,
      message:
        "Cần người dùng xác nhận trên giao diện trước khi thêm từ vào sổ tay.",
    };

    console.log("Add blocked until UI confirmation");
    console.log("================================");

    return JSON.stringify(result);
  };

  return tool(toolFunc, {
    name: "add_notebook_items",
    description:
      "Add vocabulary/kanji items to an EXISTING notebook only when search_notebook_by_name returned autoConfirmed=true and provided a confirmationToken for the exact same prompt. Without that token, this tool only reports that UI confirmation is required.",
    schema: z.object({
      notebookId: z
        .string()
        .describe("ID of the existing notebook from search result"),
      prompt: z.string().describe("What items to generate and add"),
      confirmationToken: z
        .string()
        .optional()
        .describe("Token from search_notebook_by_name when autoConfirmed=true"),
    }),
  });
};

// ==================== TOOL 4: TẠO NOTEBOOK VỚI TÊN TÙY CHỈNH ====================
export const createNamedNotebookTool = (
  notebookAIService: NotebookAIService,
  notebookService: NotebookService,
  notebookItemService: NotebookItemService,
  userId: string,
) => {
  const toolFunc = async (input: { name: string; prompt: string }) => {
    console.log("=== CREATE NAMED NOTEBOOK TOOL CALLED ===");
    console.log("Input:", input);

    if (!userId) {
      console.error("ERROR: userId not bound to tool!");
      throw new Error("userId is required");
    }

    if (!input.name || !input.prompt) {
      throw new Error("Both name and prompt are required");
    }

    console.log("Using userId:", userId);
    console.log("Notebook name:", input.name);
    const requestedCount = parseRequestedCount(input.prompt);

    if (!shouldGenerateItemsForNewNotebook(input.prompt)) {
      const notebook = await createEmptyNotebook(
        notebookService,
        userId,
        input.name,
      );

      console.log("Created empty notebook ID:", notebook.id);
      console.log("================================");

      return JSON.stringify({
        success: true,
        notebookId: notebook.id.toString(),
        notebookName: input.name,
        itemsCount: 0,
        requestedCount: 0,
        isEmptyNotebook: true,
        message: `Đã tạo sổ tay "${input.name}". Bạn muốn thêm từ vựng gì vào sổ tay này?`,
      });
    }

    if (requestedCount && requestedCount > MAX_NOTEBOOK_ITEMS_PER_ACTION) {
      return JSON.stringify(
        buildNotebookLimitConfirmation({
          prompt: input.prompt,
          requestedCount,
          notebookName: input.name,
        }),
      );
    }

    const { notebook, itemsCount } = await createNotebookWithGeneratedItems(
      notebookAIService,
      notebookService,
      notebookItemService,
      userId,
      input.name,
      input.prompt,
    );

    console.log("Created notebook ID:", notebook.id);
    console.log(`Added ${itemsCount} items`);
    console.log("================================");

    return JSON.stringify({
      success: true,
      notebookId: notebook.id.toString(),
      notebookName: input.name,
      itemsCount,
      message: `Đã tạo sổ tay "${input.name}" với ${itemsCount} mục`,
    });
  };

  return tool(toolFunc, {
    name: "create_named_notebook",
    description:
      'Create a new notebook with a CUSTOM NAME. Use when user specifies a notebook name OR when AI should create a meaningful name based on content. Example: "Từ vựng về gia đình", "Kanji N5 buổi 1".',
    schema: z.object({
      name: z
        .string()
        .describe(
          'The name for the new notebook (e.g., "Từ vựng về gia đình", "Kanji N5")',
        ),
      prompt: z.string().describe("What vocabulary/kanji to generate"),
    }),
  });
};

// ==================== TOOL 5: LIỆT KÊ TẤT CẢ NOTEBOOK CỦA USER ====================
export const listUserNotebooksTool = (
  notebookService: NotebookService,
  notebookItemService: NotebookItemService,
  userId: string,
) => {
  const toolFunc = async () => {
    console.log("=== LIST USER NOTEBOOKS TOOL CALLED ===");

    if (!userId) {
      throw new Error("userId is required");
    }

    const notebooks = await notebookService.findByUserId(userId);

    // Đếm số item mỗi sổ — chạy song song
    const enriched = await Promise.all(
      notebooks.map(async (nb) => {
        const items = await notebookItemService.getItemByNotebookId(
          nb.id.toString(),
        );
        return {
          id: nb.id.toString(),
          name: nb.name,
          itemsCount: items.length,
        };
      }),
    );

    console.log(`Found ${enriched.length} notebooks`);

    return JSON.stringify({
      success: true,
      total: enriched.length,
      notebooks: enriched,
      message: `User có ${enriched.length} sổ tay`,
    });
  };

  return tool(toolFunc, {
    name: "list_user_notebooks",
    description:
      'List ALL notebooks owned by the current user (no parameters needed). Use when user asks "tôi có những sổ tay nào", "danh sách sổ tay của tôi", "show my notebooks", "có bao nhiêu sổ tay".',
    schema: z.object({}),
  });
};

// ==================== TOOL 6: LẤY DANH SÁCH ITEMS TRONG 1 NOTEBOOK ====================
export const getNotebookItemsTool = (
  notebookService: NotebookService,
  notebookItemService: NotebookItemService,
  userId: string,
) => {
  const toolFunc = async (input: { notebookId: string }) => {
    console.log("=== GET NOTEBOOK ITEMS TOOL CALLED ===");
    console.log("Input:", input);

    if (!input.notebookId) throw new Error("notebookId is required");
    if (!userId) throw new Error("userId is required");

    // Verify ownership: notebook phải thuộc về user này
    const notebooks = await notebookService.findByUserId(userId);
    const notebook = notebooks.find(
      (nb) => nb.id.toString() === input.notebookId,
    );
    if (!notebook) {
      return JSON.stringify({
        success: false,
        message: `Không tìm thấy sổ tay với id "${input.notebookId}" của user này`,
      });
    }

    const items = await notebookItemService.getItemByNotebookId(
      input.notebookId,
    );

    const slim = items.map((it) => ({
      name: it.name,
      phonetic: it.phonetic ?? "",
      mean: it.mean ?? "",
      notes: it.notes ?? "",
      type: it.type,
      remember: it.remember,
    }));

    console.log(`Found ${slim.length} items in notebook "${notebook.name}"`);

    return JSON.stringify({
      success: true,
      notebookId: input.notebookId,
      notebookName: notebook.name,
      itemsCount: slim.length,
      items: slim,
      message: `Sổ tay "${notebook.name}" có ${slim.length} mục`,
    });
  };

  return tool(toolFunc, {
    name: "get_notebook_items",
    description:
      'List all vocabulary/kanji items inside a specific notebook (by notebookId). Use when user asks "trong sổ X có gì", "sổ X có bao nhiêu từ", "liệt kê từ vựng trong sổ Y", "show items in notebook". Combine with search_notebook_by_name first if user only provides the name; when search returns a bestCandidate for a read-only request, call this tool directly.',
    schema: z.object({
      notebookId: z.string().describe("ID of the notebook to inspect"),
    }),
  });
};
