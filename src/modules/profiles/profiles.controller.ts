import { Body, Controller, Get, Param, Put, Req } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('profiles')
export class ProfilesController {
    constructor (private profileServices: ProfilesService) {}

    @Get('me')
    async getProfile(@Req() req){
        const userId = req.user.sub;
        return this.profileServices.findByUserId(userId)
    }

    @Put('me/update')
    async updateMyProfile(@Req() req, @Body() updateData: UpdateProfileDto) {
        const userId = req.user.sub;
        const updatedProfile = await this.profileServices.updateProfile(userId, updateData);
        return  updatedProfile;
    }

}
