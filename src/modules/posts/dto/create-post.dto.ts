import { IsString, IsNumber, IsOptional, IsNotEmpty, Max, MaxLength } from "class-validator";
import { ObjectId, Types } from "mongoose";

export class CreatePostDto {
    profile_id: Types.ObjectId;

    @IsString()
    @IsNotEmpty()
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