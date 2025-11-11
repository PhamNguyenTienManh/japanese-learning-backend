import { IsString, IsNumber, IsOptional, IsNotEmpty, Max, MaxLength } from "class-validator";

export class UpdatePostDto{
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