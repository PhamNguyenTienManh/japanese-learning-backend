import * as dotenv from "dotenv";
import mongoose from "mongoose";
import {
  JlptKanji,
  JlptKanjiSchema,
} from "../modules/jlpt_kanji/schemas/jlpt_kanji.schema";
import { normalizeMultilineText } from "../modules/dictionary-excel/dictionary-excel.util";

dotenv.config();

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is missing");
  }

  await mongoose.connect(mongoUri);
  const KanjiModel =
    mongoose.models[JlptKanji.name] ||
    mongoose.model(JlptKanji.name, JlptKanjiSchema);

  let scanned = 0;
  let updated = 0;

  const cursor = KanjiModel.find({
    detail: { $exists: true, $ne: null },
  }).cursor();

  for await (const doc of cursor) {
    scanned++;
    const normalized = normalizeMultilineText(doc.detail);
    if (normalized && normalized !== doc.detail) {
      await KanjiModel.updateOne({ _id: doc._id }, { $set: { detail: normalized } });
      updated++;
    }
  }

  console.log(`Normalized kanji detail: scanned=${scanned}, updated=${updated}`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
