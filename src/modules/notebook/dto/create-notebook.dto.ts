import { IsMongoId, IsNotEmpty, IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateNotebookDto {
  user_id: string;

  @IsOptional()
  @IsString()
  name: string;

  @IsBoolean()
  @IsOptional()
  isPubliced?: boolean; 

  @IsOptional()
  viewCount?: boolean; // default = 0
}
