import * as XLSX from "xlsx";

export interface ExcelRow {
  row: number;
  data: Record<string, any>;
}

export interface ExcelFile {
  buffer: Buffer;
  filename: string;
}

export interface ImportErrorReport {
  filename: string;
  contentType: string;
  base64: string;
}

export interface ImportErrorReportRow {
  raw: Record<string, any>;
  status: "skipped" | "invalid";
  reason: string;
}

export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function readFirstSheetRows(buffer: Buffer): ExcelRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    defval: "",
    raw: false,
  });

  return rows
    .map((row, index) => ({
      row: index + 2,
      data: normalizeExcelRow(row),
    }))
    .filter(({ data }) =>
      Object.values(data).some((value) => String(value ?? "").trim() !== ""),
    );
}

export function createExcelFile(
  sheetName: string,
  columns: string[],
  rows: Record<string, any>[],
  filename: string,
): ExcelFile {
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  return {
    buffer: XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }),
    filename,
  };
}

export function createImportErrorReport(
  sheetName: string,
  columns: string[],
  filename: string,
  rows: ImportErrorReportRow[],
): ImportErrorReport | undefined {
  if (!rows.length) return undefined;

  const reportColumns = [...columns, "import_status", "import_reason"];
  const reportRows = rows.map((row) => {
    const normalized = columns.reduce<Record<string, any>>((acc, column) => {
      acc[column] = row.raw?.[column] ?? "";
      return acc;
    }, {});

    normalized.import_status = row.status;
    normalized.import_reason = row.reason;
    return normalized;
  });
  const file = createExcelFile(sheetName, reportColumns, reportRows, filename);

  return {
    filename: file.filename,
    contentType: XLSX_CONTENT_TYPE,
    base64: file.buffer.toString("base64"),
  };
}

export function trimString(value: any): string {
  return String(value ?? "").trim();
}

export function optionalString(value: any): string | undefined {
  const text = trimString(value);
  return text ? text : undefined;
}

export function parseCommaList(value: any): string[] {
  return trimString(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseBoolean(value: any, defaultValue = true): boolean {
  const text = trimString(value).toLowerCase();
  if (!text) return defaultValue;
  if (["true", "1", "yes", "y", "có", "co"].includes(text)) return true;
  if (["false", "0", "no", "n", "không", "khong"].includes(text)) return false;
  return defaultValue;
}

export function parseBooleanCell(
  value: any,
  defaultValue = true,
): { ok: true; value: boolean } | { ok: false; value: boolean; error: string } {
  const text = trimString(value).toLowerCase();
  if (!text) return { ok: true, value: defaultValue };
  if (["true", "1", "yes", "y", "có", "co"].includes(text)) {
    return { ok: true, value: true };
  }
  if (["false", "0", "no", "n", "không", "khong"].includes(text)) {
    return { ok: true, value: false };
  }
  return {
    ok: false,
    value: defaultValue,
    error: "isJlpt phải là TRUE hoặc FALSE",
  };
}

export function parseJsonField<T>(value: any, fallback: T): T {
  const text = trimString(value);
  if (!text) return fallback;

  try {
    return deepTrim(JSON.parse(text)) as T;
  } catch {
    return fallback;
  }
}

export function parseJsonCell<T>(
  value: any,
  fallback: T,
): { ok: true; value: T } | { ok: false; value: T; error: string } {
  const text = trimString(value);
  if (!text) return { ok: true, value: fallback };

  try {
    return { ok: true, value: deepTrim(JSON.parse(text)) as T };
  } catch {
    return { ok: false, value: fallback, error: "JSON không hợp lệ" };
  }
}

export function stringifyJson(value: any): string {
  return JSON.stringify(value ?? []);
}

export function normalizeMultilineText(value: any): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value)
      .replace(/\\n/g, "\n")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeMultilineText(item))
      .filter(Boolean)
      .join("\n");
  }

  if (value && typeof value === "object") {
    return Object.values(value)
      .map((item) => normalizeMultilineText(item))
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

export function escapeMultilineTextForExcel(value: any): string {
  return normalizeMultilineText(value).replace(/\n/g, "\\n");
}

function normalizeExcelRow(row: Record<string, any>) {
  return Object.entries(row).reduce<Record<string, any>>((acc, [key, value]) => {
    acc[String(key).trim()] = typeof value === "string" ? value.trim() : value;
    return acc;
  }, {});
}

function deepTrim(value: any): any {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(deepTrim);
  if (value && typeof value === "object") {
    return Object.entries(value).reduce<Record<string, any>>((acc, [key, item]) => {
      acc[key] = deepTrim(item);
      return acc;
    }, {});
  }
  return value;
}
