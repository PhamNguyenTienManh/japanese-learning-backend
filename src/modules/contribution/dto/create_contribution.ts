import { IsMongoId, IsNotEmpty, IsObject, IsString } from "class-validator";
import { ObjectId } from "mongoose";

export class CreateContributionDto {


  @IsNotEmpty()
  kanjiId: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}
