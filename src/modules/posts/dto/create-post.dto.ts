import { IsString, IsNumber, IsOptional, IsNotEmpty, Max, MaxLength } from "class-validator";

export class CreatePostDto{
    user_id: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    title: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(256)
    content: string;

    @IsString()
    @IsNotEmpty()
    category_id: string;
}