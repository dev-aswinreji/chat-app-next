import { IsString, MinLength } from 'class-validator';

export class SignUpDto {
  @IsString()
  username: string;

  @IsString()
  fullName: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class SignInDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
}
