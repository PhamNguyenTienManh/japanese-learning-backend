import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Exam, ExamStatus } from "../modules/exams/schemas/exams.schema";
import { ExamPart } from "../modules/exams_part/schema/exams_part.schema";
import { ExamQuestion } from "../modules/exam_question/schemas/exam_question.schema";

type MaziiExamResponse = {
  data?: MaziiExam;
};

type MaziiExam = {
  id?: unknown;
  title?: unknown;
  parts?: MaziiExamPart[];
  score?: unknown;
  pass_score?: unknown;
};

type MaziiExamPart = {
  name?: unknown;
  time?: unknown;
  min_score?: unknown;
  max_score?: unknown;
  content?: MaziiQuestionGroup[];
};

type MaziiQuestionGroup = {
  kind?: unknown;
  Questions?: MaziiQuestion[];
};

type MaziiQuestion = {
  title?: unknown;
  kind?: unknown;
  level?: unknown;
  count_question?: unknown;
  general?: Record<string, unknown>;
  content?: MaziiQuestionContent[];
  correct_answers?: unknown;
  score_difficult?: unknown;
  scores?: unknown;
};

type MaziiQuestionContent = {
  question?: unknown;
  answers?: unknown;
  correctAnswer?: unknown;
  explain?: unknown;
  explain_vn?: unknown;
  image?: unknown;
  explainAll?: unknown;
};

const DEFAULT_MAZII_EXAM_ID = 739;
const MAZII_EXAM_URL = "https://v2.migii.net/mazii/exam";
const VALID_LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;
type ExamLevel = (typeof VALID_LEVELS)[number];
const DEFAULT_LEVEL: ExamLevel = "N5";

const PART_NAME_MAP = new Map<string, "Từ vựng" | "Ngữ pháp - Đọc hiểu" | "Thi nghe">([
  ["文字・語彙", "Từ vựng"],
  ["文法・読解", "Ngữ pháp - Đọc hiểu"],
  ["聴解", "Thi nghe"],
]);

@Injectable()
export class ExamMaziiSeeder {
  constructor(
    @InjectModel(Exam.name)
    private readonly examModel: Model<Exam>,
    @InjectModel(ExamPart.name)
    private readonly examPartModel: Model<ExamPart>,
    @InjectModel(ExamQuestion.name)
    private readonly examQuestionModel: Model<ExamQuestion>,
  ) {}

  async run(examId = DEFAULT_MAZII_EXAM_ID, levelInput: unknown = DEFAULT_LEVEL) {
    if (!Number.isInteger(examId) || examId <= 0) {
      throw new Error("Mazii exam id must be a positive integer.");
    }
    const level = this.toLevel(levelInput);
    if (!level) {
      throw new Error(`Exam level must be one of: ${VALID_LEVELS.join(", ")}.`);
    }

    console.log(`🚀 Seeding exam from Mazii API. Exam ID: ${examId}, Level: ${level}`);

    const maziiExam = await this.fetchExam(examId);
    const title = this.toCleanString(maziiExam.title) || `Test ${examId}`;

    const exam = await this.examModel
      .findOneAndUpdate(
        { maziiExamId: examId },
        {
          $set: {
            title,
            level,
            score: this.toNumber(maziiExam.score, 180),
            pass_score: this.toNumber(maziiExam.pass_score, 80),
            status: ExamStatus.PUBLIC,
            maziiExamId: examId,
          },
        },
        { new: true, setDefaultsOnInsert: true, upsert: true },
      )
      .exec();

    const savedExamId = exam._id as Types.ObjectId;
    await this.replaceExamPartsAndQuestions(savedExamId, examId, maziiExam.parts || []);
  }

