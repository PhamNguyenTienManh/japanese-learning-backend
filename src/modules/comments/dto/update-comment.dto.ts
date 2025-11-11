import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateCommentDto{

    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    content: string;

    @IsString()
    @IsOptional()
    image: string;
}