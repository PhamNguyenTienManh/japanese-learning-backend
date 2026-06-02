import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ collection: "kanji_strokes", timestamps: true })
export class KanjiStroke extends Document {
  @Prop({ required: true, unique: true, index: true })
  char: string;

  @Prop({ required: true })
  hexCode: string;

  @Prop({ required: true })
  svgContent: string;

  @Prop({ default: 0 })
  strokeCount: number;
}

export const KanjiStrokeSchema = SchemaFactory.createForClass(KanjiStroke);
