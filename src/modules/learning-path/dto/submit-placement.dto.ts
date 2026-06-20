import { IsArray, IsInt, IsMongoId, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PlacementAnswerDto {
  @IsMongoId()
  questionId: string;

  @IsInt()
  @Min(-1)
  @Max(3)
  selected: number;
}

export class SubmitPlacementDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlacementAnswerDto)
  answers: PlacementAnswerDto[];
}
