import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { SearchHistoryService } from './search_history.service'
import { Public } from '../auth/public.decorator';
import { IsString,IsNotEmpty } from 'class-validator';

class dto {
    @IsString()
    @IsNotEmpty()
    query: string
}
@Controller('search-history')
export class SearchHistoryController {
    constructor(
        private readonly searchHistory: SearchHistoryService,
    ) { }
    @Post('user/:userId')
    @Public()
    async saveSearch(@Param('userId') userId: string, @Body() dto: dto) {
        if (!dto.query) {
            return { message: 'Query dto is required' };
        }

        await this.searchHistory.saveSearchTerm(userId, dto.query);

        return {
            success: true,
            message: 'Search dto processed and saved to history.',
            dto: dto.query
        };
    }


    @Public()
    @Get('user/:userId')
    async getHistory(@Param('userId') userId: string) {
        const history = await this.searchHistory.getSearchHistory(userId);

        return {
            userId: userId,
            history: history,
            count: history.length,
            message: history.length > 0 ? `Retrieved ${history.length} recent search dtos.` : 'No search history found.'
        };
    }
}
