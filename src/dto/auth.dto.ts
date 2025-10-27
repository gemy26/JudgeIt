import { IsEmail, IsNotEmpty, IsString } from "class-validator"

export class AuthDto{
    @IsEmail()
    @IsString()
    @IsNotEmpty()
    email: string

    @IsString()
    @IsNotEmpty()
    username: string

    @IsString()
    @IsNotEmpty()
    password: string
}