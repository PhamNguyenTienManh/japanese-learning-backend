import * as dotenv from "dotenv";
import * as fs from "fs-extra";
import mongoose from "mongoose";
import * as path from "path";
import {
  KanjiStroke,
  KanjiStrokeSchema,
} from "../modules/pdf/schemas/kanji-stroke.schema";

dotenv.config();

const BASE_SVG_FILE_REGEX = /^([0-9a-fA-F]+)\.svg$/;
const STROKE_PATH_REGEX = /<path\b[^>]*\bid="[^"]*-s\d+"[^>]*\/?>/g;
const BATCH_SIZE = 500;

function hexToChar(hexCode: string) {
  const codePoint = parseInt(hexCode, 16);
  if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) {
    return "";
  }
  return String.fromCodePoint(codePoint);
}

function normalizeSvg(svgContent: string) {
  return svgContent.replace(/<\?xml.*?\?>\s*/g, "");
}

function countStrokes(svgContent: string) {
  return svgContent.match(STROKE_PATH_REGEX)?.length ?? 0;
}

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is missing");
  }

  const kanjivgDir = path.join(process.cwd(), "assets", "kanjivg");
  if (!(await fs.pathExists(kanjivgDir))) {
    throw new Error(`KanjiVG directory not found: ${kanjivgDir}`);
  }

  await mongoose.connect(mongoUri);
  const KanjiStrokeModel =
    mongoose.models[KanjiStroke.name] ||
    mongoose.model(KanjiStroke.name, KanjiStrokeSchema);

  const files = await fs.readdir(kanjivgDir);
  const operations: any[] = [];
  let scanned = 0;
  let processed = 0;
  let skipped = 0;
  let upserted = 0;
  let modified = 0;
  let matched = 0;

  const flush = async () => {
    if (!operations.length) return;
    const result = await KanjiStrokeModel.bulkWrite(operations, {
      ordered: false,
    });
    upserted += result.upsertedCount ?? 0;
    modified += result.modifiedCount ?? 0;
    matched += result.matchedCount ?? 0;
    operations.length = 0;
  };

  for (const file of files) {
    scanned++;
    const match = file.match(BASE_SVG_FILE_REGEX);
    if (!match) {
      skipped++;
      continue;
    }

    const hexCode = match[1].toLowerCase();
    const char = hexToChar(hexCode);
    if (!char) {
      skipped++;
      continue;
    }

    const rawSvg = await fs.readFile(path.join(kanjivgDir, file), "utf8");
    const svgContent = normalizeSvg(rawSvg);
    const strokeCount = countStrokes(svgContent);

    operations.push({
      updateOne: {
        filter: { char },
        update: {
          $set: {
            char,
            hexCode,
            svgContent,
            strokeCount,
          },
        },
        upsert: true,
      },
    });
    processed++;

    if (operations.length >= BATCH_SIZE) {
      await flush();
    }
  }

  await flush();

  console.log(
    [
      "Seeded KanjiVG strokes:",
      `scanned=${scanned}`,
      `processed=${processed}`,
      `skipped=${skipped}`,
      `matched=${matched}`,
      `modified=${modified}`,
      `upserted=${upserted}`,
    ].join(" ")
  );
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
