import { IsNumber, IsString } from 'class-validator';

export class SyncItemDto {
  @IsNumber()
  s: number; 

  @IsNumber()
  e: number; 

  @IsString()
  t: string; 
}