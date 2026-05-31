import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { JlptWord } from "./schemas/jlpt_word.schema";
import { Model } from "mongoose";
import { CreateJlptWordDto } from "./dto/create-jlpt-word.dto";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  createExcelFile,
  createImportErrorReport,
  ExcelFile,
  ImportErrorReport,
  ImportErrorReportRow,
  optionalString,
  parseBooleanCell,
  parseCommaList,
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
export class JlptWordService {
  constructor(
    @InjectModel(JlptWord.name) private jlptWordModel: Model<JlptWord>
  ) {}

  //Hàm tạo JlptWord
  async createJlptWord(
    createJlptWordDto: CreateJlptWordDto
  ): Promise<JlptWord> {
    try {
      const payload: any = { ...createJlptWordDto };
      if (payload.type === "") payload.type = null;

      const existing = await this.jlptWordModel.findOne({
        word: payload.word,
      });
      if (existing) {
        throw new ConflictException("This word already exists");
      }
      const jlpt_word = new this.jlptWordModel(payload);
      return await jlpt_word.save();
    } catch (error) {
      throw new BadRequestException(`Failed to create word: ${error.message}`);
    }
  }

  async getDetailWord(word: string): Promise<any> {
    if (!word || typeof word !== "string") {
      throw new BadRequestException("Invalid word parameter");
    }

    const result = await this.jlptWordModel.findOne({ word }).lean();
    if (!result) {
      throw new NotFoundException("This word does not exist");
    }

    return result;
  }

  async getJlptWordsPaginated(
    page = 1,
    limit = 10,
    level?: string
  ): Promise<{
    data: {
      word: string;
      phonetic: string;
      meanings: string;
    }[];
    total: number;
    totalPages: number;
    currentPage: number;
  }> {
    try {
      const query: any = { isJlpt: true };
      if (level) {
        query.level = level;
      }

      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.jlptWordModel
          .find(query, { word: 1, phonetic: 1, meanings: 1 })
          .skip(skip)
          .limit(limit)
          .lean(), // lean() giúp lấy plain object thay vì mongoose document
        this.jlptWordModel.countDocuments(query),
      ]);

      const formattedData = data.map((item) => ({
        word: item.word,
        phonetic: (item.phonetic || []).join(" "),
        meanings: (item.meanings || []).map((m) => m.meaning).join(", "),
      }));

