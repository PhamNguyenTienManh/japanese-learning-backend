import { BadRequestException, Body, Controller, Get, Param, Put, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UploadService } from '../upload/upload.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../auth/public.decorator';

@Controller('profiles')
export class ProfilesController {
    constructor (
        private profilesService: ProfilesService,
        private readonly uploadService: UploadService) {}

    @Public()
    @Get('active-members')
    async getActiveMembers(@Query('limit') limit: number = 5) {
        return this.profilesService.getActiveMembers(Number(limit) || 5);
    }

    @Get('me')
    async getProfile(@Req() req){
        const userId = req.user.sub;
        return this.profilesService.findByUserId(userId)
    }

    @Put('me/update')
    async updateMyProfile(@Req() req, @Body() updateData: UpdateProfileDto) {
        const userId = req.user.sub;
        const updatedProfile = await this.profilesService.updateProfile(userId, updateData);
        return  updatedProfile;
    }

    @Put('avatar')
    @UseInterceptors(FileInterceptor('file'))
    async updateAvatar(@UploadedFile() file: Express.Multer.File, @Req() req) {
        if (!file) throw new BadRequestException('File is required');

        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException('Only image files are allowed');
        }

        const userId = req.user.sub;

        // Lấy profile hiện tại
        const profile = await this.profilesService.findByUserId(userId);
        const oldPublicId = profile?.image_publicId || null;

        // Upload/update ảnh bằng UploadService
        const result = await this.uploadService.updateImage(file, oldPublicId, 'JAVI/images');

        // Cập nhật profile với image_url và image_publicId mới
        const updatedProfile = await this.profilesService.updateProfile(userId, {
        image_url: result.secure_url,
        image_publicId: result.public_id,
        });

        return {
        success: true,
        profile: updatedProfile,
        url: result.secure_url,
        publicId: result.public_id,
        };
    }

}
