import { IsNotEmpty, IsString } from "class-validator";

export class createPostCategoryDto{
    @IsString()
    @IsNotEmpty()
    name: string;
}