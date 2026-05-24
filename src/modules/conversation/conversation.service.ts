import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { ConversationCategory } from "./schemas/conversation-category.schema";
import { ConversationLesson } from "./schemas/conversation-lesson.schema";

type ConversationGroup = {
  id: string;
  slug: string;
  title: string;
  order: number;
  lessons: Array<{
    id: string;
    slug: string;
    level: string;
    title: string;
    image: string;
    order: number;
    category: any;
  }>;
};

@Injectable()
export class ConversationService {
  constructor(
    @InjectModel(ConversationCategory.name)
    private readonly categoryModel: Model<ConversationCategory>,
    @InjectModel(ConversationLesson.name)
    private readonly lessonModel: Model<ConversationLesson>,
  ) {}

  async getList() {
    const [categories, lessons] = await Promise.all([
      this.categoryModel.find({ isActive: true }).sort({ order: 1 }).lean(),
      this.lessonModel.find({ published: true }).sort({ order: 1 }).lean(),
    ]);

    const categoryMap = new Map<string, ConversationGroup>(
      categories.map((category) => [
        category.id,
        {
          id: category.id,
          slug: category.slug,
          title: category.title,
          order: category.order,
          lessons: [],
        },
      ]),
    );

    lessons.forEach((lesson) => {
      const categoryId = lesson.category?.id || "uncategorized";

      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, {
          id: categoryId,
          slug: categoryId,
          title: lesson.category?.title || "Khác",
          order: lesson.category?.order || 999,
          lessons: [],
        });
      }

      categoryMap.get(categoryId)?.lessons.push({
        id: String(lesson._id),
        slug: lesson.slug,
        level: lesson.level,
        title: lesson.title,
        image: lesson.image,
        order: lesson.order,
        category: lesson.category,
      });
    });

    return Array.from(categoryMap.values())
      .filter((category) => category.lessons.length > 0)
      .sort((a, b) => a.order - b.order);
  }

  async getDetail(idOrSlug: string) {
    const query = Types.ObjectId.isValid(idOrSlug)
      ? { _id: idOrSlug, published: true }
      : { slug: idOrSlug, published: true };

    const lesson = await this.lessonModel.findOne(query).lean();

    if (!lesson) {
      throw new NotFoundException("Conversation lesson not found");
    }

    return {
      id: String(lesson._id),
      slug: lesson.slug,
      category: lesson.category,
      level: lesson.level,
      title: lesson.title,
      image: lesson.image,
      order: lesson.order,
      lines: [...(lesson.lines || [])].sort(
        (a, b) => (a.order || 0) - (b.order || 0),
      ),
    };
  }

  async getAdminData() {
    const [categories, lessons] = await Promise.all([
      this.categoryModel.find().sort({ order: 1 }).lean(),
      this.lessonModel.find().sort({ "category.order": 1, order: 1 }).lean(),
    ]);

    return {
      categories,
      lessons: lessons.map((lesson) => ({
        ...lesson,
        id: String(lesson._id),
      })),
    };
  }

  async createCategory(data: Partial<ConversationCategory>) {
    return this.categoryModel.create(data);
  }

  async updateCategory(id: string, data: Partial<ConversationCategory>) {
    const category = await this.categoryModel.findByIdAndUpdate(id, data, {
      new: true,
    });

    if (!category) {
      throw new NotFoundException("Conversation category not found");
    }

    return category;
  }

  async deleteCategory(id: string) {
    const category = await this.categoryModel.findByIdAndDelete(id);

    if (!category) {
      throw new NotFoundException("Conversation category not found");
    }

    return { deleted: true };
  }

  async createLesson(data: Partial<ConversationLesson>) {
    return this.lessonModel.create(data);
  }

  async updateLesson(id: string, data: Partial<ConversationLesson>) {
    const lesson = await this.lessonModel.findByIdAndUpdate(id, data, {
      new: true,
    });

    if (!lesson) {
      throw new NotFoundException("Conversation lesson not found");
    }

    return lesson;
  }

  async deleteLesson(id: string) {
    const lesson = await this.lessonModel.findByIdAndDelete(id);

    if (!lesson) {
      throw new NotFoundException("Conversation lesson not found");
    }

    return { deleted: true };
  }
}
