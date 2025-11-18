// src/ai-chat/dto/ai-chat.dto.ts
import { IsString, IsOptional, IsEnum, IsMongoId } from 'class-validator';


export class CreateMessageDto {
  @IsString()
  content: string;
}