      return {
        data: formattedData,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get JLPT words: ${error.message}`
      );
    }
  }

  async getJlptWordsForAdmin(
    page = 1,
    limit = 20,
    level?: string,
    q?: string,
    includeDeleted = true
  ): Promise<{
    data: JlptWord[];
    total: number;
    totalPages: number;
    currentPage: number;
  }> {
    try {
      const safePage = Math.max(Number(page) || 1, 1);
      const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
      const safeLevel = level && level !== "all" ? level : "";
      const filter: any = {};
      // admin wants JLPT items only? nếu cần, giữ isJlpt true (giữ giống trước)
      filter.isJlpt = true;

      if (!includeDeleted) {
        filter.isDeleted = false;
      } // else includeDeleted=true -> no filter on isDeleted

      if (safeLevel) {
        filter.level = safeLevel;
      }

      if (q && String(q).trim()) {
        const qq = String(q).trim();
        filter.$or = [
          { word: { $regex: qq, $options: "i" } },
          { phonetic: { $elemMatch: { $regex: qq, $options: "i" } } },
          { "meanings.meaning": { $regex: qq, $options: "i" } }, // search inside meanings array of objects
          { type: { $regex: qq, $options: "i" } },
        ];
      }

      const skip = (safePage - 1) * safeLimit;

      const [items, total] = await Promise.all([
        this.jlptWordModel
          .find(filter)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(safeLimit)
          .lean(),
        this.jlptWordModel.countDocuments(filter),
      ]);

      return {
        data: items as unknown as JlptWord[],
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
        currentPage: safePage,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get JLPT words for admin: ${error.message}`
      );
    }
  }

  async updateJlptWord(id: string, data: Partial<CreateJlptWordDto>) {
    // normalize meanings if provided as string or array of strings
    const payload: any = { ...data };
    if (payload.meanings) {
      // if string -> split to array of objects
      if (typeof payload.meanings === "string") {
        payload.meanings = payload.meanings
          .split(",")
          .map((s) => ({ meaning: s.trim() }))
          .filter((m) => m.meaning);
      } else if (
        Array.isArray(payload.meanings) &&
        payload.meanings.length > 0
      ) {
        // if array of strings -> convert
        if (typeof payload.meanings[0] === "string") {
          payload.meanings = payload.meanings.map((s) => ({
            meaning: String(s).trim(),
          }));
        } // else assume already [{ meaning }]
      }
    }

    // phonetic normalization
    if (payload.phonetic && typeof payload.phonetic === "string") {
      payload.phonetic = payload.phonetic.split(/\s*,\s*|\s+/).filter(Boolean);
    }
    if (payload.type === "") {
      payload.type = null;
    }

    const updated = await this.jlptWordModel.findByIdAndUpdate(id, payload, {
      new: true,
    });
    if (!updated) throw new NotFoundException("Word not found");
    return updated;
  }

  async getJlptWordForAdminById(id: string) {
    const word = await this.jlptWordModel.findById(id).lean();
    if (!word) throw new NotFoundException("Word not found");
    return word;
  }

  async deleteJlptWord(id: string) {
    const doc = await this.jlptWordModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );
    if (!doc) throw new NotFoundException("Word not found");
    return { message: "Deleted", id: doc._id };
  }

  // Nhập hàng loạt từ file Excel: validate từng dòng, bỏ qua từ trùng
  async bulkImportWords(items: any[]): Promise<ImportSummary> {
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
      key: String(raw?.word ?? "").trim(),
    }));
    const rawKeys = rawEntries.map((entry) => entry.key).filter(Boolean);
    const existingDocs = rawKeys.length
      ? await this.jlptWordModel.find({ word: { $in: rawKeys } }, { word: 1 }).lean()
      : [];
    const existingKeys = new Set(existingDocs.map((d) => d.word));

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
      if (key) candidate.word = key;
      const dto = plainToInstance(CreateJlptWordDto, candidate, {
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
          key: raw.word,
          reason,
        });
        addImportIssue(raw, "invalid", reason);
        continue;
      }

      const validatedKey = String(dto.word).trim();
      seenInBatch.add(validatedKey);

      const payload: any = { ...dto };
      payload.word = validatedKey;
      if (payload.type === "") payload.type = null;
      validPayloads.push({ row, key: validatedKey, payload, raw });
    }

    if (validPayloads.length) {
      const toInsert = validPayloads.map((entry) => entry.payload);
      if (toInsert.length) {
        try {
          const inserted = await this.jlptWordModel.insertMany(toInsert, {
            ordered: false,
          });
          summary.inserted = inserted.length;
        } catch (error: any) {
          // ordered:false: một số đã chèn, phần còn lại lỗi (thường do trùng)
          summary.inserted = error?.result?.nInserted ?? error?.insertedDocs?.length ?? 0;
          const writeErrors = error?.writeErrors || [];
          summary.skipped += writeErrors.length;
          for (const we of writeErrors) {
            const failedEntry = validPayloads[we?.index];
            const reason = "Trùng khoá khi ghi";
            summary.errors.push({
              row: failedEntry?.row,
              key: we?.err?.op?.word,
              reason,
            });
          }
        }
      }
    }

    summary.errorReport = createImportErrorReport(
      "word_errors",
      WORD_EXCEL_COLUMNS,
      "jlpt-word-import-errors.xlsx",
      errorRows,
    );
    return summary;
  }

  async importWordsExcel(file?: { buffer?: Buffer }) {
    if (!file?.buffer) {
      throw new BadRequestException("Excel file is required");
    }

    const rows = readFirstSheetRows(file.buffer);
    const items = rows.map(({ row, data }) => {
      const meanings = parseJsonCell<any[]>(data.meanings_json, []);
      const isJlpt = parseBooleanCell(data.isJlpt, true);
      const excelErrors = [
        !meanings.ok ? `meanings_json: ${meanings.error}` : "",
        !isJlpt.ok ? isJlpt.error : "",
      ].filter(Boolean);

      return {
        __row: row,
        __rawData: data,
        __excelError: excelErrors.join("; ") || undefined,
        word: trimString(data.word),
        phonetic: parseCommaList(data.phonetic),
        type: optionalString(data.type) ?? null,
        meanings: meanings.value,
        level: trimString(data.level).toUpperCase(),
        isJlpt: isJlpt.value,
      };
    });

    return this.bulkImportWords(items);
  }

  buildWordTemplateExcel(): ExcelFile {
    return createExcelFile(
      "words",
      WORD_EXCEL_COLUMNS,
      [
        {
          word: "食べる",
          phonetic: "たべる",
          type: "Động từ",
          meanings_json: stringifyJson([
            {
              meaning: "Ăn",
              examples: [{ jp: "ご飯を食べる。", vi: "Tôi ăn cơm." }],
            },
          ]),
          level: "N5",
          isJlpt: true,
        },
      ],
      "jlpt-word-template.xlsx",
    );
  }

  async exportWordsExcel(): Promise<ExcelFile> {
    const words = await this.jlptWordModel
      .find({ isDeleted: { $ne: true } })
      .sort({ updatedAt: -1 })
      .lean();

    const rows = words.map((item: any) => ({
      word: item.word || "",
      phonetic: Array.isArray(item.phonetic) ? item.phonetic.join(", ") : "",
      type: item.type || "",
      meanings_json: stringifyJson(item.meanings || []),
      level: item.level || "",
      isJlpt: item.isJlpt ?? false,
    }));

    return createExcelFile(
      "words",
      WORD_EXCEL_COLUMNS,
      rows,
      "jlpt-word-export.xlsx",
    );
  }
}

const WORD_EXCEL_COLUMNS = [
  "word",
  "phonetic",
  "type",
  "meanings_json",
  "level",
  "isJlpt",
];
