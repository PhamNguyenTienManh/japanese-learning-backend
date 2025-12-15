import { Transform } from "class-transformer";
import { IsInt, IsString } from "class-validator";

export class KanjiSearchDto {
    @IsString()
    level: number = 0;

    @IsString()
    strokeNumber: string;

    @IsString()
    keyword: string;

    @IsString()
    pageIndex: string;
}


export class KanjiItemDto {
    id: string;
    character: string;
    meaning: string;
    description: string;
    onyomi: string[];
    kunyomi: string[];
}

export class KanjiResponseDto {
    success: boolean;
    message: string;
    data: KanjiItemDto[];
    totalRow: number;
    errorCode: number;
}