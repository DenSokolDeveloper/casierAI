import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import type { UserRole } from '../user.schema';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  name: string;

  @IsIn(['owner', 'cashier'])
  role: UserRole;
}
