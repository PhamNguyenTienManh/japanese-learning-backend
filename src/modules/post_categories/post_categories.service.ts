import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PostCategory } from './schemas/post_categories.shema';
import { Model } from 'mongoose';
import { createPostCategoryDto } from './dto/create-post-category.dto';
import { UpdatePostCategoryDto } from './dto/update-post-category.dto';


@Injectable()
export class PostCategoriesService {
    constructor(
        @InjectModel(PostCategory.name)
        private readonly postCategoryModel: Model<PostCategory>,
    ){}
    async create(dto: createPostCategoryDto): Promise<PostCategory>{
        const existing = await this.postCategoryModel.findOne({name: dto.name})
        if(existing) throw new ConflictException("Post Category name existing")
        const category = new this.postCategoryModel({name: dto.name})
        return category.save();
    }

    async update(id:string, dto: UpdatePostCategoryDto):Promise<PostCategory>{
        const category = await this.postCategoryModel.findById(id);
        if(!category) throw new NotFoundException("Category not found")

        if(dto.name){
            const existed = await this.postCategoryModel.findOne({
                name: dto.name,
                _id: {$ne: id},
            })
            if(existed) throw new ConflictException("Category name existing")
            category.name = dto.name;
        }
        if(typeof dto.follow === 'number'){
            category.follow = dto.follow;
        }

        return category.save();
    }
    async getAll(): Promise<any[]>{
        return this.postCategoryModel.aggregate([
            {
                $lookup: {
                    from: 'posts',
                    let: { categoryId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$category_id', '$$categoryId'] },
                                        { $eq: ['$status', 1] },
                                    ],
                                },
                            },
                        },
                        { $project: { _id: 1 } },
                    ],
                    as: 'posts',
                },
            },
            {
                $project: {
                    name: 1,
                    follow: 1,
                    count: { $size: '$posts' },
                },
            },
            { $sort: { name: 1 } },
        ]);
    }


}
