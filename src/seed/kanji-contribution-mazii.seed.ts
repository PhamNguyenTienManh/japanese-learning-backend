import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Contribution, ContributionDocument } from "../modules/contribution/schemas/contribution.schema";
import { JlptKanji } from "../modules/jlpt_kanji/schemas/jlpt_kanji.schema";
import { Profile } from "../modules/profiles/schemas/profiles.schema";

type KanjiSeedDocument = {
  _id: Types.ObjectId;
  kanji?: unknown;
  mobileId?: unknown;
  wordId?: unknown;
  maziiId?: unknown;
  id?: unknown;
};

type MaziiKanjiSearchResult = {
  kanji?: unknown;
  mobileId?: unknown;
  wordId?: unknown;
  id?: unknown;
};

type MaziiContributionResult = {
  mean?: unknown;
  wordId?: unknown;
  word?: unknown;
  type_data?: unknown;
  dict?: unknown;
};

type ProfileIdDocument = {
  _id: Types.ObjectId;
};

const MAZII_GET_MEAN_URL = "https://api.mazii.net/api/get-mean";
const MAZII_SEARCH_KANJI_URL = "https://mazii.net/api/search/kanji";
const MAZII_TOKEN = "67a52195686f08c66a19d122f9bca902";
const REQUEST_DELAY_MS = 200;
const BULK_SIZE = 500;

@Injectable()
export class KanjiContributionMaziiSeeder {
  constructor(
    @InjectModel(Contribution.name)
    private readonly contributionModel: Model<ContributionDocument>,
    @InjectModel(JlptKanji.name)
    private readonly jlptKanjiModel: Model<JlptKanji>,
    @InjectModel(Profile.name)
    private readonly profileModel: Model<Profile>,
  ) {}

  async run() {
    console.log("Seeding kanji contributions from Mazii get-mean API...");

    const profileIds = await this.getProfileIds();
    const kanjiDocs = await this.jlptKanjiModel
      .find({ isDeleted: { $ne: true } })
      .select({
        kanji: 1,
        mobileId: 1,
        wordId: 1,
        maziiId: 1,
        id: 1,
      })
      .lean<KanjiSeedDocument[]>();

    const stats = {
      kanjiTotal: kanjiDocs.length,
      resolvedWordIds: 0,
      missingWordIds: 0,
      fetchedComments: 0,
      mappedComments: 0,
      inserted: 0,
      modified: 0,
      skipped: 0,
      failed: 0,
    };

    const operations: any[] = [];

    for (const kanjiDoc of kanjiDocs) {
      const kanji = this.toCleanString(kanjiDoc.kanji);
      if (!kanji) {
        stats.skipped += 1;
        continue;
      }

      const wordId =
        this.extractWordId(kanjiDoc) || (await this.resolveWordId(kanji));

      if (!wordId) {
        stats.missingWordIds += 1;
        console.warn(`Skip ${kanji}: cannot resolve Mazii wordId`);
        continue;
      }

      stats.resolvedWordIds += 1;

      try {
        const comments = await this.fetchContributions(kanji, wordId);
        stats.fetchedComments += comments.length;

        for (const comment of comments) {
          const content = this.toCleanString(comment.mean);
          if (!content) {
            stats.skipped += 1;
            continue;
          }

          stats.mappedComments += 1;
          const profileId = this.pickRandomProfileId(profileIds);
          operations.push({
            updateOne: {
              filter: {
                kanjiId: String(kanjiDoc._id),
                content,
              },
              update: {
                $set: {
                  profileId,
                  kanjiId: String(kanjiDoc._id),
                  content,
                },
              },
              upsert: true,
            },
          });

          if (operations.length >= BULK_SIZE) {
            const result = await this.flush(operations);
            stats.inserted += result.inserted;
            stats.modified += result.modified;
          }
        }
      } catch (error) {
        stats.failed += 1;
        console.warn(
          `Failed to seed contributions for ${kanji} (${wordId}): ${
            error?.message || error
          }`,
        );
      }

      await this.delay(REQUEST_DELAY_MS);
    }

    const result = await this.flush(operations);
    stats.inserted += result.inserted;
    stats.modified += result.modified;

    console.log(
      [
        "Kanji contribution seeding complete.",
        `Kanji total: ${stats.kanjiTotal}`,
        `Resolved wordIds: ${stats.resolvedWordIds}`,
        `Missing wordIds: ${stats.missingWordIds}`,
        `Fetched comments: ${stats.fetchedComments}`,
        `Mapped comments: ${stats.mappedComments}`,
        `Inserted: ${stats.inserted}`,
        `Modified: ${stats.modified}`,
        `Skipped: ${stats.skipped}`,
        `Failed kanji: ${stats.failed}`,
      ].join("\n"),
    );
  }

  private async getProfileIds() {
    const profiles = await this.profileModel
      .find({})
      .select({ _id: 1 })
      .lean<ProfileIdDocument[]>();

    const profileIds = profiles.map((profile) => profile._id);
    if (profileIds.length === 0) {
      throw new Error("Cannot seed contributions because profiles collection is empty");
    }

    return profileIds;
  }

  private pickRandomProfileId(profileIds: Types.ObjectId[]) {
    const index = Math.floor(Math.random() * profileIds.length);
    return profileIds[index];
  }

  private async resolveWordId(kanji: string) {
    const response = await fetch(MAZII_SEARCH_KANJI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        dict: "javi",
        type: "kanji",
        query: kanji,
        page: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Mazii search returned HTTP ${response.status}`);
    }

    const body = (await response.json()) as {
      results?: MaziiKanjiSearchResult[];
    };
    const results = Array.isArray(body.results) ? body.results : [];
    const match =
      results.find((item) => this.toCleanString(item.kanji) === kanji) ||
      results[0];

    return match ? this.extractWordId(match) : "";
  }

  private async fetchContributions(kanji: string, wordId: string) {
    const response = await fetch(MAZII_GET_MEAN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        dict: "javi",
        token: MAZII_TOKEN,
        type: "kanji",
        word: kanji,
        wordId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Mazii get-mean returned HTTP ${response.status}`);
    }

    const body = (await response.json()) as {
      result?: MaziiContributionResult[];
    };
    const results = Array.isArray(body.result) ? body.result : [];

    return results.filter((item) => {
      const dict = this.toCleanString(item.dict);
      const typeData = this.toCleanString(item.type_data);
      return (!dict || dict === "javi") && (!typeData || typeData === "kanji");
    });
  }

  private extractWordId(source: Record<string, unknown>) {
    for (const key of ["mobileId", "wordId", "maziiId", "id"]) {
      const value = this.toCleanString(source[key]);
      if (/^\d+$/.test(value)) return value;
    }

    return "";
  }

  private async flush(operations: any[]) {
    if (operations.length === 0) {
      return { inserted: 0, modified: 0 };
    }

    const batch = operations.splice(0, operations.length);
    const result = await this.contributionModel.bulkWrite(batch, {
      ordered: false,
    });

    return {
      inserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
    };
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
