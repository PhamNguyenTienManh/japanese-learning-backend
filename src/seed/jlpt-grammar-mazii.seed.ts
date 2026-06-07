import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  Example,
  JlptGrammar,
  Usage,
} from "../modules/jlpt_grammar/schemas/jlpt_grammar.schema";

type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1";

type MaziiJlptGrammarResult = {
  id?: unknown;
  value?: {
    _id?: unknown;
    title?: unknown;
    level?: unknown;
  };
};

type MaziiGrammarExample = {
  content?: unknown;
  transcription?: unknown;
  mean?: unknown;
};

type MaziiGrammarUsage = {
  explain?: unknown;
  mean?: unknown;
  synopsis?: unknown;
  examples?: unknown;
};

type MaziiGrammarDetail = {
  level?: unknown;
  title?: unknown;
  usages?: unknown;
};

type MappedJlptGrammar = {
  level: JlptLevel;
  title: string;
  mean: string;
  usages: Usage[];
  isJlpt: true;
  isDeleted: false;
};

const MAZII_JLPT_GRAMMAR_URL = "https://mazii.net/api/jlptgrammar";
const MAZII_GRAMMAR_DETAIL_URL = "https://mazii.net/api/grammar";
const REQUEST_LIMIT = 30;
const MAX_ITEMS_PER_LEVEL = 100;
const MAX_PAGES_PER_LEVEL = 200;
const REQUEST_DELAY_MS = 180;
const DETAIL_DELAY_MS = 80;
const MAX_RETRIES = 2;
const LEVELS = [
  { query: 1, level: "N1" },
  { query: 2, level: "N2" },
  { query: 3, level: "N3" },
  { query: 4, level: "N4" },
  { query: 5, level: "N5" },
] as const;

@Injectable()
export class JlptGrammarMaziiSeeder {
  constructor(
    @InjectModel(JlptGrammar.name)
    private readonly jlptGrammarModel: Model<JlptGrammar>,
  ) {}

  async run() {
    console.log("🚀 Seeding JLPT grammar from Mazii API...");

    const existingKeys = await this.getExistingKeys();
    const byLevelAndTitle = new Map<string, MappedJlptGrammar>();
    const stats = {
      fetched: 0,
      detailFetched: 0,
      mapped: 0,
      alreadyExists: 0,
      skipped: 0,
      failedPages: 0,
      failedDetails: 0,
    };
    console.log(`Existing JLPT grammar keys: ${existingKeys.size}`);

    for (const level of LEVELS) {
      let totalForLevel: number | null = null;
      let mappedForLevel = 0;

      for (let page = 1; page <= MAX_PAGES_PER_LEVEL; page += 1) {
        const pageResult = await this.fetchPage(level.query, page).catch(
          (error) => {
            stats.failedPages += 1;
            console.warn(
              `⚠ Mazii grammar list request failed for ${level.level} page ${page}: ${
                error?.message || error
              }`,
            );
            return null;
          },
        );

        if (!pageResult || pageResult.results.length === 0) break;
        if (typeof pageResult.total === "number") totalForLevel = pageResult.total;

        stats.fetched += pageResult.results.length;

        for (const item of pageResult.results) {
          if (mappedForLevel >= MAX_ITEMS_PER_LEVEL) break;

          const id = this.getGrammarId(item);
          if (!id) {
            stats.skipped += 1;
            continue;
          }

          const detail = await this.fetchDetail(id).catch((error) => {
            stats.failedDetails += 1;
            console.warn(
              `⚠ Mazii grammar detail request failed for ${level.level} id ${id}: ${
                error?.message || error
              }`,
            );
            return null;
          });

          if (!detail) {
            stats.skipped += 1;
            continue;
          }

          stats.detailFetched += 1;
          const mapped = this.mapGrammar(detail, level.level);
          if (!mapped) {
            stats.skipped += 1;
            continue;
          }

          const key = `${mapped.level}::${mapped.title}`;
          if (existingKeys.has(key) || byLevelAndTitle.has(key)) {
            stats.alreadyExists += 1;
            continue;
          }

          byLevelAndTitle.set(key, mapped);
          existingKeys.add(key);
          mappedForLevel += 1;
          stats.mapped += 1;
          await this.delay(DETAIL_DELAY_MS);
        }

        if (mappedForLevel >= MAX_ITEMS_PER_LEVEL) break;
        if (pageResult.results.length < REQUEST_LIMIT) break;
        if (totalForLevel !== null && page * REQUEST_LIMIT >= totalForLevel) break;
        await this.delay(REQUEST_DELAY_MS);
      }
    }

    const now = new Date();
    const operations = [...byLevelAndTitle.values()].map((item) => ({
      updateOne: {
        filter: { level: item.level, title: item.title },
        update: {
          $set: {
            mean: item.mean,
            usages: item.usages,
            isJlpt: true,
            isDeleted: false,
            updatedAt: now,
          },
          $setOnInsert: {
            level: item.level,
            title: item.title,
            createdAt: now,
          },
        },
        upsert: true,
      },
    }));

    if (operations.length === 0) {
      console.log("No mapped JLPT grammar to upsert.");
      return;
    }

    const result = await this.jlptGrammarModel.bulkWrite(operations, {
      ordered: false,
    });

    console.log(
      [
        "✔ Mazii JLPT grammar seeding complete!",
        `Fetched list items: ${stats.fetched}`,
        `Fetched details: ${stats.detailFetched}`,
        `Mapped: ${stats.mapped}`,
        `Unique upserts: ${operations.length}`,
        `Inserted: ${result.upsertedCount || 0}`,
        `Modified: ${result.modifiedCount || 0}`,
        `Already existed: ${stats.alreadyExists}`,
        `Skipped: ${stats.skipped}`,
        `Failed pages: ${stats.failedPages}`,
        `Failed details: ${stats.failedDetails}`,
      ].join("\n"),
    );
  }

