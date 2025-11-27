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
    async getAll(): Promise<PostCategory[]>{
        return this.postCategoryModel.find();
    }


}
