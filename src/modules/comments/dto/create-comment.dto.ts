import { Type } from "@nestjs/passport";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { Types } from "mongoose";

export class CreateCommentDto{

    postId: Types.ObjectId;

    profileId: Types.ObjectId;

    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    content: string;

    @IsString()
    @IsOptional()
    image: string;
}