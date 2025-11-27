import { IsString, IsNumber, IsOptional, IsNotEmpty, Max, MaxLength } from "class-validator";
import { ObjectId, Types } from "mongoose";

export class CreatePostDto{
    profile_id: Types.ObjectId;

    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    title: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(256)
    content: string;

    @IsNotEmpty()
    category_id: Types.ObjectId;
}