  private async fetchExam(examId: number): Promise<MaziiExam> {
    const response = await fetch(`${MAZII_EXAM_URL}/${examId}?language=vn`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Mazii returned HTTP ${response.status}`);
    }

    const body = (await response.json()) as MaziiExamResponse;
    if (!body.data) {
      throw new Error("Mazii response does not contain exam data.");
    }

    return body.data;
  }

  private async replaceExamPartsAndQuestions(
    examId: Types.ObjectId,
    maziiExamId: number,
    parts: MaziiExamPart[],
  ) {
    const oldParts = await this.examPartModel
      .find({ examId })
      .select("_id")
      .lean()
      .exec();
    const oldPartIds = oldParts.map((part) => part._id);

    if (oldPartIds.length > 0) {
      await this.examQuestionModel
        .deleteMany({ partId: { $in: oldPartIds } })
        .exec();
    }
    await this.examPartModel.deleteMany({ examId }).exec();

    let createdPartCount = 0;
    let createdQuestionCount = 0;

    for (const part of parts) {
      const mappedPartName = this.mapPartName(part.name);
      if (!mappedPartName) {
        console.warn(`⚠ Skipping unsupported Mazii part: ${this.toCleanString(part.name)}`);
        continue;
      }

      const createdPart = await this.examPartModel.create({
        examId,
        name: mappedPartName,
        time: this.toNumber(part.time, 1),
        min_score: this.toNumber(part.min_score, 0),
        max_score: this.toNumber(part.max_score, 0),
      });
      createdPartCount += 1;

      const questions = this.mapQuestions(createdPart._id as Types.ObjectId, part.content || []);
      if (questions.length === 0) continue;

      await this.examQuestionModel.insertMany(questions, { ordered: false });
      createdQuestionCount += questions.length;
    }

    console.log(
      [
        "✔ Mazii exam seeding complete!",
        `Mazii exam ID: ${maziiExamId}`,
        `Mongo exam ID: ${examId.toString()}`,
        `Parts: ${createdPartCount}`,
        `Questions: ${createdQuestionCount}`,
      ].join("\n"),
    );
  }

  private mapQuestions(partId: Types.ObjectId, groups: MaziiQuestionGroup[]) {
    return groups.flatMap((group) => {
      const fallbackKind = this.toCleanString(group.kind);
      const questions = Array.isArray(group.Questions) ? group.Questions : [];

      return questions.map((question) => {
        const title = this.toCleanString(question.title);
        const content = this.mapQuestionContent(question.content || [], title);
        const scores = this.toNumberArray(question.scores);
        const correctAnswers = this.toNumberArray(question.correct_answers);

        return {
          partId,
          title,
          kind: this.toCleanString(question.kind) || fallbackKind,
          level: this.toNumber(question.level, 5),
          count_question: this.toNumber(question.count_question, content.length || 1),
          general: this.mapGeneral(question.general || {}),
          content,
          correct_answers: correctAnswers,
          score_difficult: this.toNumber(question.score_difficult, 0),
          scores,
        };
      });
    });
  }

  private mapGeneral(general: Record<string, unknown>) {
    const txtRead =
      this.toCleanString(general.txt_read) ||
      this.toCleanString(general.text_read_vn);

    return {
      audio: this.toCleanString(general.audio),
      image: this.toCleanString(general.image),
      txt_read: txtRead,
      audios: this.mapAudios(general.audios),
    };
  }

  private mapAudios(value: unknown) {
    const values = Array.isArray(value) ? value : value ? [value] : [];

    return values.map((item) => {
      const audioTime =
        typeof item === "object" && item !== null
          ? this.toNullableNumber((item as { audio_time?: unknown }).audio_time)
          : this.toNullableNumber(item);

      return { audio_time: audioTime };
    });
  }

  private mapQuestionContent(contents: MaziiQuestionContent[], fallbackQuestion: string) {
    return contents.map((item) => {
      const question = this.toCleanString(item.question) || fallbackQuestion;
      const explain = this.toCleanString(item.explain_vn) || this.toCleanString(item.explain);
      const explainAll = this.mapExplainAll(item.explainAll) || explain;

      return {
        question,
        answers: this.toStringArray(item.answers),
        correctAnswer: this.toNumber(item.correctAnswer, 0),
        explain,
        image: this.toCleanString(item.image),
        explainAll,
      };
    });
  }

  private mapExplainAll(value: unknown) {
    if (typeof value === "object" && value !== null) {
      const localized = value as { vn?: unknown; en?: unknown };
      return this.toCleanString(localized.vn) || this.toCleanString(localized.en);
    }

    return this.toCleanString(value);
  }

  private mapPartName(value: unknown) {
    const name = this.toCleanString(value);
    return PART_NAME_MAP.get(name);
  }

  private toStringArray(value: unknown) {
    return Array.isArray(value)
      ? value.map((item) => this.toCleanString(item)).filter(Boolean)
      : [];
  }

  private toNumberArray(value: unknown) {
    return Array.isArray(value)
      ? value
          .map((item) => this.toNullableNumber(item))
          .filter((item): item is number => item !== null)
      : [];
  }

  private toNumber(value: unknown, fallback: number) {
    const parsed = this.toNullableNumber(value);
    return parsed ?? fallback;
  }

  private toNullableNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }

    return null;
  }

  private toCleanString(value: unknown) {
    return typeof value === "string" || typeof value === "number"
      ? String(value).trim()
      : "";
  }

  private toLevel(value: unknown): ExamLevel | null {
    const normalized = this.toCleanString(value).toUpperCase();
    return VALID_LEVELS.includes(normalized as ExamLevel)
      ? (normalized as ExamLevel)
      : null;
  }
}
