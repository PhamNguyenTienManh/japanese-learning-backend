import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class VerifyRegisterOtpDto {

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsNotEmpty()
    otp: string;
}
