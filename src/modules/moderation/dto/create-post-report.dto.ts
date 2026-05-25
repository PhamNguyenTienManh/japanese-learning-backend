import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import type { ModerationCategory } from "../schemas/moderation-case.schema";

export class CreatePostReportDto {
  @IsIn([
    "spam_advertising",
    "abusive_language",
    "off_topic",
    "language_misinformation",
    "nsfw",
    "manipulation",
  ])
  category: ModerationCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  subcategory: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
