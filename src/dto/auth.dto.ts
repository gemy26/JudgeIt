import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

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
    @MinLength(1)
    password: string
}