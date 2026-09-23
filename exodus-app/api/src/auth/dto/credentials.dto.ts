// Request bodies for sign-up and login.
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

// Trim and lower-case, so " Alice@Example.com " and "alice@example.com" are the same account.
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

export class SignupDto {
  @ApiProperty({ example: "alice@example.com" })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: "Enter a valid email address." })
  @MaxLength(254)
  email!: string;

  // Long passphrases are welcome; the upper limit only stops huge payloads
  // from making Argon2 hashing slow on purpose.
  @ApiProperty({ example: "correct horse battery staple", minLength: 10, maxLength: 128 })
  @IsString()
  @MinLength(10, { message: "The password needs at least 10 characters." })
  @MaxLength(128)
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: "alice@example.com" })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: "Enter a valid email address." })
  @MaxLength(254)
  email!: string;

  // No minimum here: a wrong password should get "wrong email or password", not a validation error.
  @ApiProperty({ example: "correct horse battery staple" })
  @IsString()
  @MaxLength(128)
  password!: string;
}
