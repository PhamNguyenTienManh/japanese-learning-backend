import { IsEnum, IsNotEmpty, IsNumber, IsOptional, Min } from "class-validator";

export class CreateExamDto {
  @IsNotEmpty()
  title: string;

  @IsNotEmpty()
  @IsEnum(["N5", "N4", "N3", "N2", "N1"])
  level: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number = 180;
  @IsOptional()
  @IsNumber()
  @Min(0)
  pass_score?: number = 80;
}
