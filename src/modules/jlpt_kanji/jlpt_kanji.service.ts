import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { JlptKanji } from "./schemas/jlpt_kanji.schema";
import { Model } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";
import { CreateJlptKanjiDto } from "./dto/create-jlpt-kanji.dto";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  createExcelFile,
  createImportErrorReport,
  ExcelFile,
  ImportErrorReport,
  ImportErrorReportRow,
  parseBooleanCell,
  parseJsonCell,
  normalizeMultilineText,
  escapeMultilineTextForExcel,
  readFirstSheetRows,
  stringifyJson,
  trimString,
} from "../dictionary-excel/dictionary-excel.util";

export interface ImportSummary {
  total: number;
  inserted: number;
  skipped: number;
  invalid: number;
  errors: { row?: number; key?: string; reason: string }[];
  errorReport?: ImportErrorReport;
}

function flattenValidationErrors(errors: any[]): string {
  const messages: string[] = [];
  for (const err of errors) {
    if (err.constraints) {
      messages.push(...Object.values(err.constraints).map((m) => String(m)));
    }
    if (err.children && err.children.length) {
      messages.push(flattenValidationErrors(err.children));
    }
  }
  return messages.filter(Boolean).join("; ");
}

@Injectable()
export class JlptKanjiService {
  constructor(
    @InjectModel(JlptKanji.name) private jlptKanjiModel: Model<JlptKanji>
  ) {}

  async createJlptKanji(data: CreateJlptKanjiDto): Promise<JlptKanji> {
    try {
      const payload = this.normalizeKanjiPayload(data);
      // kiểm tra tồn tại
      const existing = await this.jlptKanjiModel.findOne({ kanji: payload.kanji });
      if (existing) {
        throw new ConflictException("This kanji already exists");
      }

      const kanji = new this.jlptKanjiModel(payload);
      return await kanji.save();
    } catch (error) {
      throw new BadRequestException(`Failed to create kanji: ${error.message}`);
    }
  }

  async getDetailKanji(kanji: string): Promise<any> {
    if (!kanji || typeof kanji !== "string") {
      throw new BadRequestException("Invalid word parameter");
    }

    const result = await this.jlptKanjiModel
      .findOne({ kanji: kanji.trim(), isDeleted: { $ne: true } })
      .lean();
    if (!result) {
      throw new NotFoundException("This word does not exist");
    }

    return this.normalizeKanjiDocument(result);
  }

