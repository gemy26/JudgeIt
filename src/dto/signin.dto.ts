import { IsEmail, IsNotEmpty, IsString } from "class-validator"

export class SignInDto{
    @IsEmail()
    @IsString()
    @IsNotEmpty()
    email: string

    @IsString()
    @IsNotEmpty()
    password: string
}