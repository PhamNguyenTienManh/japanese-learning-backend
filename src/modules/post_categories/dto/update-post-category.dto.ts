import { IsString, IsOptional, IsNumber, Min } from "class-validator";

export class UpdatePostCategoryDto {
    @IsOptional()
    @IsString()
    name?:string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    follow?:number;
}