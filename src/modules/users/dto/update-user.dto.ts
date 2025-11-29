import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateStatusDto {
  @IsNotEmpty({ message: 'Status is required' })
  @IsEnum(['active', 'banned'], { 
    message: 'Status must be either "active" or "banned"' 
  })
  status: 'active' | 'banned';
}

export class UpdateRoleDto {
  @IsNotEmpty({ message: 'Role is required' })
  @IsEnum(['student', 'admin'], { 
    message: 'Role must be either "user" or "admin"' 
  })
  role: 'student' | 'admin';
}