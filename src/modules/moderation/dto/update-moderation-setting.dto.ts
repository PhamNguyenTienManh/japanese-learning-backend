import { IsNumber, Max, Min } from "class-validator";

export class UpdateModerationSettingDto {
  @IsNumber()
  @Min(1)
  @Max(50)
  postBatchSize: number;

  @IsNumber()
  @Min(1)
  @Max(100)
  commentBatchSize: number;

  @IsNumber()
  @Min(5)
  @Max(300)
  batchTimeoutSeconds: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  autoDeleteConfidenceThreshold: number;
}
