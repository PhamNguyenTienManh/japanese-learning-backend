import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { number } from "zod";


class SyncData{
  @Prop({ type: Number, default: null })
  s: number;

  @Prop({ type: Number, default: null })
  e: number;

  @Prop({ type: String, required: true })
  t: string;
}
@Schema({ _id: false })
class NewsContent {
  @Prop({ type: String, default: null })
  audio?: string;

  @Prop({ type: String, default: null })
  image?: string;

  @Prop({ type: String, required: true })
  textbody: string;

  @Prop({ type: String, default: null })
  video?: string;

  @Prop({ type: SyncData, default: null })
  syncData: SyncData[];
}

@Schema({ timestamps: true, collection: "news" })
export class News extends Document {
  @Prop({ type: String, required: true, trim: true })
  title: string; 

  @Prop({ type: String, required: true })
  link: string; 

  @Prop({ type: String, enum: ["easy", "medium", "hard"], default: "easy" })
  type: string; 

  @Prop({ type: NewsContent, required: true })
  content: NewsContent; 

  // @Prop({ type: NewsStatistics, default: {} })
  // statistics: NewsStatistics; // thống kê lượt xem

  @Prop({ type: Number, default: 1 })
  level: number; // cấp độ

  @Prop({ type: String, default: "" })
  grammarlist: Map<string, string>[];

  @Prop({ type: Boolean, default: false })
  published: boolean; // trạng thái hiển thị bài

  @Prop({ type: Date, default: Date.now })
  dateField: Date; // ngày hiển thị bài
}

export const NewsSchema = SchemaFactory.createForClass(News);
