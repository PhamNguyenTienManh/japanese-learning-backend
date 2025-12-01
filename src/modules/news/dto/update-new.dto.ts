import { PartialType } from "@nestjs/mapped-types";
import { ValidateNested, IsOptional } from "class-validator";
import { Type } from "class-transformer";
import { CreateNewsContentDto, CreateNewsDto } from "./create-new.dto";

export class UpdateNewsDto extends PartialType(CreateNewsDto) {
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateNewsContentDto)
  content?: CreateNewsContentDto;
}