  async searchJlptKanji(q = "", limit = 20) {
    try {
      const safeQuery = String(q || "").trim();
      const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);

      if (!safeQuery) {
        return {
          data: [],
          total: 0,
          totalPages: 0,
          currentPage: 1,
        };
      }

      const regex = new RegExp(this.escapeRegex(safeQuery), "i");
      const publicFilter = { isDeleted: { $ne: true } };
      const projection = {
        kanji: 1,
        mean: 1,
        detail: 1,
        examples: 1,
        example_kun: 1,
        example_on: 1,
        kun: 1,
        on: 1,
        stroke_count: 1,
        level: 1,
      };
      const searchFilter: any = {
        ...publicFilter,
        $or: [
          { kanji: regex },
          { mean: regex },
        ],
      };

      const exactMatch = await this.jlptKanjiModel
        .findOne({ ...publicFilter, kanji: safeQuery }, projection)
        .lean();
      const remainingLimit = exactMatch ? safeLimit - 1 : safeLimit;
      const [data, total] = await Promise.all([
        remainingLimit > 0
          ? this.jlptKanjiModel
              .find(
                exactMatch
                  ? { ...searchFilter, _id: { $ne: exactMatch._id } }
                  : searchFilter,
                projection
              )
              .sort({ level: 1, kanji: 1 })
              .limit(remainingLimit)
              .lean()
          : Promise.resolve([]),
        this.jlptKanjiModel.countDocuments(searchFilter),
      ]);

      const results = exactMatch ? [exactMatch, ...data] : data;

      return {
        data: results,
        total,
        totalPages: Math.ceil(total / safeLimit),
        currentPage: 1,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to search JLPT kanji: ${error.message}`
      );
    }
  }

  async getJlptKanjiPaginated(page = 1, limit = 10, level?: string) {
    try {
      const query: any = { isDeleted: { $ne: true } };
      if (level) query.level = level;
      const skip = (page - 1) * limit;
      const [data, total] = await Promise.all([
        this.jlptKanjiModel
          .find(query, { kanji: 1, mean: 1, kun: 1, on: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),

        this.jlptKanjiModel.countDocuments(query),
      ]);

      const formatted = data.map((k) => ({
        kanji: k.kanji,
        mean: k.mean,
        reading: `${k.kun || ""} ${k.on || ""}`.trim(),
      }));

      return {
        data: formatted,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get JLPT kanji: ${error.message}`
      );
    }
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  async getJlptKanjiForAdmin(
    page = 1,
    limit = 20,
    level?: string,
    q?: string,
    includeDeleted = true
  ) {
    try {
      const safePage = Math.max(Number(page) || 1, 1);
      const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
      const safeLevel = level && level !== "all" ? level : "";
      const safeQuery = q ? String(q).trim() : "";
      const filter: any = {};

      if (!includeDeleted) filter.isDeleted = false;
      if (safeLevel) filter.level = safeLevel;

      if (safeQuery) {
        filter.$or = [
          { kanji: { $regex: safeQuery, $options: "i" } },
          { mean: { $regex: safeQuery, $options: "i" } },
          { detail: { $regex: safeQuery, $options: "i" } },
          { kun: { $elemMatch: { $regex: safeQuery, $options: "i" } } },
          { on: { $elemMatch: { $regex: safeQuery, $options: "i" } } },
        ];
      }

      const skip = (safePage - 1) * safeLimit;

      const [data, total] = await Promise.all([
        this.jlptKanjiModel
          .find(filter)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(safeLimit)
          .lean(),
        this.jlptKanjiModel.countDocuments(filter),
      ]);

      return {
        data,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
        currentPage: safePage,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get kanji for admin: ${error.message}`
      );
    }
  }
  async updateJlptKanji(id: string, data: Partial<CreateJlptKanjiDto>) {
    const updated = await this.jlptKanjiModel.findByIdAndUpdate(
      id,
      this.normalizeKanjiPayload(data),
      {
        new: true,
      },
    );

    if (!updated) {
      throw new NotFoundException("Kanji not found");
    }

    return updated;
  }

  async getJlptKanjiForAdminById(id: string) {
    const kanji = await this.jlptKanjiModel.findById(id).lean();
    if (!kanji) {
      throw new NotFoundException("Kanji not found");
    }

    return this.normalizeKanjiDocument(kanji);
  }

  async deleteJlptKanji(id: string) {
    const deleted = await this.jlptKanjiModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );

    if (!deleted) {
      throw new NotFoundException("Kanji not found");
    }

    return { message: "Deleted", id };
  }

  // Nhập hàng loạt từ file Excel: validate từng dòng, bỏ qua kanji trùng
  async bulkImportKanji(items: any[]): Promise<ImportSummary> {
    if (!Array.isArray(items)) {
      throw new BadRequestException("Payload must be an array");
    }

    const summary: ImportSummary = {
      total: items.length,
      inserted: 0,
      skipped: 0,
      invalid: 0,
      errors: [],
    };

    const errorRows: ImportErrorReportRow[] = [];
    const addImportIssue = (
      raw: any,
      status: "skipped" | "invalid",
      reason: string,
    ) => {
      errorRows.push({
        raw: raw?.__rawData || raw || {},
        status,
        reason,
      });
    };

    const rawEntries = items.map((raw, index) => ({
      raw: raw || {},
      row: Number(raw?.__row) || index + 1,
      key: String(raw?.kanji ?? "").trim(),
    }));
    const rawKeys = rawEntries.map((entry) => entry.key).filter(Boolean);
    const existingDocs = rawKeys.length
      ? await this.jlptKanjiModel
          .find({ kanji: { $in: rawKeys } }, { kanji: 1 })
          .lean()
      : [];
    const existingKeys = new Set(existingDocs.map((d) => d.kanji));

    const validPayloads: any[] = [];
    const seenInBatch = new Set<string>();

    for (const entry of rawEntries) {
      const { raw, row } = entry;
      const key = entry.key;

      if (key && existingKeys.has(key)) {
        summary.skipped++;
        summary.errors.push({
          row,
          key,
          reason: "Đã tồn tại trong hệ thống",
        });
        continue;
      }

      if (key && seenInBatch.has(key)) {
        summary.skipped++;
        summary.errors.push({ row, key, reason: "Trùng trong file" });
        continue;
      }

      const { __row, __rawData, __excelError, ...candidate } = raw;
      if (key) candidate.kanji = key;
      const dto = plainToInstance(CreateJlptKanjiDto, candidate, {
        enableImplicitConversion: false,
      });
      const validationErrors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: false,
      });

      const reasons = [
        raw.__excelError || "",
        validationErrors.length ? flattenValidationErrors(validationErrors) : "",
      ].filter(Boolean);

      if (reasons.length) {
        const reason = reasons.join("; ");
        summary.invalid++;
        summary.errors.push({
          row,
          key: raw.kanji,
          reason,
        });
        addImportIssue(raw, "invalid", reason);
        continue;
      }

      const validatedKey = String(dto.kanji).trim();
      seenInBatch.add(validatedKey);
      validPayloads.push({
        row,
        key: validatedKey,
        payload: this.normalizeKanjiPayload({ ...dto, kanji: validatedKey }),
        raw,
      });
    }

    if (validPayloads.length) {
      const toInsert = validPayloads.map((entry) => entry.payload);
      if (toInsert.length) {
        try {
          const inserted = await this.jlptKanjiModel.insertMany(toInsert, {
            ordered: false,
          });
          summary.inserted = inserted.length;
        } catch (error: any) {
          summary.inserted =
            error?.result?.nInserted ?? error?.insertedDocs?.length ?? 0;
          const writeErrors = error?.writeErrors || [];
          summary.skipped += writeErrors.length;
          for (const we of writeErrors) {
            const failedEntry = validPayloads[we?.index];
            const reason = "Trùng khoá khi ghi";
            summary.errors.push({
              row: failedEntry?.row,
              key: we?.err?.op?.kanji,
              reason,
            });
          }
        }
      }
    }

    summary.errorReport = createImportErrorReport(
      "kanji_errors",
      KANJI_EXCEL_COLUMNS,
      "jlpt-kanji-import-errors.xlsx",
      errorRows,
    );
    return summary;
  }

  async importKanjiExcel(file?: { buffer?: Buffer }) {
    if (!file?.buffer) {
      throw new BadRequestException("Excel file is required");
    }

    const rows = readFirstSheetRows(file.buffer);
    const items = rows.map(({ row, data }) => {
      const examples = parseJsonCell<any[]>(data.examples_json, []);
      const isJlpt = parseBooleanCell(data.isJlpt, true);
      const strokeCount = trimString(data.stroke_count);
      const jsonErrors = [
        !examples.ok ? `examples_json: ${examples.error}` : "",
        !isJlpt.ok ? isJlpt.error : "",
        strokeCount && !/^[1-9]\d*$/.test(strokeCount)
          ? "stroke_count phải là số nguyên dương"
          : "",
      ].filter(Boolean);

      return {
        __row: row,
        __rawData: data,
        __excelError: jsonErrors.join("; ") || undefined,
        kanji: trimString(data.kanji),
        mean: trimString(data.mean),
        detail: normalizeMultilineText(data.detail),
        kun: trimString(data.kun),
        on: trimString(data.on),
        stroke_count: strokeCount,
        examples: examples.value,
        level: trimString(data.level).toUpperCase(),
        isJlpt: isJlpt.value,
      };
    });

    return this.bulkImportKanji(items);
  }

  buildKanjiTemplateExcel(): ExcelFile {
    return createExcelFile(
      "kanji",
      KANJI_EXCEL_COLUMNS,
      [
        {
          kanji: "日",
          mean: "Mặt trời, ngày",
          detail:
            "1. mặt trời\\nVD: 日光 (ánh sáng mặt trời)\\n2. ngày\\nVD: 平日 (ngày thường)",
          kun: "ひ, か",
          on: "ニチ, ジツ",
          stroke_count: "4",
          examples_json: stringifyJson([
            { w: "日本", m: "Nhật Bản", p: "にほん", h: "Nhật Bản" },
          ]),
          level: "N5",
          isJlpt: true,
        },
      ],
      "jlpt-kanji-template.xlsx",
    );
  }

  async exportKanjiExcel(): Promise<ExcelFile> {
    const kanji = await this.jlptKanjiModel
      .find({ isDeleted: { $ne: true } })
      .sort({ updatedAt: -1 })
      .lean();

    const rows = kanji.map((item: any) => ({
      kanji: item.kanji || "",
      mean: item.mean || "",
      detail: escapeMultilineTextForExcel(item.detail),
      kun: item.kun || "",
      on: item.on || "",
      stroke_count: item.stroke_count || "",
      examples_json: stringifyJson(item.examples || []),
      level: item.level || "",
      isJlpt: item.isJlpt ?? false,
    }));

    return createExcelFile(
      "kanji",
      KANJI_EXCEL_COLUMNS,
      rows,
      "jlpt-kanji-export.xlsx",
    );
  }

  private normalizeKanjiPayload<T extends Partial<CreateJlptKanjiDto>>(data: T): T {
    const payload: any = { ...data };
    if ("detail" in payload) {
      payload.detail = normalizeMultilineText(payload.detail);
    }
    return payload;
  }

  private normalizeKanjiDocument<T extends { detail?: any }>(doc: T): T {
    return {
      ...doc,
      detail: normalizeMultilineText(doc.detail),
    };
  }
}

const KANJI_EXCEL_COLUMNS = [
  "kanji",
  "mean",
  "detail",
  "kun",
  "on",
  "stroke_count",
  "examples_json",
  "level",
  "isJlpt",
];
