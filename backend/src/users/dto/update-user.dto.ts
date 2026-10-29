import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import type { UserRole } from '../user.schema';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['owner', 'cashier'])
  role?: UserRole;
}
