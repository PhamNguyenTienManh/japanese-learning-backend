import { IsString, IsNumber, IsOptional, IsNotEmpty, Max, MaxLength } from "class-validator";
import { Types } from "mongoose";

export class UpdatePostDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    title: string;
    
    @IsOptional()
    @IsString()
    image_url?: string;

    @IsOptional()
    @IsString()
    image_publicId?: string;

    @IsString()
    @IsNotEmpty()
    content: string;

    @IsNotEmpty()
    category_id: Types.ObjectId;

}