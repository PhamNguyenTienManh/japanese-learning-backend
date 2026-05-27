import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { JlptWord } from "../modules/jlpt_word/schemas/jlpt_word.schema";

type MaziiJlptResult = {
  word?: unknown;
  phonetic?: unknown;
  mean?: unknown;
  group?: unknown;
};

type MappedJlptWord = {
  word: string;
  phonetic: string[];
  meanings: { meaning: string; examples: never[] }[];
  level: "N5" | "N4" | "N3" | "N2" | "N1";
  isJlpt: true;
  isDeleted: false;
};

const MAZII_JLPT_URL = "https://mazii.net/api/jlpt";
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
export class JlptWordMaziiSeeder {
  constructor(
    @InjectModel(JlptWord.name)
    private readonly jlptWordModel: Model<JlptWord>,
  ) {}

  async run() {
    console.log("🚀 Seeding JLPT words from Mazii API...");

    const byWord = new Map<string, MappedJlptWord>();
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

          byWord.set(mapped.word, mapped);
          stats.mapped += 1;
        }

        if (results.length < REQUEST_LIMIT) break;
        await this.delay(250);
      }
    }

    const now = new Date();
    const operations = [...byWord.values()].map((item) => ({
      updateOne: {
        filter: { word: item.word },
        update: {
          $set: {
            phonetic: item.phonetic,
            meanings: item.meanings,
            level: item.level,
            isJlpt: true,
            isDeleted: false,
            updatedAt: now,
          },
          $setOnInsert: {
            word: item.word,
            type: null,
            createdAt: now,
          },
        },
        upsert: true,
      },
    }));

    if (operations.length === 0) {
      console.log("No mapped JLPT words to upsert.");
      return;
    }

    const result = await this.jlptWordModel.bulkWrite(operations, {
      ordered: false,
    });

    console.log(
      [
        "✔ Mazii JLPT word seeding complete!",
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

  private async fetchPage(query: number, page: number): Promise<MaziiJlptResult[]> {
    const response = await fetch(MAZII_JLPT_URL, {
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
      results?: MaziiJlptResult[];
    };
    if (body.status && body.status !== 200) {
      throw new Error(`Mazii returned status ${body.status}`);
    }

    return Array.isArray(body.results) ? body.results : [];
  }

  private mapResult(
    item: MaziiJlptResult,
    level: MappedJlptWord["level"],
  ): MappedJlptWord | null {
    const word = this.toCleanString(item.word);
    const mean = this.toCleanString(item.mean);
    if (!word || !mean) return null;

    const phonetic = [
      ...new Set(
        this.toCleanString(item.phonetic)
          .split(/\s+/)
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    const meanings = mean
      .split(";")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((meaning) => ({ meaning, examples: [] }));

    if (meanings.length === 0) return null;

    return {
      word,
      phonetic,
      meanings,
      level,
      isJlpt: true,
      isDeleted: false,
    };
  }

  private toCleanString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
