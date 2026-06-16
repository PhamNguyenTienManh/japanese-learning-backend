// src/ai-chat/dto/ai-chat.dto.ts
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';


export class CreateMessageDto {
  @IsString()
  content: string;
}

export class UpdateSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

export class ConfirmNotebookAddDto {
  @IsString()
  notebookId: string;

  @IsString()
  prompt: string;
}

export class ConfirmNotebookCreateDto {
  @IsString()
  name: string;

  @IsString()
  prompt: string;
}
