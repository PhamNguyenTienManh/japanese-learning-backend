import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCommentDto{

    @IsString()
    @IsNotEmpty()
    postId: string;

    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    content: string;

    @IsString()
    @IsOptional()
    image: string;
}