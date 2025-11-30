
import { 
  Controller, 
  Get, 
  Patch, 
  Param, 
  Body,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateStatusDto, UpdateRoleDto } from './dto/update-user.dto';
import { Roles } from '../auth/roles.decorator';

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('admin')
  async findAll() {
      const users = await this.usersService.findAll();
      return {
        success: true,
        data: users
      };
    
    }


  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const user = await this.usersService.findOne(id);
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      return {
        success: true,
        data: user
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch user',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Patch(':id/status')
  @Roles("admin")
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateStatusDto
  ) {
    try {
      const user = await this.usersService.updateStatus(id, updateStatusDto.status);
      
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        message: `User status updated to ${updateStatusDto.status}`,
        data: user
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to update user status',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Patch(':id/role')
  async updateRole(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto
  ) {
    try {
      const user = await this.usersService.updateRole(id, updateRoleDto.role);
      
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        message: `User role updated to ${updateRoleDto.role}`,
        data: user
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to update user role',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

  }
}