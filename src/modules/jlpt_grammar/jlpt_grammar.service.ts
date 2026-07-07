import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { JlptGrammar } from "./schemas/jlpt_grammar.schema";
import { Model } from "mongoose";
import { CreateJlptGrammarDto } from "./dto/create-jlpt-grammar.dto";
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
export class JlptGrammarService {
  constructor(
    @InjectModel(JlptGrammar.name) private jlptGrammarModel: Model<JlptGrammar>
  ) {}

  async createJlptGrammar(data: CreateJlptGrammarDto): Promise<JlptGrammar> {
    try {
      // Kiểm tra tồn tại theo title
      const existing = await this.jlptGrammarModel.findOne({
        title: data.title,
      });
      if (existing) {
        throw new ConflictException("This grammar already exists");
      }

      const grammar = new this.jlptGrammarModel(data);
      return await grammar.save();
    } catch (error) {
      throw new BadRequestException(
        `Failed to create grammar: ${error.message}`
      );
    }
  }

  async getDetailGrammar(grammar: string): Promise<any> {
    if (!grammar || typeof grammar !== "string") {
      throw new BadRequestException("Invalid grammar parameter");
    }

    const result = await this.jlptGrammarModel
      .findOne({ title: grammar })
      .lean();
    if (!result) {
      throw new NotFoundException("This grammar does not exist");
    }
    return result;
  }

  async getJlptGrammarPaginated(
    page = 1,
    limit = 10,
    level?: string
  ): Promise<{
    data: {
      title: string;
      mean: string;
    }[];
    total: number;
    totalPages: number;
    currentPage: number;
  }> {
    try {
      const query: any = {};
      if (level) {
        query.level = level;
      }

      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.jlptGrammarModel
          .find(query, { title: 1, mean: 1 })
          .sort({ _id: 1 }) // sort ổn định để phân trang theo tuần không lặp/sót
          .skip(skip)
          .limit(limit)
          .lean(), // lean() giúp lấy plain object thay vì mongoose document
        this.jlptGrammarModel.countDocuments(query),
      ]);

