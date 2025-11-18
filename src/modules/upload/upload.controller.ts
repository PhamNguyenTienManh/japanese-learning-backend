import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { Public } from '../auth/public.decorator';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

 
  @Public()
  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Validate loại file
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only image files are allowed');
    }

    try {
      const result = await this.uploadService.uploadImage(file, 'JAVI/images');
      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch (error) {
      throw new BadRequestException('Upload failed: ' + error.message);
    }
  }

  @Public()
  @Post('update-image')
  @UseInterceptors(FileInterceptor('file'))
  async updateImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('oldPublicId') oldPublicId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Validate loại file
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only image files are allowed');
    }

    try {
      const result = await this.uploadService.updateImage(file, oldPublicId, 'JAVI/images');
      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch (error) {
      throw new BadRequestException('Update failed: ' + error.message);
    }
  }


  @Public()
  @Delete('image')
  async deleteImage(@Body('publicId') publicId: string) {
    if (!publicId) {
      throw new BadRequestException('publicId is required');
    }

    try {
      const result = await this.uploadService.deleteImage(publicId);
      return {
        result,
      };
    } catch (error) {
      throw new BadRequestException('Delete failed: ' + error.message);
    }
  }
}
