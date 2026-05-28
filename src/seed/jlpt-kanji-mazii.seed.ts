import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { JlptKanji } from "../modules/jlpt_kanji/schemas/jlpt_kanji.schema";

type MaziiKanjiExample = {
  w?: unknown;
  m?: unknown;
  p?: unknown;
  h?: unknown;
};

type MaziiJlptKanjiResult = {
  kanji?: unknown;
  mean?: unknown;
  on?: unknown;
  kun?: unknown;
  stroke_count?: unknown;
  detail?: unknown;
  level?: unknown;
  group?: unknown;
  examples?: unknown;
};

type MappedJlptKanji = {
  kanji: string;
  mean: string;
  detail?: string;
  examples: { w: string; m: string; p: string; h: string }[];
  kun?: string;
  on?: string;
  stroke_count?: string;
  level: "N5" | "N4" | "N3" | "N2" | "N1";
  isJlpt: true;
  isDeleted: false;
};

const MAZII_JLPT_KANJI_URL = "https://mazii.net/api/jlptkanji";
const REQUEST_LIMIT = 30;
const MAX_PAGES_PER_LEVEL = 200;
const LEVELS = [
  { query: 5, level: "N5" },
  { query: 4, level: "N4" },
  { query: 3, level: "N3" },
  { query: 2, level: "N2" },
  { query: 1, level: "N1" },
] as const;

@Injectable()
export class JlptKanjiMaziiSeeder {
  constructor(
    @InjectModel(JlptKanji.name)
    private readonly jlptKanjiModel: Model<JlptKanji>,
  ) {}

  async run() {
    console.log("🚀 Seeding JLPT kanji from Mazii API...");

    const byKanji = new Map<string, MappedJlptKanji>();
    const stats = {
      fetched: 0,
      mapped: 0,
      skipped: 0,
      failedPages: 0,
    };

    for (const level of LEVELS) {
      for (let page = 1; page <= MAX_PAGES_PER_LEVEL; page += 1) {
        const results = await this.fetchPage(level.query, page).catch((error) => {
          stats.failedPages += 1;
          console.warn(
            `⚠ Mazii request failed for ${level.level} page ${page}: ${
              error?.message || error
            }`,
          );
          return null;
        });

        if (!results || results.length === 0) break;

        stats.fetched += results.length;
        for (const item of results) {
          const mapped = this.mapResult(item, level.level);
          if (!mapped) {
            stats.skipped += 1;
            continue;
          }

          byKanji.set(mapped.kanji, mapped);
          stats.mapped += 1;
        }

        if (results.length < REQUEST_LIMIT) break;
        await this.delay(250);
      }
    }

    const now = new Date();
    const operations = [...byKanji.values()].map((item) => {
      const setPayload: Partial<MappedJlptKanji> & {
        updatedAt: Date;
      } = {
        mean: item.mean,
        level: item.level,
        examples: item.examples,
        isJlpt: true,
        isDeleted: false,
        updatedAt: now,
      };

      if (item.detail) setPayload.detail = item.detail;
      if (item.kun) setPayload.kun = item.kun;
      if (item.on) setPayload.on = item.on;
      if (item.stroke_count) setPayload.stroke_count = item.stroke_count;

      return {
        updateOne: {
          filter: { kanji: item.kanji },
          update: {
            $set: setPayload,
            $setOnInsert: {
              kanji: item.kanji,
              createdAt: now,
            },
          },
          upsert: true,
        },
      };
    });

    if (operations.length === 0) {
      console.log("No mapped JLPT kanji to upsert.");
      return;
    }

    const result = await this.jlptKanjiModel.bulkWrite(operations, {
      ordered: false,
    });

    console.log(
      [
        "✔ Mazii JLPT kanji seeding complete!",
        `Fetched: ${stats.fetched}`,
        `Mapped: ${stats.mapped}`,
        `Unique upserts: ${operations.length}`,
        `Inserted: ${result.upsertedCount || 0}`,
        `Modified: ${result.modifiedCount || 0}`,
        `Skipped: ${stats.skipped}`,
        `Failed pages: ${stats.failedPages}`,
      ].join("\n"),
    );
  }

  private async fetchPage(
    query: number,
    page: number,
  ): Promise<MaziiJlptKanjiResult[]> {
    const response = await fetch(MAZII_JLPT_KANJI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        language: "vi",
        limit: REQUEST_LIMIT,
        page,
        query,
      }),
    });

    if (!response.ok) {
      throw new Error(`Mazii returned HTTP ${response.status}`);
    }

    const body = (await response.json()) as {
      status?: number;
      results?: MaziiJlptKanjiResult[];
    };
    if (body.status && body.status !== 200) {
      throw new Error(`Mazii returned status ${body.status}`);
    }

    return Array.isArray(body.results) ? body.results : [];
  }

  private mapResult(
    item: MaziiJlptKanjiResult,
    fallbackLevel: MappedJlptKanji["level"],
  ): MappedJlptKanji | null {
    const kanji = this.toCleanString(item.kanji);
    const mean = this.toCleanString(item.mean);
    if (!kanji || !mean) return null;

    return {
      kanji,
      mean,
      detail: this.toCleanString(item.detail) || undefined,
      examples: this.mapExamples(item.examples),
      kun: this.toCleanString(item.kun) || undefined,
      on: this.toCleanString(item.on) || undefined,
      stroke_count: this.toCleanString(item.stroke_count) || undefined,
      level: this.toLevel(item.level || item.group) || fallbackLevel,
      isJlpt: true,
      isDeleted: false,
    };
  }

  private mapExamples(value: unknown): MappedJlptKanji["examples"] {
    if (!Array.isArray(value)) return [];

    return value
      .map((example: MaziiKanjiExample) => ({
        w: this.toCleanString(example?.w),
        m: this.toCleanString(example?.m),
        p: this.toCleanString(example?.p),
        h: this.toCleanString(example?.h),
      }))
      .filter((example) => example.w);
  }

  private toLevel(value: unknown): MappedJlptKanji["level"] | null {
    const normalized = this.toCleanString(value).replace(/^N/i, "");
    if (["5", "4", "3", "2", "1"].includes(normalized)) {
      return `N${normalized}` as MappedJlptKanji["level"];
    }

    return null;
  }

  private toCleanString(value: unknown) {
    return typeof value === "string" || typeof value === "number"
      ? String(value).trim()
      : "";
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