      return {
        data,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get JLPT grammar: ${error.message}`
      );
    }
  }
  async getGrammarForAdmin(
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

      if (!includeDeleted) {
        filter.isDeleted = false;
      }

      if (safeLevel) {
        filter.level = safeLevel;
      }

      if (safeQuery) {
        filter.$or = [
          { title: { $regex: safeQuery, $options: "i" } },
          { mean: { $regex: safeQuery, $options: "i" } },
          { detail: { $regex: safeQuery, $options: "i" } },
          { examples: { $elemMatch: { $regex: safeQuery, $options: "i" } } },
        ];
      }

      const skip = (safePage - 1) * safeLimit;

      const [data, total] = await Promise.all([
        this.jlptGrammarModel
          .find(filter)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(safeLimit)
          .lean(),
        this.jlptGrammarModel.countDocuments(filter),
      ]);

      return {
        data,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
        currentPage: safePage,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get grammar for admin: ${error.message}`
      );
    }
  }
  async updateGrammar(id: string, data: Partial<CreateJlptGrammarDto>) {
    const updated = await this.jlptGrammarModel.findByIdAndUpdate(id, data, {
      new: true,
    });

    if (!updated) {
      throw new NotFoundException("Grammar not found");
    }

    return updated;
  }

  async getGrammarForAdminById(id: string) {
    const grammar = await this.jlptGrammarModel.findById(id).lean();
    if (!grammar) {
      throw new NotFoundException("Grammar not found");
    }

    return grammar;
  }

  async deleteGrammar(id: string) {
    const deleted = await this.jlptGrammarModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );

    if (!deleted) {
      throw new NotFoundException("Grammar not found");
    }

    return { message: "Deleted", id };
  }

  // Nhập hàng loạt từ file Excel: validate từng dòng, bỏ qua mẫu trùng title
  async bulkImportGrammar(items: any[]): Promise<ImportSummary> {
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
      key: String(raw?.title ?? "").trim(),
    }));
    const rawKeys = rawEntries.map((entry) => entry.key).filter(Boolean);
    const existingDocs = rawKeys.length
      ? await this.jlptGrammarModel
          .find({ title: { $in: rawKeys } }, { title: 1 })
          .lean()
      : [];
    const existingKeys = new Set(existingDocs.map((d) => d.title));

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
      if (key) candidate.title = key;
      const dto = plainToInstance(CreateJlptGrammarDto, candidate, {
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
          key: raw.title,
          reason,
        });
        addImportIssue(raw, "invalid", reason);
        continue;
      }

      const validatedKey = String(dto.title).trim();
      seenInBatch.add(validatedKey);
      validPayloads.push({
        row,
        key: validatedKey,
        payload: { ...dto, title: validatedKey },
        raw,
      });
    }

    if (validPayloads.length) {
      const toInsert = validPayloads.map((entry) => entry.payload);
      if (toInsert.length) {
        try {
          const inserted = await this.jlptGrammarModel.insertMany(toInsert, {
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
              key: we?.err?.op?.title,
              reason,
            });
          }
        }
      }
    }

    summary.errorReport = createImportErrorReport(
      "grammar_errors",
      GRAMMAR_EXCEL_COLUMNS,
      "jlpt-grammar-import-errors.xlsx",
      errorRows,
    );
    return summary;
  }

  async importGrammarExcel(file?: { buffer?: Buffer }) {
    if (!file?.buffer) {
      throw new BadRequestException("Excel file is required");
    }

    const rows = readFirstSheetRows(file.buffer);
    const items = rows.map(({ row, data }) => {
      const usages = parseJsonCell<any[]>(data.usages_json, []);
      const isJlpt = parseBooleanCell(data.isJlpt, true);
      const excelErrors = [
        !usages.ok ? `usages_json: ${usages.error}` : "",
        !isJlpt.ok ? isJlpt.error : "",
      ].filter(Boolean);

      return {
        __row: row,
        __rawData: data,
        __excelError: excelErrors.join("; ") || undefined,
        title: trimString(data.title),
        mean: trimString(data.mean),
        usages: usages.value,
        level: trimString(data.level).toUpperCase(),
        isJlpt: isJlpt.value,
      };
    });

    return this.bulkImportGrammar(items);
  }

  buildGrammarTemplateExcel(): ExcelFile {
    return createExcelFile(
      "grammar",
      GRAMMAR_EXCEL_COLUMNS,
      [
        {
          title: "～たことがある",
          mean: "Đã từng làm gì",
          usages_json: stringifyJson([
            {
              explain: "Dùng để nói về kinh nghiệm đã từng làm gì đó.",
              synopsis: "Vた + ことがある",
              examples: [
                {
                  content: "日本へ行ったことがあります。",
                  transcription: "にほんへいったことがあります。",
                  meaning: "Tôi đã từng đi Nhật.",
                },
              ],
            },
          ]),
          level: "N5",
          isJlpt: true,
        },
      ],
      "jlpt-grammar-template.xlsx",
    );
  }

  async exportGrammarExcel(): Promise<ExcelFile> {
    const grammar = await this.jlptGrammarModel
      .find({ isDeleted: { $ne: true } })
      .sort({ updatedAt: -1 })
      .lean();

    const rows = grammar.map((item: any) => ({
      title: item.title || "",
      mean: item.mean || "",
      usages_json: stringifyJson(item.usages || []),
      level: item.level || "",
      isJlpt: item.isJlpt ?? false,
    }));

    return createExcelFile(
      "grammar",
      GRAMMAR_EXCEL_COLUMNS,
      rows,
      "jlpt-grammar-export.xlsx",
    );
  }
}

const GRAMMAR_EXCEL_COLUMNS = [
  "title",
  "mean",
  "usages_json",
  "level",
  "isJlpt",
];
