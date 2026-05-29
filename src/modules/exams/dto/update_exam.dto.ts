import { IsEnum, IsNumber, IsOptional, Min } from "class-validator";
import { ExamStatus } from "../schemas/exams.schema";

export class UpdateExamDto {
  @IsOptional()
  title?: string;

  @IsOptional()
  @IsEnum(["N5", "N4", "N3", "N2", "N1"], {
    message: "level must be one of: N5, N4, N3, N2, N1",
  })
  level?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pass_score?: number;

  @IsOptional()
  @IsEnum(ExamStatus, {
    message: "status must be one of: draft, completed, published, hidden",
  })
  status?: ExamStatus;
}