  private async getExistingKeys(): Promise<Set<string>> {
    const existing = await this.jlptGrammarModel
      .find({}, { level: 1, title: 1 })
      .lean<Array<{ level?: unknown; title?: unknown }>>();

    return new Set(
      existing
        .map((item) => {
          const level = this.toLevel(item.level);
          const title = this.toCleanString(item.title);
          return level && title ? `${level}::${title}` : "";
        })
        .filter(Boolean),
    );
  }

  private async fetchPage(
    level: number,
    page: number,
  ): Promise<{ results: MaziiJlptGrammarResult[]; total?: number }> {
    return this.withRetry(async () => {
      const response = await fetch(
        `${MAZII_JLPT_GRAMMAR_URL}/${level}/${REQUEST_LIMIT}/${page}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        },
      );

      if (!response.ok) {
        throw new Error(`Mazii returned HTTP ${response.status}`);
      }

      const body = (await response.json()) as {
        status?: number;
        results?: MaziiJlptGrammarResult[];
        total?: unknown;
      };
      if (body.status && body.status !== 200) {
        throw new Error(`Mazii returned status ${body.status}`);
      }

      return {
        results: Array.isArray(body.results) ? body.results : [],
        total: typeof body.total === "number" ? body.total : undefined,
      };
    });
  }

  private async fetchDetail(id: string): Promise<MaziiGrammarDetail | null> {
    return this.withRetry(async () => {
      const response = await fetch(`${MAZII_GRAMMAR_DETAIL_URL}/${id}/javi`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Mazii returned HTTP ${response.status}`);
      }

      const body = (await response.json()) as {
        status?: number;
        grammar?: MaziiGrammarDetail;
      };
      if (body.status && body.status !== 200) {
        throw new Error(`Mazii returned status ${body.status}`);
      }

      return body.grammar || null;
    });
  }

  private mapGrammar(
    grammar: MaziiGrammarDetail,
    fallbackLevel: JlptLevel,
  ): MappedJlptGrammar | null {
    const rawTitle = this.cleanHtml(grammar.title);
    const { title, mean: titleMean } = this.splitTitleAndMean(rawTitle);
    const usages = this.mapUsages(grammar.usages);
    const fallbackMean = this.firstNonEmpty([
      titleMean,
      ...usages.flatMap((usage) => [usage.explain, usage.synopsis]),
    ]);
    const mean = titleMean || fallbackMean;

    if (!title || !mean) return null;

    return {
      level: this.toLevel(grammar.level) || fallbackLevel,
      title,
      mean,
      usages,
      isJlpt: true,
      isDeleted: false,
    };
  }

  private mapUsages(value: unknown): Usage[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((usage: MaziiGrammarUsage) => ({
        explain: this.cleanHtml(usage?.explain) || undefined,
        synopsis: this.cleanHtml(usage?.synopsis) || undefined,
        examples: this.mapExamples(usage?.examples),
      }))
      .filter(
        (usage) =>
          usage.explain || usage.synopsis || (usage.examples?.length || 0) > 0,
      ) as Usage[];
  }

  private mapExamples(value: unknown): Example[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((example: MaziiGrammarExample) => ({
        content: this.cleanHtml(example?.content),
        transcription: this.cleanHtml(example?.transcription) || undefined,
        meaning: this.cleanHtml(example?.mean) || undefined,
      }))
      .filter((example) => example.content) as Example[];
  }

  private getGrammarId(item: MaziiJlptGrammarResult): string {
    return (
      this.toCleanString(item?.id) ||
      this.toCleanString(item?.value?._id)
    );
  }

  private splitTitleAndMean(value: string): { title: string; mean: string } {
    const [title, ...meanParts] = value.split("=>");
    return {
      title: this.toCleanString(title),
      mean: this.toCleanString(meanParts.join("=>")),
    };
  }

  private toLevel(value: unknown): JlptLevel | null {
    const normalized = this.toCleanString(value).replace(/^N/i, "");
    if (["5", "4", "3", "2", "1"].includes(normalized)) {
      return `N${normalized}` as JlptLevel;
    }

    return null;
  }

  private cleanHtml(value: unknown): string {
    return this.toCleanString(value)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private firstNonEmpty(values: Array<string | undefined>): string {
    return values.find((value) => value && value.trim())?.trim() || "";
  }

  private toCleanString(value: unknown): string {
    return typeof value === "string" || typeof value === "number"
      ? String(value).trim()
      : "";
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES) {
          await this.delay(250 * (attempt + 1));
        }
      }
    }

    throw lastError;
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
