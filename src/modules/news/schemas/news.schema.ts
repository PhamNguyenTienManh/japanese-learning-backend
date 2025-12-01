import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

// -------------------------------
// Subdocument: Nội dung bài viết
// -------------------------------
@Schema({ _id: false })
class NewsContent {
  @Prop({ type: String, default: null })
  audio?: string; // link âm thanh (nếu có)

  @Prop({ type: String, default: null })
  image?: string; // ảnh minh họa

  @Prop({ type: String, required: true })
  textbody: string; // nội dung chính của bài

  @Prop({ type: String, default: null })
  video?: string; // link video (nếu có)
}

// // -------------------------------
// // Subdocument: Thống kê
// // -------------------------------
// @Schema({ _id: false })
// class NewsStatistics {
//   @Prop({ type: Number, default: 0, min: 0 })
//   total_views: number; // tổng lượt xem
// }

// -------------------------------
// Main Schema: News
// -------------------------------
@Schema({ timestamps: true, collection: "news" })
export class News extends Document {
  @Prop({ type: String, required: true, trim: true })
  title: string; // tiêu đề bài viết

  @Prop({ type: String, required: true })
  link: string; // link bài viết gốc (VD: forbes, bbc, v.v.)

  @Prop({ type: String, enum: ["easy", "medium", "hard"], default: "easy" })
  type: string; // độ khó bài đọc

  @Prop({ type: NewsContent, required: true })
  content: NewsContent; // nội dung bài viết (văn bản, hình, video...)

  // @Prop({ type: NewsStatistics, default: {} })
  // statistics: NewsStatistics; // thống kê lượt xem

  @Prop({ type: Number, default: 1 })
  level: number; // cấp độ

  @Prop({ type: String, default: "" })
  grammarlist: Map<string, string>[];

  @Prop({ type: Boolean, default: false })
  publish: boolean; // trạng thái hiển thị bài

  @Prop({ type: Date, default: Date.now })
  dateField: Date; // ngày hiển thị bài
}

export const NewsSchema = SchemaFactory.createForClass(News);
