import { BadRequestException, Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class UploadService {
  /**
   * Upload ảnh mới lên Cloudinary
   */
  async uploadImage(file: Express.Multer.File, folder = 'JAVI/images'): Promise<any> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto', // Cho phép upload cả ảnh, pdf, mp3...
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      const stream = Readable.from(file.buffer);
      stream.pipe(uploadStream);
    });
  }

  /**
   * Xoá ảnh theo publicId
   */
  async deleteImage(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
      });
      return result;
    } catch (error) {
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }

  /**
   * Cập nhật ảnh: xoá ảnh cũ (nếu có) → upload ảnh mới
   */
  async updateImage(
    newFile: Express.Multer.File,
    oldPublicId?: string,
    folder = 'JAVI/images',
  ): Promise<any> {
    // Validate file
    if (!newFile) {
      throw new BadRequestException('New file is required');
    }

    let newImage;

    try {
      newImage = await this.uploadImage(newFile, folder);

      // Nếu upload thành công và có ảnh cũ thì xoá ảnh cũ
      if (oldPublicId) {
        try {
          await this.deleteImage(oldPublicId);
        } catch (deleteError) {
          // Log lỗi nhưng không throw - vì ảnh mới đã upload thành công
          console.warn(`Failed to delete old image ${oldPublicId}:`, deleteError.message);
        }
      }
      
      return newImage;

    } catch (error) {
      throw new BadRequestException(`Failed to update image: ${error.message}`);
    }
  }

}
