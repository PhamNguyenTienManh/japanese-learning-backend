import { IsMongoId, IsNotEmpty, IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { Types } from 'mongoose';
import { Type } from 'class-transformer';
export const NOTEBOOK_ITEM_TYPES = ['kanji', 'word', 'grammar'] as const;
export type NotebookItemType = typeof NOTEBOOK_ITEM_TYPES[number];
export class CreateNotebookItemDto {
  notebook_id: string;

  @IsEnum(NOTEBOOK_ITEM_TYPES)
  @IsNotEmpty()
  type: NotebookItemType;

  @IsMongoId()
  @IsOptional()
  ref_id?: string | null;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  mean?: string;

  @IsString()
  @IsOptional()
  phonetic?: string;

  @IsBoolean()
  @IsOptional()
  remember?: boolean;
}
