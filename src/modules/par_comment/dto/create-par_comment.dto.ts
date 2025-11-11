import { IsNotEmpty, IsOptional, IsString, IsMongoId, IsNumber, Min, IsBoolean } from 'class-validator';

export class CreateParCommentDto {
//   @IsNotEmpty()
//   @IsMongoId()
  commentId: string; 

  @IsNotEmpty()
  @IsMongoId()
  userId: string; 

  @IsNotEmpty()
  @IsString()
  content: string; 

  @IsOptional()
  @IsString()
  image?: string | null; 

}
