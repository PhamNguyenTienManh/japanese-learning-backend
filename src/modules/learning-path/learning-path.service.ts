import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GoogleGenAIClient } from '../ai/provider/googleGenAIClient';
import { ConversationLesson } from '../conversation/schemas/conversation-lesson.schema';
import {
  ExamResult,
  ExamStatus as ExamResultStatus,
} from '../exam_results/schemas/exam_results.schema';
import { Exam, ExamStatus } from '../exams/schemas/exams.schema';
import { JlptGrammar } from '../jlpt_grammar/schemas/jlpt_grammar.schema';
import { JlptKanji } from '../jlpt_kanji/schemas/jlpt_kanji.schema';
import { JlptWord } from '../jlpt_word/schemas/jlpt_word.schema';
import { Profile } from '../profiles/schemas/profiles.schema';
import { User } from '../users/schemas/user.schema';
import { PLACEMENT_QUESTIONS_DATA } from './data/placement-questions.data';
import { ApplyReviewDto } from './dto/apply-review.dto';
import { GenerateLearningPathDto } from './dto/generate-learning-path.dto';
import { SubmitPlacementDto } from './dto/submit-placement.dto';
import {
  GOAL_SKILL_DEFAULTS,
  GoalType,
  LearningPath,
  LearningPathDocument,
  SkillType,
  WeeklyItem,
  WeeklyPlan,
} from './schemas/learning-path.schema';
import {
  JlptCardProgress,
  JlptCardProgressDocument,
} from './schemas/jlpt-card-progress.schema';
import {
  LearningResourceProgress,
  LearningResourceProgressDocument,
  ResourceProgressSkill,
} from './schemas/learning-resource-progress.schema';
import {
  PlacementLevel,
  PlacementQuestion,
  PlacementQuestionDocument,
  PlacementSkill,
} from './schemas/placement-question.schema';
import {
  PlacementLevelCounts,
  PlacementSkillCounts,
  PlacementTestConfig,
  PlacementTestConfigDocument,
  PlacementTestSkillMatrix,
} from './schemas/placement-test-config.schema';

type AvailableItem = {
  id: string;
  skill: SkillType;
  refModel: string;
  estimatedMinutes: number;
  title: string;
};

type ReviewSuggestionType = 'speed_up' | 'slow_down' | 'focus_skill' | 'add_review';
type PlacementAvailability = {
  total: number;
  levelCounts: PlacementLevelCounts;
  skillCounts: PlacementTestSkillMatrix;
};
type PlacementConfigValidation = {
  isValid: boolean;
  errors: string[];
};

const LEVELS: PlacementLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
const PLACEMENT_SKILLS: PlacementSkill[] = ['vocab', 'grammar', 'listening'];
const PLACEMENT_SECONDS_PER_QUESTION_OPTIONS = [30, 45, 60, 90, 120];
const PLACEMENT_LEVEL_REQUIREMENTS: Record<
  PlacementLevel,
  Partial<Record<PlacementLevel, number>>
> = {
  N5: {},
  N4: { N5: 60, N4: 60 },
  N3: { N5: 60, N4: 60, N3: 60 },
  N2: { N5: 75, N4: 60, N3: 60, N2: 60 },
  N1: { N5: 75, N4: 75, N3: 60, N2: 60, N1: 60 },
};
const SUPPORTED_CONTENT_SKILLS: SkillType[] = [
  'vocab',
  'kanji',
  'grammar',
  'jlpt_exam',
  'conversation',
  'reading',
  'writing',
];
const PROGRESS_TRACKED_SKILLS: SkillType[] = [
  'vocab',
  'grammar',
  'kanji',
  'jlpt_exam',
  'reading',
  'writing',
];

@Injectable()
export class LearningPathService implements OnModuleInit {
  private readonly logger = new Logger(LearningPathService.name);

  constructor(
    @InjectModel(LearningPath.name)
    private readonly learningPathModel: Model<LearningPathDocument>,
    @InjectModel(JlptCardProgress.name)
    private readonly jlptCardProgressModel: Model<JlptCardProgressDocument>,
    @InjectModel(LearningResourceProgress.name)
    private readonly learningResourceProgressModel: Model<LearningResourceProgressDocument>,
    @InjectModel(PlacementQuestion.name)
    private readonly placementQuestionModel: Model<PlacementQuestionDocument>,
    @InjectModel(PlacementTestConfig.name)
    private readonly placementTestConfigModel: Model<PlacementTestConfigDocument>,
    @InjectModel(JlptWord.name)
    private readonly jlptWordModel: Model<JlptWord>,
    @InjectModel(JlptKanji.name)
    private readonly jlptKanjiModel: Model<JlptKanji>,
    @InjectModel(JlptGrammar.name)
    private readonly jlptGrammarModel: Model<JlptGrammar>,
    @InjectModel(Exam.name)
    private readonly examModel: Model<Exam>,
    @InjectModel(ExamResult.name)
    private readonly examResultModel: Model<ExamResult>,
    @InjectModel(ConversationLesson.name)
    private readonly conversationLessonModel: Model<ConversationLesson>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(Profile.name)
    private readonly profileModel: Model<Profile>,
    private readonly aiClient: GoogleGenAIClient,
  ) {}

  async onModuleInit() {
    const count = await this.placementQuestionModel.estimatedDocumentCount();
    if (count > 0) return;

    await this.placementQuestionModel.insertMany(PLACEMENT_QUESTIONS_DATA);
    this.logger.log(`Seeded ${PLACEMENT_QUESTIONS_DATA.length} placement questions`);
  }

  async getPlacementQuestions(count = 20) {
    const savedConfig = await this.placementTestConfigModel
      .findOne({ key: 'default', isActive: { $ne: false } })
      .lean()
      .exec();
    if (savedConfig) {
      try {
        return await this.getConfiguredPlacementQuestions(savedConfig);
      } catch (error) {
        this.logger.warn(
          `Placement config is invalid, using default fallback config: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return this.getConfiguredPlacementQuestions(this.createDefaultPlacementTestConfig());
  }

  async submitPlacement(dto: SubmitPlacementDto) {
    if (!dto.answers?.length) {
      throw new BadRequestException('answers is required');
    }

    const questionIds = dto.answers.map((answer) => answer.questionId);
    const questions = await this.placementQuestionModel
      .find({ _id: { $in: questionIds }, isActive: { $ne: false } })
      .lean()
      .exec();

    if (questions.length === 0) {
      throw new NotFoundException('Placement questions not found');
    }

    const answerByQuestionId = new Map(
      dto.answers.map((answer) => [answer.questionId, answer.selected]),
    );
    const levelStats = this.createStatsMap(LEVELS);
    const skillStats = this.createStatsMap(PLACEMENT_SKILLS);

    for (const question of questions) {
      const selected = answerByQuestionId.get(question._id.toString());
      const correct = selected === question.correctAnswer;
      levelStats[question.level].total += 1;
      skillStats[question.skill].total += 1;
      if (correct) {
        levelStats[question.level].correct += 1;
        skillStats[question.skill].correct += 1;
      }
    }

    const levelBreakdown = Object.fromEntries(
      LEVELS.map((level) => [level, this.toPercent(levelStats[level])]),
    ) as Record<PlacementLevel, number>;
    const skillBreakdown = Object.fromEntries(
      PLACEMENT_SKILLS.map((skill) => [skill, this.toPercent(skillStats[skill])]),
    ) as Record<PlacementSkill, number>;

    const maxAllowedLevel = this.getMaxAllowedPlacementLevel(levelBreakdown);
    let suggestedLevel = this.suggestLevel(levelBreakdown);
    const confidence = this.calculateConfidence(levelBreakdown, suggestedLevel);

    if (confidence < 0.1) {
      const aiSuggestedLevel = await this.askAiForBoundaryLevel(
        levelBreakdown,
        skillBreakdown,
        suggestedLevel,
        maxAllowedLevel,
      );
      suggestedLevel = this.clampPlacementLevel(aiSuggestedLevel, maxAllowedLevel);
    }

    return {
      suggestedLevel,
      confidence,
      skillBreakdown,
      levelBreakdown,
    };
  }

  async getStatus(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    const learningPath = await this.learningPathModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .select('_id level goal.type goal.types currentWeek createdAt generatedAt')
      .lean()
      .exec();

    return {
      hasLearningPath: Boolean(learningPath),
      learningPath: learningPath
        ? {
            id: learningPath._id.toString(),
            level: learningPath.level,
            goalType: learningPath.goal?.type,
            goalTypes: learningPath.goal?.types?.length
              ? learningPath.goal.types
              : [learningPath.goal?.type].filter(Boolean),
            currentWeek: learningPath.currentWeek,
            generationSource: (learningPath as any).generationSource || 'fallback',
            createdAt: (learningPath as any).createdAt,
            generatedAt: (learningPath as any).generatedAt,
          }
        : null,
    };
  }

  async getDashboard(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    const learningPath = await this.learningPathModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();

    if (!learningPath) {
      return { hasLearningPath: false };
    }

    if (this.shouldConvertToGenericPlan(learningPath)) {
      learningPath.weeklyPlans = this.buildGenericPlans(
        learningPath.level,
        learningPath.goal.type,
        learningPath.goal.types?.length ? learningPath.goal.types : [learningPath.goal.type],
        learningPath.goal.focusSkills,
        learningPath.weeklyPlans?.length || 8,
        learningPath.goal.dailyMinutes,
      );
      learningPath.currentWeek = 1;
      await learningPath.save();
    }

    const currentWeek = learningPath.currentWeek || 1;
    const currentPlan =
      learningPath.weeklyPlans?.find((plan) => plan.week === currentWeek) ??
      learningPath.weeklyPlans?.[currentWeek - 1];
    const weekItems = currentPlan?.items ?? [];
    const enrichedWeekItems = await this.enrichWeeklyItems(
      userId,
      learningPath,
      weekItems,
    );
    const autoCompleted = this.applyAutoCompletedItems(
      learningPath,
      enrichedWeekItems,
    );
    if (autoCompleted) {
      learningPath.markModified('weeklyPlans');
      await learningPath.save();
    }

    const completed = enrichedWeekItems.filter((item) => item.progress?.isComplete).length;
    const total = enrichedWeekItems.length;
    const dailyMinutes = learningPath.goal?.dailyMinutes || 30;
    const todayTasks = await this.buildTodayTasks(
      userId,
      learningPath,
      enrichedWeekItems,
      dailyMinutes,
    );

    const startedAt = this.getLearningPathStartAt(learningPath);
    const daysElapsed = !startedAt
      ? 0
      : Math.max(
          0,
          Math.floor((Date.now() - startedAt.getTime()) / (24 * 60 * 60 * 1000)),
        );

    return {
      hasLearningPath: true,
      level: learningPath.level,
      goal: learningPath.goal,
      streakDays: learningPath.streakDays,
      generationSource: learningPath.generationSource || 'fallback',
      weekProgress: {
        week: currentWeek,
        total,
        completed,
        percent: total ? Math.round((completed / total) * 100) : 0,
      },
      weekTasks: enrichedWeekItems,
      todayTasks,
      lastReview: learningPath.lastReview,
      daysElapsed,
    };
  }

  async reviewLearningPath(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    const learningPath = await this.learningPathModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (!learningPath) {
      throw new NotFoundException('Learning path not found');
    }

    const currentWeek = learningPath.currentWeek || 1;
    const currentPlan =
      learningPath.weeklyPlans?.find((plan) => plan.week === currentWeek) ??
      learningPath.weeklyPlans?.[currentWeek - 1];
    const enrichedWeekItems = await this.enrichWeeklyItems(
      userId,
      learningPath,
      currentPlan?.items ?? [],
    );
    const stats = await this.buildReviewStats(userId, learningPath, enrichedWeekItems);
    const review = await this.generateReviewWithAi(stats);

    learningPath.lastReview = {
      reviewedAt: new Date(),
      assessment: review.assessment,
      onTrack: review.onTrack,
      suggestions: review.suggestions,
      adjustedWeeklyItems: review.adjustedWeeklyItems,
    };
    await learningPath.save();

    return {
      lastReview: learningPath.lastReview,
      stats,
    };
  }

  async applyReview(userId: string, dto: ApplyReviewDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    const learningPath = await this.learningPathModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (!learningPath) {
      throw new NotFoundException('Learning path not found');
    }

    const confirmedItems = this.normalizeAdjustedWeeklyItems(
      dto.confirmedItems,
      learningPath,
    );
    if (!confirmedItems.length) {
      throw new BadRequestException('confirmedItems must include at least one valid item');
    }

    const nextWeek = Math.max(1, (learningPath.currentWeek || 1) + 1);
    const targetWeek = Math.min(nextWeek, Math.max(nextWeek, learningPath.weeklyPlans.length));
    let targetPlan = learningPath.weeklyPlans.find((plan) => plan.week === targetWeek);

    if (!targetPlan) {
      targetPlan = { week: targetWeek, items: [] } as WeeklyPlan;
      learningPath.weeklyPlans.push(targetPlan);
    }

    targetPlan.items = confirmedItems;
    await learningPath.save();

    return this.getDashboard(userId);
  }

  async adminListLearningPaths(query: any = {}) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const filter: any = {};

    if (query.level && LEVELS.includes(query.level)) {
      filter.level = query.level;
    }
    if (['ai', 'fallback'].includes(query.generationSource)) {
      filter.generationSource = query.generationSource;
    }
    if (query.userId && Types.ObjectId.isValid(query.userId)) {
      filter.userId = new Types.ObjectId(query.userId);
    }

    const [rows, total] = await Promise.all([
      this.learningPathModel
        .find(filter)
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.learningPathModel.countDocuments(filter),
    ]);
    const userMeta = await this.getUserMetaMap(rows.map((row: any) => row.userId));

    return {
      data: rows.map((row: any) => this.toAdminLearningPathSummary(row, userMeta)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  async adminGetLearningPath(id: string) {
    const learningPath = await this.findLearningPathById(id);
    const userMeta = await this.getUserMetaMap([learningPath.userId]);
    const detail = this.toAdminLearningPathDetail(learningPath, userMeta);
    return {
      ...detail,
      progressDetail: await this.buildAdminProgressDetail(learningPath),
    };
  }

  async adminUpdateLearningPath(id: string, body: any) {
    const learningPath = await this.findLearningPathById(id);

    if (body.level && LEVELS.includes(body.level)) {
      learningPath.level = body.level;
    }
    if (body.goal) {
      const currentGoal = learningPath.goal || ({} as any);
      const goalTypes = this.normalizeGoalTypes(
        body.goal.types,
        body.goal.type || currentGoal.type,
      );
      learningPath.goal = {
        type: goalTypes[0],
        types: goalTypes,
        examDate: body.goal.examDate ? new Date(body.goal.examDate) : undefined,
        targetScore: Number.isFinite(Number(body.goal.targetScore))
          ? Math.min(Math.max(Math.round(Number(body.goal.targetScore)), 0), 180)
          : currentGoal.targetScore,
        dailyMinutes: Math.max(Number(body.goal.dailyMinutes) || currentGoal.dailyMinutes || 30, 5),
        focusSkills: this.normalizeSkillList(
          body.goal.focusSkills?.length ? body.goal.focusSkills : currentGoal.focusSkills,
        ),
      };
    }
    if (Number.isFinite(Number(body.currentWeek))) {
      learningPath.currentWeek = Math.min(
        Math.max(Math.round(Number(body.currentWeek)), 1),
        Math.max(learningPath.weeklyPlans?.length || 1, 1),
      );
    }
    if (Array.isArray(body.weeklyPlans)) {
      learningPath.weeklyPlans = this.normalizeAdminWeeklyPlans(body.weeklyPlans);
      learningPath.currentWeek = Math.min(
        Math.max(learningPath.currentWeek || 1, 1),
        Math.max(learningPath.weeklyPlans.length, 1),
      );
      learningPath.markModified('weeklyPlans');
    }

    await learningPath.save();
    return this.adminGetLearningPath((learningPath as any)._id.toString());
  }

  async adminRunReview(id: string) {
    const learningPath = await this.findLearningPathById(id);
    return this.reviewLearningPath(learningPath.userId.toString());
  }

  async adminApplyReview(id: string, body: any) {
    const learningPath = await this.findLearningPathById(id);
    const confirmedItems = Array.isArray(body?.confirmedItems)
      ? body.confirmedItems
      : learningPath.lastReview?.adjustedWeeklyItems;
    return this.applyReview(learningPath.userId.toString(), { confirmedItems } as ApplyReviewDto);
  }

  async adminDismissReview(id: string) {
    const learningPath = await this.findLearningPathById(id);
    if (learningPath.lastReview) {
      learningPath.lastReview.adjustedWeeklyItems = [];
      learningPath.markModified('lastReview');
      await learningPath.save();
    }
    return this.adminGetLearningPath(id);
  }

  async adminListPlacementQuestions(query: any = {}) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const filter: any = {};
    const q = String(query.q || '').trim();

    if (q) {
      filter.$or = [
        { content: { $regex: q, $options: 'i' } },
        { explanation: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } },
      ];
    }
    if (query.level && LEVELS.includes(query.level)) {
      filter.level = query.level;
    }
    if (PLACEMENT_SKILLS.includes(query.skill)) {
      filter.skill = query.skill;
    }
    if (query.isActive === 'true') filter.isActive = true;
    if (query.isActive === 'false') filter.isActive = false;

    const [rows, total] = await Promise.all([
      this.placementQuestionModel
        .find(filter)
        .sort({ level: 1, skill: 1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.placementQuestionModel.countDocuments(filter),
    ]);

    return {
      data: rows.map((row: any) => this.toAdminPlacementQuestion(row)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  async adminCreatePlacementQuestion(body: any) {
    const payload = this.normalizePlacementQuestionPayload(body);
    const question = await this.placementQuestionModel.create(payload);
    return this.toAdminPlacementQuestion(question.toObject());
  }

  async adminGetPlacementQuestion(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid placement question id');
    }
    const question = await this.placementQuestionModel.findById(id).lean().exec();
    if (!question) {
      throw new NotFoundException('Placement question not found');
    }
    return this.toAdminPlacementQuestion(question);
  }

  async adminUpdatePlacementQuestion(id: string, body: any) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid placement question id');
    }
    const payload = this.normalizePlacementQuestionPayload(body, true);
    const question = await this.placementQuestionModel
      .findByIdAndUpdate(id, payload, { new: true, runValidators: true })
      .lean()
      .exec();
    if (!question) {
      throw new NotFoundException('Placement question not found');
    }
    return this.toAdminPlacementQuestion(question);
  }

  async adminDeletePlacementQuestion(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid placement question id');
    }
    const result = await this.placementQuestionModel
      .findByIdAndUpdate(id, { isActive: false }, { new: true, runValidators: true })
      .lean()
      .exec();
    if (!result) {
      throw new NotFoundException('Placement question not found');
    }
    return this.toAdminPlacementQuestion(result);
  }

  async adminGetPlacementTestConfig() {
    const [config, availability] = await Promise.all([
      this.placementTestConfigModel.findOne({ key: 'default' }).lean().exec(),
      this.getPlacementAvailability(),
    ]);
    const normalizedConfig = config
      ? this.toAdminPlacementTestConfig(config)
      : this.createDefaultPlacementTestConfig();

    return {
      config: normalizedConfig,
      availability,
      validation: this.validatePlacementTestConfig(normalizedConfig, availability),
    };
  }

  async adminUpdatePlacementTestConfig(body: any) {
    const availability = await this.getPlacementAvailability();
    const payload = this.normalizePlacementTestConfigPayload(body);
    const validation = this.validatePlacementTestConfig(payload, availability);

    if (!validation.isValid) {
      throw new BadRequestException(validation.errors.join(' '));
    }

    const config = await this.placementTestConfigModel
      .findOneAndUpdate(
        { key: 'default' },
        {
          key: 'default',
          totalQuestions: payload.totalQuestions,
          levelCounts: payload.levelCounts,
          skillCounts: payload.skillCounts,
          secondsPerQuestion: payload.secondsPerQuestion,
          isActive: payload.isActive,
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
      )
      .lean()
      .exec();

    return {
      config: this.toAdminPlacementTestConfig(config),
      availability,
      validation: this.validatePlacementTestConfig(config, availability),
    };
  }

  async adminGetProgressOverview(query: any = {}) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const filter: any = {};
    if (query.level && LEVELS.includes(query.level)) {
      filter.level = query.level;
    }

    const [rows, total] = await Promise.all([
      this.learningPathModel
        .find(filter)
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.learningPathModel.countDocuments(filter),
    ]);
    const userMeta = await this.getUserMetaMap(rows.map((row: any) => row.userId));
    const details = await Promise.all(
      rows.map(async (row: any) => ({
        ...this.toAdminLearningPathSummary(row, userMeta),
        progressDetail: await this.buildAdminProgressDetail(row),
      })),
    );

    return {
      data: details,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  async completeItem(userId: string, body: any) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    const skill = body?.skill as SkillType;
    const order = Number(body?.order);
    if (!skill || !Number.isFinite(order)) {
      throw new BadRequestException('skill and order are required');
    }

    const learningPath = await this.learningPathModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (!learningPath) {
      throw new NotFoundException('Learning path not found');
    }

    const currentPlan = learningPath.weeklyPlans?.[learningPath.currentWeek - 1];
    const item = currentPlan?.items?.find(
      (weeklyItem) => weeklyItem.skill === skill && weeklyItem.order === order,
    );
    if (!item) {
      throw new NotFoundException('Learning path item not found');
    }
    if (PROGRESS_TRACKED_SKILLS.includes(skill)) {
      throw new BadRequestException('This item is completed by tracked progress');
    }

    item.completedAt = item.completedAt ?? new Date();
    this.updateStreak(learningPath);

    if (currentPlan.items.every((weeklyItem) => weeklyItem.completedAt)) {
      learningPath.currentWeek = Math.min(
        learningPath.currentWeek + 1,
        learningPath.weeklyPlans.length,
      );
    }

    await learningPath.save();
    return learningPath;
  }

  async getJlptCardStatus(
    userId: string,
    query: { skill: string; level: string; refIds: string[] },
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    const skill = this.normalizeJlptSkill(query.skill);
    const refIds = (query.refIds || []).filter((id) => Types.ObjectId.isValid(id));
    const progresses = await this.jlptCardProgressModel
      .find({
        userId: new Types.ObjectId(userId),
        skill,
        level: query.level,
        refId: { $in: refIds.map((id) => new Types.ObjectId(id)) },
      })
      .lean()
      .exec();

    return {
      statuses: Object.fromEntries(
        progresses.map((progress) => [progress.refId.toString(), progress.status]),
      ),
    };
  }

  async updateJlptCardStatus(userId: string, body: any) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    const skill = this.normalizeJlptSkill(body?.skill);
    const level = body?.level;
    const refId = body?.refId;
    const status = body?.status;

    if (!level || !Types.ObjectId.isValid(refId) || !['known', 'unknown'].includes(status)) {
      throw new BadRequestException('Invalid JLPT card status payload');
    }

    await this.jlptCardProgressModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        skill,
        refId: new Types.ObjectId(refId),
      },
      {
        userId: new Types.ObjectId(userId),
        skill,
        level,
        refId: new Types.ObjectId(refId),
        status,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const knownCount = await this.getCurrentWeekKnownCount(userId, skill, level);
    const completedTask = await this.completeCurrentJlptTaskIfTargetReached(
      userId,
      skill,
      knownCount,
    );

    return {
      status,
      knownCount,
      completedTask,
    };
  }

  async generateLearningPath(userId: string, dto: GenerateLearningPathDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    const goalTypes = this.normalizeGoalTypes(dto.goal.types, dto.goal.type);
    const primaryGoalType = goalTypes[0];
    const focusSkills = dto.goal.focusSkills?.length
      ? dto.goal.focusSkills
      : this.getDefaultSkillsForGoalTypes(goalTypes);
    const totalWeeks = this.calculateTotalWeeks(dto.goal.examDate);
    const targetScore = dto.goal.targetScore !== undefined
      ? Math.min(Math.max(Math.round(Number(dto.goal.targetScore)), 0), 180)
      : undefined;
    const fallbackPlans = this.buildGenericPlans(
      dto.level,
      primaryGoalType,
      goalTypes,
      focusSkills,
      totalWeeks,
      dto.goal.dailyMinutes,
    );
    const aiPlans = await this.generateGenericPlansWithAi({
      level: dto.level,
      goalTypes,
      dailyMinutes: dto.goal.dailyMinutes,
      targetScore,
      focusSkills,
      totalWeeks,
      fallbackPlans,
    });
    const weeklyPlans = aiPlans.length ? aiPlans : fallbackPlans;
    const generationSource = aiPlans.length ? 'ai' : 'fallback';
    const warnings = aiPlans.length ? [] : ['AI generation failed, used fallback plan'];
    const generatedAt = new Date();

    const learningPath = await this.learningPathModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        $set: {
          userId: new Types.ObjectId(userId),
          level: dto.level,
          goal: {
            type: primaryGoalType,
            types: goalTypes,
            examDate: dto.goal.examDate ? new Date(dto.goal.examDate) : undefined,
            targetScore,
            dailyMinutes: dto.goal.dailyMinutes,
            focusSkills,
          },
          weeklyPlans,
          currentWeek: 1,
          streakDays: 0,
          generationSource,
          generatedAt,
        },
        $unset: {
          lastActiveAt: '',
          lastReview: '',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return {
      learningPath,
      warnings,
    };
  }

  async recordResourceProgress(
    userId: string,
    skill: string,
    body: any = {},
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }
    if (!['reading', 'writing'].includes(skill)) {
      throw new BadRequestException('Invalid resource progress skill');
    }

    const learningPath = await this.learningPathModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (!learningPath) {
      return { recorded: false, reason: 'Learning path not found' };
    }

    const { weekStart } = this.getCurrentWeekWindow(learningPath);
    const progressStartAt = this.getProgressStartAt(learningPath, weekStart);
    const weekKey = this.toWeekKey(weekStart);
    const refKey = String(
      body?.refKey || body?.refId || body?.postId || body?.resourceId || '',
    ).trim();
    if (!refKey) {
      throw new BadRequestException('refKey is required');
    }

    const userObjectId = new Types.ObjectId(userId);
    await this.learningResourceProgressModel.findOneAndUpdate(
      {
        userId: userObjectId,
        skill,
        weekKey,
        refKey,
      },
      {
        $set: {
          level: body?.level || learningPath.level,
          metadata: body?.metadata || {},
        },
        $setOnInsert: {
          userId: userObjectId,
          skill,
          refKey,
          weekKey,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const count = await this.learningResourceProgressModel.countDocuments({
      userId: userObjectId,
      skill,
      weekKey,
      updatedAt: { $gte: progressStartAt },
    });
    const completedTask = await this.completeCurrentResourceTaskIfTargetReached(
      learningPath,
      skill as ResourceProgressSkill,
      count,
    );

    return {
      recorded: true,
      skill,
      count,
      completedTask,
    };
  }

  private async findLearningPathById(id: string): Promise<LearningPathDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid learning path id');
    }
    const learningPath = await this.learningPathModel.findById(id).exec();
    if (!learningPath) {
      throw new NotFoundException('Learning path not found');
    }
    return learningPath;
  }

  private async getUserMetaMap(userIds: any[]) {
    const ids = [
      ...new Set(
        (userIds || [])
          .map((id) => id?.toString())
          .filter((id) => Types.ObjectId.isValid(id)),
      ),
    ];
    if (!ids.length) return new Map<string, any>();

    const objectIds = ids.map((id) => new Types.ObjectId(id));
    const [users, profiles] = await Promise.all([
      this.userModel
        .find({ _id: { $in: objectIds } })
        .select('email role status')
        .lean()
        .exec(),
      this.profileModel
        .find({ userId: { $in: objectIds } })
        .select('userId name image_url')
        .lean()
        .exec(),
    ]);
    const profilesByUser = new Map(
      profiles.map((profile: any) => [profile.userId?.toString(), profile]),
    );

    return new Map(
      users.map((user: any) => {
        const profile = profilesByUser.get(user._id.toString());
        return [
          user._id.toString(),
          {
            id: user._id.toString(),
            email: user.email,
            role: user.role,
            status: user.status,
            name: profile?.name,
            avatar: profile?.image_url,
          },
        ];
      }),
    );
  }

  private toAdminLearningPathSummary(learningPath: any, userMeta: Map<string, any>) {
    const userId = learningPath.userId?.toString();
    const progress = this.calculatePlanProgress(learningPath);
    return {
      id: learningPath._id?.toString(),
      userId,
      user: userMeta.get(userId) || { id: userId },
      level: learningPath.level,
      goal: learningPath.goal,
      currentWeek: learningPath.currentWeek || 1,
      generationSource: learningPath.generationSource || 'fallback',
      streakDays: learningPath.streakDays || 0,
      weeklyPlanCount: learningPath.weeklyPlans?.length || 0,
      lastReview: learningPath.lastReview,
      progress,
      createdAt: learningPath.createdAt,
      generatedAt: learningPath.generatedAt,
      updatedAt: learningPath.updatedAt,
    };
  }

  private toAdminLearningPathDetail(learningPath: any, userMeta: Map<string, any>) {
    return {
      ...this.toAdminLearningPathSummary(learningPath, userMeta),
      weeklyPlans: (learningPath.weeklyPlans || []).map((plan: any) => ({
        week: Number(plan.week) || 1,
        items: (plan.items || []).map((item: any, index: number) => ({
          skill: item.skill,
          refId: item.refId?.toString(),
          refModel: item.refModel,
          title: item.title,
          targetCount: item.targetCount || 1,
          order: Number(item.order) || index + 1,
          estimatedMinutes: item.estimatedMinutes || 15,
          completedAt: item.completedAt,
        })),
      })),
    };
  }

  private calculatePlanProgress(learningPath: any) {
    const weeklyPlans = learningPath.weeklyPlans || [];
    const allItems = weeklyPlans.flatMap((plan: any) => plan.items || []);
    const currentWeek = Number(learningPath.currentWeek) || 1;
    const currentPlan =
      weeklyPlans.find((plan: any) => Number(plan.week) === currentWeek) ||
      weeklyPlans[currentWeek - 1];
    const currentItems = currentPlan?.items || [];
    const currentCompleted = currentItems.filter((item: any) => item.completedAt).length;
    const totalCompleted = allItems.filter((item: any) => item.completedAt).length;
    const skillStats = allItems.reduce((acc: any, item: any) => {
      const skill = item.skill || 'unknown';
      const current = acc[skill] || { total: 0, completed: 0 };
      current.total += 1;
      if (item.completedAt) current.completed += 1;
      acc[skill] = current;
      return acc;
    }, {});
    const startedAt = this.getLearningPathStartAt(learningPath);
    const daysElapsed = !startedAt
      ? 0
      : Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / (24 * 60 * 60 * 1000)));
    const expectedWeek = Math.max(1, Math.floor(daysElapsed / 7) + 1);

    return {
      currentWeek,
      currentWeekTotal: currentItems.length,
      currentWeekCompleted: currentCompleted,
      currentWeekPercent: currentItems.length
        ? Math.round((currentCompleted / currentItems.length) * 100)
        : 0,
      totalItems: allItems.length,
      completedItems: totalCompleted,
      totalPercent: allItems.length ? Math.round((totalCompleted / allItems.length) * 100) : 0,
      skillStats,
      daysElapsed,
      expectedWeek,
      isBehind: expectedWeek > currentWeek + 1,
      lastActiveAt: learningPath.lastActiveAt,
    };
  }

  private async buildAdminProgressDetail(learningPath: any) {
    const userId = learningPath.userId;
    if (!userId || !Types.ObjectId.isValid(userId.toString())) {
      return null;
    }
    const userObjectId = new Types.ObjectId(userId.toString());

    const [cardStats, resourceStats, examStats] = await Promise.all([
      this.jlptCardProgressModel
        .aggregate([
          { $match: { userId: userObjectId } },
          {
            $group: {
              _id: { skill: '$skill', status: '$status' },
              count: { $sum: 1 },
            },
          },
        ])
        .exec(),
      this.learningResourceProgressModel
        .aggregate([
          { $match: { userId: userObjectId } },
          {
            $group: {
              _id: '$skill',
              count: { $sum: 1 },
              lastUpdatedAt: { $max: '$updatedAt' },
            },
          },
        ])
        .exec(),
      this.examResultModel
        .find({ userId: userObjectId, status: ExamResultStatus.COMPLETED })
        .sort({ end_time: -1, updatedAt: -1 })
        .limit(20)
        .lean()
        .exec(),
    ]);

    const cards = cardStats.reduce((acc: any, row: any) => {
      const skill = row._id?.skill;
      const status = row._id?.status;
      if (!skill || !status) return acc;
      acc[skill] = acc[skill] || { known: 0, unknown: 0 };
      acc[skill][status] = row.count;
      return acc;
    }, {});
    const resources = resourceStats.reduce((acc: any, row: any) => {
      acc[row._id] = {
        completedResources: row.count,
        lastUpdatedAt: row.lastUpdatedAt,
      };
      return acc;
    }, {});
    const scores = examStats.map((result: any) => Number(result.total_score) || 0);

    return {
      plan: this.calculatePlanProgress(learningPath),
      cards,
      resources,
      exams: {
        attemptCount: examStats.length,
        passedCount: examStats.filter((result: any) => result.passed).length,
        latestScore: scores[0] ?? null,
        bestScore: scores.length ? Math.max(...scores) : null,
        averageScore: scores.length
          ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
          : null,
        latestAt: examStats[0]?.end_time || (examStats[0] as any)?.updatedAt || null,
      },
    };
  }

  private normalizeAdminWeeklyPlans(plans: any[]): WeeklyPlan[] {
    return plans
      .map((plan: any, planIndex: number) => {
        const week = Math.max(Math.round(Number(plan.week) || planIndex + 1), 1);
        const items = Array.isArray(plan.items) ? plan.items : [];
        return {
          week,
          items: items
            .map((item: any, itemIndex: number) => this.normalizeAdminWeeklyItem(item, itemIndex))
            .filter(Boolean) as WeeklyItem[],
        };
      })
      .filter((plan) => plan.items.length > 0)
      .sort((a, b) => a.week - b.week)
      .map((plan, index) => ({
        ...plan,
        week: index + 1,
        items: plan.items.map((item, itemIndex) => ({
          ...item,
          order: itemIndex + 1,
        })),
      }));
  }

  private normalizeAdminWeeklyItem(item: any, index: number): WeeklyItem | null {
    const skill = item?.skill as SkillType;
    if (!SUPPORTED_CONTENT_SKILLS.includes(skill)) return null;

    const normalized: WeeklyItem = {
      skill,
      title: String(item?.title || '').trim() || this.getGenericTaskTitle(skill, '', 1),
      targetCount: Math.min(Math.max(Math.round(Number(item?.targetCount) || 1), 1), 500),
      order: index + 1,
      estimatedMinutes: Math.min(Math.max(Math.round(Number(item?.estimatedMinutes) || 15), 1), 1440),
    };
    if (item?.refId && Types.ObjectId.isValid(item.refId)) {
      normalized.refId = new Types.ObjectId(item.refId);
    }
    if (item?.refModel) {
      normalized.refModel = String(item.refModel).trim();
    }
    if (item?.completedAt) {
      const completedAt = new Date(item.completedAt);
      if (!Number.isNaN(completedAt.getTime())) {
        normalized.completedAt = completedAt;
      }
    }

    return normalized;
  }

  private normalizeSkillList(skills: any): SkillType[] {
    const allowed = new Set<SkillType>(SUPPORTED_CONTENT_SKILLS);
    const normalized = Array.isArray(skills)
      ? skills.filter((skill): skill is SkillType => allowed.has(skill))
      : [];
    return [...new Set(normalized)].length ? [...new Set(normalized)] : ['vocab', 'grammar', 'kanji'];
  }

  private normalizePlacementQuestionPayload(body: any, partial = false) {
    const payload: any = {};
    const content = String(body?.content || '').trim();
    const options = Array.isArray(body?.options)
      ? body.options.map((option: any) => String(option || '').trim()).filter(Boolean)
      : [];
    const correctAnswer = Number(body?.correctAnswer);
    const level = body?.level;
    const skill = body?.skill;

    if (!partial || content) payload.content = content;
    if (!partial || options.length) payload.options = options;
    if (!partial || Number.isFinite(correctAnswer)) payload.correctAnswer = correctAnswer;
    if (!partial || level) payload.level = level;
    if (!partial || skill) payload.skill = skill;
    if (!partial || Object.prototype.hasOwnProperty.call(body || {}, 'explanation')) {
      payload.explanation = String(body?.explanation || '').trim();
    }
    if (!partial || Object.prototype.hasOwnProperty.call(body || {}, 'isActive')) {
      payload.isActive = body?.isActive !== false;
    }
    if (!partial || Object.prototype.hasOwnProperty.call(body || {}, 'difficulty')) {
      payload.difficulty = ['easy', 'medium', 'hard'].includes(body?.difficulty)
        ? body.difficulty
        : 'medium';
    }
    if (!partial || Object.prototype.hasOwnProperty.call(body || {}, 'tags')) {
      payload.tags = Array.isArray(body?.tags)
        ? body.tags.map((tag: any) => String(tag || '').trim()).filter(Boolean)
        : [];
    }
    if (!partial || Object.prototype.hasOwnProperty.call(body || {}, 'general')) {
      payload.general = this.normalizePlacementGeneral(body?.general);
    }

    if (!partial || content || options.length || Number.isFinite(correctAnswer) || level || skill) {
      if (!payload.content) throw new BadRequestException('content is required');
      if (!Array.isArray(payload.options) || payload.options.length !== 4) {
        throw new BadRequestException('options must include 4 choices');
      }
      if (!Number.isInteger(payload.correctAnswer) || payload.correctAnswer < 0 || payload.correctAnswer > 3) {
        throw new BadRequestException('correctAnswer must be 0-3');
      }
      if (!LEVELS.includes(payload.level)) {
        throw new BadRequestException('Invalid placement level');
      }
      if (!PLACEMENT_SKILLS.includes(payload.skill)) {
        throw new BadRequestException('Invalid placement skill');
      }
    }

    return payload;
  }

  private toAdminPlacementQuestion(question: any) {
    return {
      id: question._id?.toString(),
      content: question.content,
      options: question.options || [],
      correctAnswer: question.correctAnswer,
      level: question.level,
      skill: question.skill,
      general: question.general || {},
      explanation: question.explanation || '',
      isActive: question.isActive !== false,
      difficulty: question.difficulty || 'medium',
      tags: question.tags || [],
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  }

  private normalizePlacementGeneral(general: any) {
    const audioScript = general?.audioScript;
    return {
      audio: String(general?.audio || '').trim(),
      image: String(general?.image || '').trim(),
      txt_read: String(general?.txt_read || '').trim(),
      audioScript: audioScript && Array.isArray(audioScript.lines)
        ? {
            mode: audioScript.mode === 'dialogue' ? 'dialogue' : 'single',
            pauseMs: Math.max(Number(audioScript.pauseMs) || 500, 0),
            lines: audioScript.lines
              .map((line: any) => ({
                speakerLabel: String(line?.speakerLabel || '').trim(),
                speakerId: Number.isFinite(Number(line?.speakerId)) ? Number(line.speakerId) : undefined,
                text: String(line?.text || '').trim(),
              }))
              .filter((line: any) => line.text),
          }
        : null,
    };
  }

  private createEmptyPlacementLevelCounts(): PlacementLevelCounts {
    return Object.fromEntries(LEVELS.map((level) => [level, 0])) as PlacementLevelCounts;
  }

  private createEmptyPlacementSkillMatrix(): PlacementTestSkillMatrix {
    return Object.fromEntries(
      LEVELS.map((level) => [
        level,
        Object.fromEntries(
          PLACEMENT_SKILLS.map((skill) => [skill, 0]),
        ) as PlacementSkillCounts,
      ]),
    ) as PlacementTestSkillMatrix;
  }

  private createDefaultPlacementTestConfig() {
    const skillCounts = this.createEmptyPlacementSkillMatrix();
    const levelCounts = this.createEmptyPlacementLevelCounts();
    for (const level of LEVELS) {
      skillCounts[level] = { vocab: 2, grammar: 2, listening: 0 };
      levelCounts[level] = 4;
    }

    return {
      id: null,
      totalQuestions: 20,
      levelCounts,
      skillCounts,
      secondsPerQuestion: 90,
      isActive: true,
      createdAt: null,
      updatedAt: null,
    };
  }

  private toAdminPlacementTestConfig(config: any) {
    const normalized = this.normalizePlacementTestConfigPayload(config);
    return {
      id: config?._id?.toString() || null,
      ...normalized,
      createdAt: config?.createdAt || null,
      updatedAt: config?.updatedAt || null,
    };
  }

  private normalizePlacementTestConfigPayload(body: any) {
    const totalQuestions = this.normalizePlacementCount(
      body?.totalQuestions,
      'totalQuestions',
      true,
    );
    const levelCounts = this.createEmptyPlacementLevelCounts();
    const skillCounts = this.createEmptyPlacementSkillMatrix();

    for (const level of LEVELS) {
      levelCounts[level] = this.normalizePlacementCount(
        body?.levelCounts?.[level],
        `levelCounts.${level}`,
      );
      for (const skill of PLACEMENT_SKILLS) {
        skillCounts[level][skill] = this.normalizePlacementCount(
          body?.skillCounts?.[level]?.[skill],
          `skillCounts.${level}.${skill}`,
        );
      }
    }

    return {
      totalQuestions,
      levelCounts,
      skillCounts,
      secondsPerQuestion: this.normalizePlacementSecondsPerQuestion(body?.secondsPerQuestion),
      isActive: body?.isActive !== false,
    };
  }

  private normalizePlacementSecondsPerQuestion(value: any) {
    const numberValue = Number(value) || 90;
    return PLACEMENT_SECONDS_PER_QUESTION_OPTIONS.includes(numberValue)
      ? numberValue
      : 90;
  }

  private normalizePlacementCount(value: any, field: string, positive = false) {
    const numberValue = Number(value);
    if (!Number.isInteger(numberValue) || numberValue < (positive ? 1 : 0)) {
      throw new BadRequestException(`${field} must be a ${positive ? 'positive ' : ''}integer`);
    }
    return numberValue;
  }

  private validatePlacementTestConfig(
    config: any,
    availability: PlacementAvailability,
  ): PlacementConfigValidation {
    const errors: string[] = [];
    const levelTotal = LEVELS.reduce(
      (total, level) => total + Number(config?.levelCounts?.[level] || 0),
      0,
    );

    if (levelTotal !== Number(config?.totalQuestions || 0)) {
      errors.push(
        `Tổng số câu theo level (${levelTotal}) phải bằng tổng số câu bộ test (${config?.totalQuestions || 0}).`,
      );
    }

    for (const level of LEVELS) {
      const skillTotal = PLACEMENT_SKILLS.reduce(
        (total, skill) => total + Number(config?.skillCounts?.[level]?.[skill] || 0),
        0,
      );
      const levelCount = Number(config?.levelCounts?.[level] || 0);
      if (skillTotal !== levelCount) {
        errors.push(
          `${level}: tổng vocab/grammar/listening (${skillTotal}) phải bằng số câu ${level} (${levelCount}).`,
        );
      }

      for (const skill of PLACEMENT_SKILLS) {
        const requested = Number(config?.skillCounts?.[level]?.[skill] || 0);
        const available = Number(availability.skillCounts[level]?.[skill] || 0);
        if (requested > available) {
          errors.push(
            `${level} ${skill}: cần ${requested} câu nhưng ngân hàng active chỉ có ${available}.`,
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private async getPlacementAvailability(): Promise<PlacementAvailability> {
    const skillCounts = this.createEmptyPlacementSkillMatrix();
    const levelCounts = this.createEmptyPlacementLevelCounts();
    const rows = await this.placementQuestionModel
      .aggregate([
        { $match: { isActive: { $ne: false } } },
        { $group: { _id: { level: '$level', skill: '$skill' }, count: { $sum: 1 } } },
      ])
      .exec();

    for (const row of rows) {
      const level = row?._id?.level as PlacementLevel;
      const skill = row?._id?.skill as PlacementSkill;
      if (!LEVELS.includes(level) || !PLACEMENT_SKILLS.includes(skill)) continue;
      skillCounts[level][skill] = Number(row.count) || 0;
      levelCounts[level] += Number(row.count) || 0;
    }

    return {
      total: LEVELS.reduce((total, level) => total + levelCounts[level], 0),
      levelCounts,
      skillCounts,
    };
  }

  private async getConfiguredPlacementQuestions(config: any) {
    const normalizedConfig = this.toAdminPlacementTestConfig(config);
    const availability = await this.getPlacementAvailability();
    const validation = this.validatePlacementTestConfig(normalizedConfig, availability);
    if (!validation.isValid) {
      throw new BadRequestException(validation.errors.join(' '));
    }

    const selected: any[] = [];
    for (const level of LEVELS) {
      for (const skill of PLACEMENT_SKILLS) {
        const size = normalizedConfig.skillCounts[level][skill];
        if (size <= 0) continue;
        const questions = await this.samplePlacementQuestions(level, skill, size);
        if (questions.length < size) {
          throw new BadRequestException(
            `${level} ${skill}: không đủ câu hỏi active để tạo đề.`,
          );
        }
        selected.push(...questions);
      }
    }

    const questions = this.shuffle(selected).map((question: any) => ({
      id: question._id?.toString(),
      content: question.content,
      options: question.options,
      level: question.level,
      skill: question.skill,
      general: question.general || {},
    }));

    return {
      questions,
      secondsPerQuestion: normalizedConfig.secondsPerQuestion,
      totalSeconds: questions.length * normalizedConfig.secondsPerQuestion,
    };
  }

  private samplePlacementQuestions(level: PlacementLevel, skill: PlacementSkill, size: number) {
    return this.placementQuestionModel
      .aggregate([
        { $match: { level, skill, isActive: { $ne: false } } },
        { $sample: { size } },
      ])
      .exec();
  }

  private createStatsMap<T extends string>(keys: readonly T[]) {
    return Object.fromEntries(keys.map((key) => [key, { correct: 0, total: 0 }])) as Record<
      T,
      { correct: number; total: number }
    >;
  }

  private toPercent(stats: { correct: number; total: number }) {
    if (!stats.total) return 0;
    return Math.round((stats.correct / stats.total) * 100);
  }

  private suggestLevel(levelBreakdown: Record<PlacementLevel, number>): PlacementLevel {
    return this.getMaxAllowedPlacementLevel(levelBreakdown);
  }

  private getMaxAllowedPlacementLevel(
    levelBreakdown: Record<PlacementLevel, number>,
  ): PlacementLevel {
    let selected: PlacementLevel = 'N5';
    for (const level of LEVELS) {
      if (this.passesPlacementRequirements(level, levelBreakdown)) {
        selected = level;
      }
    }
    return selected;
  }

  private passesPlacementRequirements(
    targetLevel: PlacementLevel,
    levelBreakdown: Record<PlacementLevel, number>,
  ) {
    const requirements = PLACEMENT_LEVEL_REQUIREMENTS[targetLevel];
    return Object.entries(requirements).every(
      ([level, minScore]) =>
        (levelBreakdown[level as PlacementLevel] ?? 0) >= Number(minScore),
    );
  }

  private clampPlacementLevel(level: PlacementLevel, maxLevel: PlacementLevel) {
    return LEVELS[Math.min(LEVELS.indexOf(level), LEVELS.indexOf(maxLevel))];
  }

  private calculateConfidence(
    levelBreakdown: Record<PlacementLevel, number>,
    suggestedLevel: PlacementLevel,
  ) {
    const selectedIndex = LEVELS.indexOf(suggestedLevel);
    const selectedScore = levelBreakdown[suggestedLevel] ?? 0;
    const nextLevel = LEVELS[selectedIndex + 1];
    const previousLevel = LEVELS[selectedIndex - 1];
    const neighborScore = Math.max(
      nextLevel ? levelBreakdown[nextLevel] ?? 0 : 0,
      previousLevel ? levelBreakdown[previousLevel] ?? 0 : 0,
    );
    return Math.min(Math.abs(selectedScore - neighborScore) / 100, 1);
  }

  private async askAiForBoundaryLevel(
    levelBreakdown: Record<PlacementLevel, number>,
    skillBreakdown: Record<PlacementSkill, number>,
    fallback: PlacementLevel,
    maxAllowedLevel: PlacementLevel,
  ): Promise<PlacementLevel> {
    try {
      const prompt = `
User placement JLPT breakdown: ${JSON.stringify(levelBreakdown)}.
Skill vocab: ${skillBreakdown.vocab}%, grammar: ${skillBreakdown.grammar}%, listening: ${skillBreakdown.listening}%.

IMPORTANT grading rules:
- Apply a heavy foundation penalty. If the user misses easy levels, do NOT reward lucky guesses at higher levels.
- The maximum allowed suggested level is ${maxAllowedLevel}. Never suggest a level higher than ${maxAllowedLevel}.
- To suggest N4+, N5 must be >= 60%.
- To suggest N3+, N5 and N4 must be >= 60%.
- To suggest N2, N5 must be >= 75%, and N4/N3/N2 must pass the required thresholds.
- To suggest N1, N5 and N4 must be >= 75%, and N3/N2/N1 must pass the required thresholds.

Goi y level phu hop de bat dau hoc va ly do.
Tra ve JSON {"suggestedLevel":"N5|N4|N3|N2|N1","reason":"..."}
`;
      const raw = await this.aiClient.generate(prompt);
      const parsed = this.parseJson(raw);
      if (LEVELS.includes(parsed?.suggestedLevel)) {
        return this.clampPlacementLevel(parsed.suggestedLevel, maxAllowedLevel);
      }
    } catch (error) {
      this.logger.warn(`AI boundary level failed: ${error?.message ?? error}`);
    }
    return fallback;
  }

  private calculateTotalWeeks(examDate?: string) {
    if (!examDate) return 8;

    const examTime = new Date(examDate).getTime();
    if (Number.isNaN(examTime)) return 8;

    const diffMs = examTime - Date.now();
    const weeks = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));
    return Math.min(Math.max(weeks, 1), 16);
  }

  private normalizeJlptSkill(skill: string): 'vocab' | 'grammar' | 'kanji' {
    if (skill === 'word') return 'vocab';
    if (['vocab', 'grammar', 'kanji'].includes(skill)) {
      return skill as 'vocab' | 'grammar' | 'kanji';
    }
    throw new BadRequestException('Invalid JLPT skill');
  }

  private shouldConvertToGenericPlan(learningPath: LearningPathDocument) {
    const firstItem = learningPath.weeklyPlans?.[0]?.items?.[0];
    return Boolean(firstItem?.refId && !firstItem?.targetCount);
  }

  private getCurrentWeekWindow(learningPath: LearningPathDocument) {
    const now = new Date();
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const daysFromMonday = day === 0 ? 6 : day - 1;
    weekStart.setDate(weekStart.getDate() - daysFromMonday);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    return { weekStart, weekEnd };
  }

  private getLearningPathStartAt(learningPath: any) {
    const startedAt = new Date(learningPath?.generatedAt || learningPath?.createdAt);
    return Number.isNaN(startedAt.getTime()) ? null : startedAt;
  }

  private getProgressStartAt(learningPath: any, weekStart: Date) {
    const startedAt = this.getLearningPathStartAt(learningPath);
    return startedAt && startedAt > weekStart ? startedAt : weekStart;
  }

  private toWeekKey(weekStart: Date) {
    return weekStart.toISOString().slice(0, 10);
  }

  private getTodayProgressWindow(learningPath: any) {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const progressStartAt = this.getProgressStartAt(learningPath, dayStart);
    return { progressStartAt, now };
  }

  private async buildTodayTasks(
    userId: string,
    learningPath: LearningPathDocument,
    enrichedWeekItems: any[],
    dailyMinutes: number,
  ) {
    const userObjectId = new Types.ObjectId(userId);
    const { progressStartAt, now } = this.getTodayProgressWindow(learningPath);
    const { weekStart } = this.getCurrentWeekWindow(learningPath);
    const weekKey = this.toWeekKey(weekStart);
    const level = learningPath.level;
    const examIds = await this.examModel
      .find({ level }, { _id: 1 })
      .lean()
      .exec();
    const examObjectIds = examIds.map((exam: any) => exam._id);

    const [knownTodayBySkill, passedExamTodayCount, latestPassedExamToday, resourceTodayCounts] =
      await Promise.all([
        this.getWeeklyKnownCounts(userObjectId, level, progressStartAt, now),
        examObjectIds.length
          ? this.examResultModel.countDocuments({
              userId: userObjectId,
              examId: { $in: examObjectIds },
              status: ExamResultStatus.COMPLETED,
              total_score: { $gte: 80 },
              end_time: { $gte: progressStartAt, $lte: now },
            })
          : 0,
        examObjectIds.length
          ? this.examResultModel
              .findOne({
                userId: userObjectId,
                examId: { $in: examObjectIds },
                status: ExamResultStatus.COMPLETED,
                end_time: { $gte: progressStartAt, $lte: now },
              })
              .sort({ total_score: -1, end_time: -1, createdAt: -1 })
              .lean()
              .exec()
          : null,
        this.getWeeklyResourceCounts(userObjectId, weekKey, progressStartAt),
      ]);

    const dailyCaps = this.getGenericTaskCounts(dailyMinutes);
    const tasks: any[] = [];
    let assignedMinutes = 0;

    for (const item of enrichedWeekItems
      .filter((weekItem) => !weekItem.progress?.isComplete)
      .sort((a, b) => (a.order || 0) - (b.order || 0))) {
      if (assignedMinutes >= dailyMinutes && tasks.length) break;

      const weeklyTarget = Number(item.progress?.target ?? item.targetCount) || 1;
      const weeklyCount = Number(item.progress?.count) || 0;
      const remainingWeeklyCount = Math.max(weeklyTarget - weeklyCount, 0);
      if (!remainingWeeklyCount) continue;

      const unitMinutes = Math.max(
        this.getGenericEstimatedMinutes(item.skill, weeklyTarget) / weeklyTarget,
        1,
      );
      const remainingMinutes = Math.max(dailyMinutes - assignedMinutes, 0);
      const affordableCount = remainingMinutes > 0
        ? Math.max(1, Math.ceil(remainingMinutes / unitMinutes))
        : 1;
      const dailyTarget = Math.max(
        1,
        Math.min(remainingWeeklyCount, dailyCaps[item.skill] ?? remainingWeeklyCount, affordableCount),
      );
      const estimatedMinutes = Math.max(1, Math.ceil(unitMinutes * dailyTarget));
      const todayProgressCount = Math.min(
        this.getTodayProgressCountForSkill(
          item.skill,
          knownTodayBySkill,
          passedExamTodayCount,
          resourceTodayCounts,
        ),
        dailyTarget,
      );
      const percent = Math.min(100, Math.round((todayProgressCount / dailyTarget) * 100));

      assignedMinutes += estimatedMinutes;
      if (percent >= 100) continue;

      tasks.push({
        ...item,
        title: this.getGenericTaskTitle(item.skill, learningPath.level, dailyTarget),
        targetCount: dailyTarget,
        estimatedMinutes,
        completedAt: undefined,
        progress: {
          ...(item.progress || {}),
          count: todayProgressCount,
          target: dailyTarget,
          percent,
          isComplete: false,
          label: this.getProgressLabel(item.skill, todayProgressCount, dailyTarget, true),
          requirement: this.getTodayRequirement(item.skill, dailyTarget),
          latestScore:
            item.skill === 'jlpt_exam' && latestPassedExamToday
              ? Number((latestPassedExamToday as any).total_score) || 0
              : null,
        },
      });
    }

    return tasks;
  }

  private getTodayProgressCountForSkill(
    skill: SkillType,
    knownTodayBySkill: Record<string, number>,
    passedExamTodayCount: number,
    resourceTodayCounts: Record<ResourceProgressSkill, number>,
  ) {
    if (['vocab', 'grammar', 'kanji'].includes(skill)) {
      return Number(knownTodayBySkill[skill]) || 0;
    }
    if (skill === 'jlpt_exam') return Number(passedExamTodayCount) || 0;
    if (skill === 'reading') return Number(resourceTodayCounts.reading) || 0;
    if (skill === 'writing') return Number(resourceTodayCounts.writing) || 0;
    return 0;
  }

  private getProgressLabel(
    skill: SkillType,
    count: number,
    target: number,
    today = false,
  ) {
    const suffix = today ? ' hôm nay' : '';
    if (skill === 'jlpt_exam') return `${count}/${target} đề đạt >=80${suffix}`;
    if (skill === 'reading') return `${count}/${target} bài đọc${suffix}`;
    if (skill === 'writing') return `${count}/${target} PDF${suffix}`;
    return `${count}/${target} mục${suffix}`;
  }

  private getTodayRequirement(skill: SkillType, target: number) {
    if (['vocab', 'grammar', 'kanji'].includes(skill)) {
      return `Mục tiêu hôm nay: đánh dấu Đã thuộc ${target} mục`;
    }
    if (skill === 'jlpt_exam') return `Mục tiêu hôm nay: hoàn thành ${target} đề đạt từ 80 điểm`;
    if (skill === 'reading') return `Mục tiêu hôm nay: đọc ${target} bài`;
    if (skill === 'writing') return `Mục tiêu hôm nay: tải ${target} PDF luyện viết`;
    if (skill === 'conversation') return `Mục tiêu hôm nay: luyện ${target} bài hội thoại`;
    return `Mục tiêu hôm nay: hoàn thành ${target} mục`;
  }

  private async enrichWeeklyItems(
    userId: string,
    learningPath: LearningPathDocument,
    weekItems: WeeklyItem[],
  ) {
    const userObjectId = new Types.ObjectId(userId);
    const { weekStart, weekEnd } = this.getCurrentWeekWindow(learningPath);
    const progressStartAt = this.getProgressStartAt(learningPath, weekStart);
    const weekKey = this.toWeekKey(weekStart);
    const level = learningPath.level;
    const examIds = await this.examModel
      .find({ level }, { _id: 1 })
      .lean()
      .exec();
    const examObjectIds = examIds.map((exam: any) => exam._id);

    const [knownBySkill, passedExamCount, latestPassedExam, resourceCounts] = await Promise.all([
      this.getWeeklyKnownCounts(userObjectId, level, progressStartAt, weekEnd),
      examObjectIds.length
        ? this.examResultModel.countDocuments({
            userId: userObjectId,
            examId: { $in: examObjectIds },
            status: ExamResultStatus.COMPLETED,
            total_score: { $gte: 80 },
            end_time: { $gte: progressStartAt, $lt: weekEnd },
          })
        : 0,
      examObjectIds.length
        ? this.examResultModel
            .findOne({
              userId: userObjectId,
              examId: { $in: examObjectIds },
              status: ExamResultStatus.COMPLETED,
              end_time: { $gte: progressStartAt, $lt: weekEnd },
            })
            .sort({ total_score: -1, end_time: -1, createdAt: -1 })
            .lean()
            .exec()
        : null,
      this.getWeeklyResourceCounts(userObjectId, weekKey, progressStartAt),
    ]);

    return weekItems.map((item: any) => {
      const targetCount = Number(item.targetCount) || 1;
      const isTrackedSkill = PROGRESS_TRACKED_SKILLS.includes(item.skill);
      let progressCount = !isTrackedSkill && item.completedAt ? targetCount : 0;
      let requirement = '';
      let latestScore: number | null = null;

      if (['vocab', 'grammar', 'kanji'].includes(item.skill)) {
        progressCount = Math.min(Number(knownBySkill[item.skill]) || 0, targetCount);
        requirement = 'Đánh dấu Đã thuộc trong flashcard';
      } else if (item.skill === 'jlpt_exam') {
        progressCount = Math.min(Number(passedExamCount) || 0, targetCount);
        requirement = 'Hoàn thành đề JLPT đạt từ 80 điểm';
        latestScore = latestPassedExam ? Number((latestPassedExam as any).total_score) || 0 : null;
      } else if (item.skill === 'reading') {
        progressCount = Math.min(Number(resourceCounts.reading) || 0, targetCount);
        requirement = 'Đọc bài trong mục Luyện đọc';
      } else if (item.skill === 'writing') {
        progressCount = Math.min(Number(resourceCounts.writing) || 0, targetCount);
        requirement = 'Tải PDF luyện viết kanji';
      } else if (item.completedAt) {
        progressCount = targetCount;
      }

      const percent = targetCount
        ? Math.min(100, Math.round((progressCount / targetCount) * 100))
        : 0;

      const plainItem = item.toObject?.() ?? item;
      const isComplete = isTrackedSkill
        ? percent >= 100
        : Boolean(item.completedAt) || percent >= 100;

      return {
        ...plainItem,
        completedAt: isComplete ? plainItem.completedAt : undefined,
        targetCount,
        progress: {
          count: progressCount,
          target: targetCount,
          percent,
          isComplete,
          label: this.getProgressLabel(item.skill, progressCount, targetCount),
          requirement,
          latestScore,
        },
      };
    });
  }

  private async getWeeklyKnownCounts(
    userId: Types.ObjectId,
    level: string,
    progressStartAt: Date,
    weekEnd: Date,
  ) {
    const rows = await this.jlptCardProgressModel
      .aggregate([
        {
          $match: {
            userId,
            level,
            status: 'known',
            updatedAt: { $gte: progressStartAt, $lt: weekEnd },
          },
        },
        { $group: { _id: '$skill', count: { $sum: 1 } } },
      ])
      .exec();

    return rows.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {} as Record<string, number>);
  }

  private async getWeeklyResourceCounts(
    userId: Types.ObjectId,
    weekKey: string,
    progressStartAt: Date,
  ) {
    const rows = await this.learningResourceProgressModel
      .aggregate([
        {
          $match: {
            userId,
            weekKey,
            skill: { $in: ['reading', 'writing'] },
            updatedAt: { $gte: progressStartAt },
          },
        },
        { $group: { _id: '$skill', count: { $sum: 1 } } },
      ])
      .exec();

    return rows.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {} as Record<ResourceProgressSkill, number>);
  }

  private applyAutoCompletedItems(
    learningPath: LearningPathDocument,
    enrichedWeekItems: any[],
  ) {
    const currentPlan = learningPath.weeklyPlans?.[learningPath.currentWeek - 1];
    if (!currentPlan) return false;

    let changed = false;
    for (const enrichedItem of enrichedWeekItems) {
      const sourceItem = currentPlan.items.find(
        (item) => item.skill === enrichedItem.skill && item.order === enrichedItem.order,
      );
      if (!sourceItem) continue;

      const isTrackedSkill = PROGRESS_TRACKED_SKILLS.includes(sourceItem.skill);
      if (isTrackedSkill && sourceItem.completedAt && !enrichedItem.progress?.isComplete) {
        sourceItem.completedAt = undefined;
        enrichedItem.completedAt = undefined;
        changed = true;
        continue;
      }

      if (enrichedItem.progress?.isComplete && !sourceItem.completedAt) {
        sourceItem.completedAt = new Date();
        enrichedItem.completedAt = sourceItem.completedAt;
        changed = true;
      }
    }

    return changed;
  }

  private updateStreak(learningPath: LearningPathDocument) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastActiveAt = learningPath.lastActiveAt
      ? new Date(learningPath.lastActiveAt)
      : null;
    const lastActiveDay = lastActiveAt
      ? new Date(lastActiveAt.getFullYear(), lastActiveAt.getMonth(), lastActiveAt.getDate())
      : null;

    if (!lastActiveDay) {
      learningPath.streakDays = 1;
    } else {
      const diffDays = Math.floor(
        (today.getTime() - lastActiveDay.getTime()) / (24 * 60 * 60 * 1000),
      );
      if (diffDays === 1) {
        learningPath.streakDays += 1;
      } else if (diffDays > 1) {
        learningPath.streakDays = 1;
      }
    }

    learningPath.lastActiveAt = now;
  }

  private async getCurrentWeekKnownCount(
    userId: string,
    skill: 'vocab' | 'grammar' | 'kanji',
    level: string,
  ) {
    const learningPath = await this.learningPathModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (!learningPath) return 0;

    const { weekStart, weekEnd } = this.getCurrentWeekWindow(learningPath);
    const progressStartAt = this.getProgressStartAt(learningPath, weekStart);
    return this.jlptCardProgressModel.countDocuments({
      userId: new Types.ObjectId(userId),
      skill,
      level,
      status: 'known',
      updatedAt: { $gte: progressStartAt, $lt: weekEnd },
    });
  }

  private async completeCurrentJlptTaskIfTargetReached(
    userId: string,
    skill: 'vocab' | 'grammar' | 'kanji',
    knownCount: number,
  ) {
    const learningPath = await this.learningPathModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (!learningPath) return null;

    const currentPlan = learningPath.weeklyPlans?.[learningPath.currentWeek - 1];
    const item = currentPlan?.items?.find(
      (weeklyItem) => weeklyItem.skill === skill && !weeklyItem.completedAt,
    );
    if (!item || knownCount < (item.targetCount || 1)) return null;

    item.completedAt = new Date();
    this.updateStreak(learningPath);

    if (currentPlan.items.every((weeklyItem) => weeklyItem.completedAt)) {
      learningPath.currentWeek = Math.min(
        learningPath.currentWeek + 1,
        learningPath.weeklyPlans.length,
      );
    }

    await learningPath.save();
    return {
      skill: item.skill,
      order: item.order,
      title: item.title,
      completedAt: item.completedAt,
    };
  }

  private async completeCurrentResourceTaskIfTargetReached(
    learningPath: LearningPathDocument,
    skill: ResourceProgressSkill,
    count: number,
  ) {
    const currentPlan = learningPath.weeklyPlans?.[learningPath.currentWeek - 1];
    const item = currentPlan?.items?.find(
      (weeklyItem) => weeklyItem.skill === skill && !weeklyItem.completedAt,
    );
    if (!item || count < (item.targetCount || 1)) return null;

    item.completedAt = new Date();
    this.updateStreak(learningPath);

    if (currentPlan.items.every((weeklyItem) => weeklyItem.completedAt)) {
      learningPath.currentWeek = Math.min(
        learningPath.currentWeek + 1,
        learningPath.weeklyPlans.length,
      );
    }

    await learningPath.save();
    return {
      skill: item.skill,
      order: item.order,
      title: item.title,
      completedAt: item.completedAt,
    };
  }

  private async buildReviewStats(
    userId: string,
    learningPath: LearningPathDocument,
    enrichedWeekItems: any[],
  ) {
    const completedItems = enrichedWeekItems.filter((item) => item.progress?.isComplete).length;
    const totalItems = enrichedWeekItems.length;
    const startedAt = this.getLearningPathStartAt(learningPath);
    const daysElapsed = !startedAt
      ? 0
      : Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / (24 * 60 * 60 * 1000)));

    const skillStats = enrichedWeekItems.reduce((acc, item) => {
      const skill = item.skill as SkillType;
      const progress = item.progress || {};
      const target = Number(progress.target ?? item.targetCount) || 1;
      const count = Number(progress.count) || 0;
      const current = acc[skill] ?? {
        totalTarget: 0,
        completedCount: 0,
        taskCount: 0,
        completedTasks: 0,
        percent: 0,
      };
      current.totalTarget += target;
      current.completedCount += Math.min(count, target);
      current.taskCount += 1;
      current.completedTasks += progress.isComplete ? 1 : 0;
      current.percent = current.totalTarget
        ? Math.round((current.completedCount / current.totalTarget) * 100)
        : 0;
      acc[skill] = current;
      return acc;
    }, {} as Record<string, any>);

    return {
      level: learningPath.level,
      goal: learningPath.goal,
      currentWeek: learningPath.currentWeek || 1,
      daysElapsed,
      streakDays: learningPath.streakDays || 0,
      generationSource: learningPath.generationSource || 'fallback',
      completionRate: totalItems ? Math.round((completedItems / totalItems) * 100) : 0,
      completedItems,
      totalItems,
      skillStats,
      examStats: await this.getRecentExamReviewStats(userId, learningPath),
    };
  }

  private async getRecentExamReviewStats(
    userId: string,
    learningPath: LearningPathDocument,
  ) {
    const goalTypes = learningPath.goal?.types?.length
      ? learningPath.goal.types
      : [learningPath.goal?.type].filter(Boolean);
    if (!goalTypes.includes('jlpt_exam')) return null;

    const examIds = await this.examModel
      .find({ level: learningPath.level }, { _id: 1 })
      .lean()
      .exec();
    const examObjectIds = examIds.map((exam: any) => exam._id);
    if (!examObjectIds.length) {
      return { attemptCount: 0, latestScore: null, bestScore: null, averageScore: null };
    }

    const results = await this.examResultModel
      .find({
        userId: new Types.ObjectId(userId),
        examId: { $in: examObjectIds },
        status: ExamResultStatus.COMPLETED,
      })
      .sort({ end_time: -1, createdAt: -1 })
      .limit(10)
      .lean()
      .exec();

    if (!results.length) {
      return { attemptCount: 0, latestScore: null, bestScore: null, averageScore: null };
    }

    const scores = results.map((result: any) => Number(result.total_score) || 0);
    return {
      attemptCount: results.length,
      latestScore: scores[0],
      bestScore: Math.max(...scores),
      averageScore: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
    };
  }

  private async generateReviewWithAi(stats: any): Promise<{
    assessment: string;
    onTrack: boolean;
    suggestions: { type: ReviewSuggestionType; skill?: SkillType; reason: string }[];
    adjustedWeeklyItems: WeeklyItem[];
  }> {
    const prompt = `
Bạn là cố vấn học tiếng Nhật. Hãy đánh giá lộ trình học hiện tại dựa trên thống kê sau:
${JSON.stringify(stats)}

Yêu cầu:
- Viết assessment bằng tiếng Việt, ngắn gọn, thực tế.
- onTrack là boolean cho biết người học có đang đúng tiến độ không.
- Đề xuất tối đa 3 suggestions.
- Chỉ dùng suggestion type: speed_up, slow_down, focus_skill, add_review.
- skill chỉ dùng khi type = focus_skill hoặc add_review và phải nằm trong các skill hiện có.
- adjustedWeeklyItems là danh sách task đề xuất cho tuần tiếp theo, chỉ dùng skill trong goal.focusSkills.
- Mỗi adjustedWeeklyItems item dùng dạng task tổng quát: skill, title, targetCount, estimatedMinutes.
- Không tạo refId/refModel.
- Phải có assessment không rỗng, ít nhất 1 suggestion hợp lệ và ít nhất 1 adjustedWeeklyItems hợp lệ.
- Chỉ trả JSON hợp lệ, không markdown.

Schema:
{
  "assessment": "...",
  "onTrack": true,
  "suggestions": [
    { "type": "focus_skill", "skill": "grammar", "reason": "..." }
  ],
  "adjustedWeeklyItems": [
    { "skill": "grammar", "title": "Ôn 10 mẫu ngữ pháp trọng tâm", "targetCount": 10, "estimatedMinutes": 30 }
  ]
}`;

    try {
      const raw = await this.aiClient.generate(prompt);
      const parsed = this.parseJson(raw);
      const assessment = String(parsed?.assessment || '').trim();
      const onTrack = parsed?.onTrack;
      const suggestions = Array.isArray(parsed?.suggestions)
        ? parsed.suggestions
            .map((suggestion: any) => this.normalizeReviewSuggestion(suggestion))
            .filter(Boolean)
            .slice(0, 3)
        : [];
      const adjustedWeeklyItems = this.normalizeAdjustedWeeklyItems(
        parsed?.adjustedWeeklyItems,
        stats,
      );

      if (!assessment || typeof onTrack !== 'boolean' || !suggestions.length || !adjustedWeeklyItems.length) {
        throw new Error('AI review response is incomplete');
      }

      return { assessment, onTrack, suggestions, adjustedWeeklyItems };
    } catch (error) {
      this.logger.error(`AI learning path review failed: ${error?.message ?? error}`);
      throw new InternalServerErrorException('Hệ thống AI đánh giá lộ trình đang gặp lỗi. Vui lòng thử lại sau.');
    }
  }

  private normalizeReviewSuggestion(suggestion: any) {
    const allowedTypes: ReviewSuggestionType[] = ['speed_up', 'slow_down', 'focus_skill', 'add_review'];
    const allowedSkills = new Set<SkillType>([
      'vocab',
      'grammar',
      'kanji',
      'reading',
      'writing',
      'conversation',
      'jlpt_exam',
    ]);
    const type = suggestion?.type as ReviewSuggestionType;
    if (!allowedTypes.includes(type)) return null;

    const reason = String(suggestion?.reason || '').trim();
    if (!reason) return null;

    const skill = suggestion?.skill as SkillType | undefined;
    return {
      type,
      ...(skill && allowedSkills.has(skill) ? { skill } : {}),
      reason,
    };
  }

  private normalizeAdjustedWeeklyItems(items: any, context: any): WeeklyItem[] {
    if (!Array.isArray(items)) return [];

    const focusSkills = context?.goal?.focusSkills?.length
      ? context.goal.focusSkills
      : ['vocab', 'grammar', 'kanji'];
    const allowedSkills = new Set<SkillType>(focusSkills);
    const dailyMinutes = Number(context?.goal?.dailyMinutes) || 30;
    const weeklyMinuteLimit = dailyMinutes * 7;
    const level = context?.level || '';

    const normalizedItems = items
      .map((item: any): WeeklyItem | null => {
        const skill = item?.skill as SkillType;
        if (!allowedSkills.has(skill)) return null;

        const rawTargetCount = Number(item?.targetCount);
        const targetCount = Number.isFinite(rawTargetCount)
          ? Math.min(Math.max(Math.round(rawTargetCount), 1), 100)
          : 1;
        const rawEstimatedMinutes = Number(item?.estimatedMinutes);
        const estimatedMinutes = Number.isFinite(rawEstimatedMinutes) && rawEstimatedMinutes > 0
          ? Math.min(Math.round(rawEstimatedMinutes), weeklyMinuteLimit)
          : this.getGenericEstimatedMinutes(skill, targetCount);
        const title = String(item?.title || '').trim() || this.getGenericTaskTitle(skill, level, targetCount);

        return {
          skill,
          title,
          targetCount,
          order: 0,
          estimatedMinutes,
        };
      })
      .filter((item): item is WeeklyItem => Boolean(item))
      .slice(0, 7)
      .map((item, index) => ({
        ...item,
        order: index + 1,
      }));

    return normalizedItems;
  }

  private async generateGenericPlansWithAi(input: {
    level: string;
    goalTypes: GoalType[];
    dailyMinutes: number;
    targetScore?: number;
    focusSkills: SkillType[];
    totalWeeks: number;
    fallbackPlans: WeeklyPlan[];
  }): Promise<WeeklyPlan[]> {
    const prompt = `
Tao lo trinh hoc tieng Nhat ca nhan hoa dang JSON.

Thong tin nguoi hoc:
- Trinh do: ${input.level}
- Muc tieu: ${input.goalTypes.join(', ')}
- Ky nang uu tien: ${input.focusSkills.join(', ')}
- Thoi gian hoc: ${input.dailyMinutes} phut/ngay
${input.goalTypes.includes('jlpt_exam') && input.targetScore !== undefined ? `- Diem JLPT mong muon: ${input.targetScore}/180` : ''}
- So tuan: ${input.totalWeeks}

Plan nen hien tai de tham khao:
${JSON.stringify(input.fallbackPlans)}

Yeu cau:
- Chi dung cac skill trong danh sach ky nang uu tien.
- Moi tuan nen co cac task tong quat theo skill, khong tao refId/refModel.
- title viet tieng Viet ngan gon, tu nhien, co nhac level ${input.level} neu phu hop.
- targetCount la so nguyen duong hop ly voi thoi gian hoc.
- estimatedMinutes phai hop ly voi targetCount.
- Tra ve dung JSON hop le, khong markdown, khong giai thich.

Schema bat buoc:
{
  "weeklyPlans": [
    {
      "week": 1,
      "items": [
        { "skill": "vocab", "title": "Hoc 10 tu vung N5 theo chu de", "targetCount": 10, "order": 1, "estimatedMinutes": 20 }
      ]
    }
  ]
}`;

    try {
      const raw = await this.aiClient.generate(prompt);
      const parsed = this.parseJson(raw);
      return this.normalizeGenericWeeklyPlans(
        parsed?.weeklyPlans,
        input.fallbackPlans,
        input.focusSkills,
        input.dailyMinutes,
      );
    } catch (error) {
      this.logger.warn(`AI generic learning path generation failed: ${error?.message ?? error}`);
      return [];
    }
  }

  private normalizeGenericWeeklyPlans(
    plans: any,
    fallbackPlans: WeeklyPlan[],
    focusSkills: SkillType[],
    dailyMinutes: number,
  ): WeeklyPlan[] {
    if (!Array.isArray(plans)) return [];

    const allowedSkills = new Set(focusSkills);
    const fallbackCounts = this.getGenericTaskCounts(dailyMinutes);
    const normalizedPlans = fallbackPlans.map((fallbackPlan, weekIndex) => {
      const aiPlan = plans.find((plan: any) => Number(plan?.week) === fallbackPlan.week) ?? plans[weekIndex];
      const aiItems = Array.isArray(aiPlan?.items) ? aiPlan.items : [];
      const normalizedItems = aiItems
        .map((item: any) => {
          const skill = item?.skill as SkillType;
          if (!allowedSkills.has(skill)) return null;

          const fallbackCount = fallbackCounts[skill] ?? 1;
          const rawTargetCount = Number(item?.targetCount);
          const targetCount = Number.isFinite(rawTargetCount)
            ? Math.min(Math.max(Math.round(rawTargetCount), 1), fallbackCount * 2)
            : fallbackCount;
          const rawEstimatedMinutes = Number(item?.estimatedMinutes);
          const estimatedMinutes = Number.isFinite(rawEstimatedMinutes) && rawEstimatedMinutes > 0
            ? Math.min(Math.round(rawEstimatedMinutes), dailyMinutes * 7)
            : this.getGenericEstimatedMinutes(skill, targetCount);
          const title = String(item?.title || '').trim() || this.getGenericTaskTitle(skill, '', targetCount);

          return {
            skill,
            title,
            targetCount,
            order: 0,
            estimatedMinutes,
          };
        })
        .filter(Boolean) as WeeklyItem[];

      const uniqueItems = normalizedItems.filter(
        (item, index, items) => items.findIndex((candidate) => candidate.skill === item.skill) === index,
      );
      const items = uniqueItems.length ? uniqueItems : fallbackPlan.items;

      return {
        week: fallbackPlan.week,
        items: items.map((item, index) => ({
          ...item,
          order: index + 1,
        })),
      };
    });

    return normalizedPlans.some((plan) => plan.items.length > 0) ? normalizedPlans : [];
  }
  private buildGenericPlans(
    level: string,
    goalType: GoalType,
    goalTypes: GoalType[],
    focusSkills: SkillType[],
    totalWeeks: number,
    dailyMinutes: number,
  ): WeeklyPlan[] {
    const counts = this.getGenericTaskCounts(dailyMinutes);
    const skillOrder = focusSkills.filter((skill) =>
      [
        'vocab',
        'kanji',
        'grammar',
        'reading',
        'writing',
        'conversation',
        'jlpt_exam',
      ].includes(skill),
    );

    if (!skillOrder.length) {
      skillOrder.push(...this.getDefaultSkillsForGoalTypes(goalTypes?.length ? goalTypes : [goalType]));
    }

    return Array.from({ length: totalWeeks }, (_, weekIndex) => {
      const items = skillOrder.map((skill, index) => {
        const targetCount = counts[skill] ?? 1;
        return {
          skill,
          title: this.getGenericTaskTitle(skill, level, targetCount),
          targetCount,
          order: index + 1,
          estimatedMinutes: this.getGenericEstimatedMinutes(skill, targetCount),
        };
      });

      return {
        week: weekIndex + 1,
        items,
      };
    });
  }

  private normalizeGoalTypes(types: GoalType[] | undefined, fallback: GoalType): GoalType[] {
    const validTypes = new Set(Object.keys(GOAL_SKILL_DEFAULTS) as GoalType[]);
    const normalized = [...(types || []), fallback].filter((type): type is GoalType =>
      validTypes.has(type as GoalType),
    );
    const unique = [...new Set(normalized)];
    return unique.length ? unique : [fallback];
  }

  private getDefaultSkillsForGoalTypes(goalTypes: GoalType[]): SkillType[] {
    return [
      ...new Set(
        goalTypes.flatMap((type) => GOAL_SKILL_DEFAULTS[type] || []),
      ),
    ];
  }

  private getGenericTaskCounts(dailyMinutes: number): Partial<Record<SkillType, number>> {
    if (dailyMinutes <= 15) {
      return {
        vocab: 5,
        kanji: 5,
        grammar: 5,
        reading: 1,
        writing: 1,
        conversation: 1,
        jlpt_exam: 1,
      };
    }
    if (dailyMinutes <= 30) {
      return {
        vocab: 10,
        kanji: 10,
        grammar: 10,
        reading: 2,
        writing: 1,
        conversation: 1,
        jlpt_exam: 1,
      };
    }
    if (dailyMinutes <= 45) {
      return {
        vocab: 15,
        kanji: 12,
        grammar: 12,
        reading: 3,
        writing: 2,
        conversation: 1,
        jlpt_exam: 1,
      };
    }
    return {
      vocab: 20,
      kanji: 15,
      grammar: 15,
      reading: 4,
      writing: 2,
      conversation: 2,
      jlpt_exam: 1,
    };
  }

  private getGenericTaskTitle(skill: SkillType, level: string, count: number) {
    const labels: Partial<Record<SkillType, string>> = {
      vocab: `Học ${count} từ vựng ${level}`,
      kanji: `Học ${count} kanji ${level}`,
      grammar: `Học ${count} mẫu ngữ pháp ${level}`,
      reading: `Đọc ${count} bài luyện đọc`,
      writing: `Tải ${count} PDF luyện viết kanji ${level}`,
      conversation: `Luyện ${count} bài hội thoại ${level}`,
      jlpt_exam: `Luyện ${count} đề thi ${level}`,
    };
    return labels[skill] ?? `Học ${count} mục ${skill}`;
  }

  private getGenericEstimatedMinutes(skill: SkillType, count: number) {
    if (skill === 'jlpt_exam') return 45 * count;
    if (skill === 'conversation') return 20 * count;
    if (skill === 'reading') return 10 * count;
    if (skill === 'writing') return 15 * count;
    if (skill === 'grammar') return 3 * count;
    return 2 * count;
  }

  private async getAvailableItems(level: string, skills: SkillType[]) {
    const groups = await Promise.all(
      skills.map(async (skill) => {
        switch (skill) {
          case 'vocab':
            return this.jlptWordModel
              .find({ level, isDeleted: false })
              .limit(80)
              .lean()
              .then((docs) =>
                docs.map((doc: any) => ({
                  id: doc._id.toString(),
                  skill,
                  refModel: 'JlptWord',
                  title: doc.word,
                  estimatedMinutes: 10,
                })),
              );
          case 'kanji':
            return this.jlptKanjiModel
              .find({ level, isDeleted: false })
              .limit(60)
              .lean()
              .then((docs) =>
                docs.map((doc: any) => ({
                  id: doc._id.toString(),
                  skill,
                  refModel: 'JlptKanji',
                  title: doc.kanji,
                  estimatedMinutes: 12,
                })),
              );
          case 'grammar':
            return this.jlptGrammarModel
              .find({ level, isDeleted: false })
              .limit(60)
              .lean()
              .then((docs) =>
                docs.map((doc: any) => ({
                  id: doc._id.toString(),
                  skill,
                  refModel: 'JlptGrammar',
                  title: doc.title,
                  estimatedMinutes: 15,
                })),
              );
          case 'jlpt_exam':
            return this.examModel
              .find({ level, status: ExamStatus.PUBLIC })
              .limit(20)
              .lean()
              .then((docs) =>
                docs.map((doc: any) => ({
                  id: doc._id.toString(),
                  skill,
                  refModel: 'Exam',
                  title: doc.title,
                  estimatedMinutes: 45,
                })),
              );
          case 'conversation':
            return this.conversationLessonModel
              .find({ level, published: true })
              .limit(30)
              .lean()
              .then((docs) =>
                docs.map((doc: any) => ({
                  id: doc._id.toString(),
                  skill,
                  refModel: 'ConversationLesson',
                  title: doc.title,
                  estimatedMinutes: 20,
                })),
              );
          default:
            return [];
        }
      }),
    );

    return groups.flat();
  }

  private async generatePlansWithAi(input: {
    level: string;
    goalType: GoalType;
    dailyMinutes: number;
    focusSkills: SkillType[];
    totalWeeks: number;
    availableItems: AvailableItem[];
  }): Promise<WeeklyPlan[]> {
    const promptItems = input.availableItems.slice(0, 160);
    const prompt = `
Tao lo trinh hoc tieng Nhat ${input.totalWeeks} tuan dang JSON.
- Trinh do: ${input.level}
- Muc tieu: ${input.goalType}
- Skills uu tien: ${input.focusSkills.join(', ')}
- Thoi gian hoc: ${input.dailyMinutes} phut/ngay
- Noi dung co san: ${JSON.stringify(promptItems)}

Yeu cau:
- Sap xep items hop ly: vocab/kanji/grammar truoc, conversation/exam sau
- Tong estimatedMinutes moi tuan xap xi ${input.dailyMinutes * 7} phut
- Phan bo deu cac skill theo focusSkills
- Chi tra ve JSON hop le:
{
  "weeklyPlans": [
    {
      "week": 1,
      "items": [
        { "skill": "vocab", "refId": "...", "refModel": "JlptWord", "title": "...", "order": 1, "estimatedMinutes": 10 }
      ]
    }
  ]
}`;

    try {
      const raw = await this.aiClient.generate(prompt);
      const parsed = this.parseJson(raw);
      const plans = this.normalizeWeeklyPlans(parsed?.weeklyPlans, input.availableItems);
      if (plans.length) return plans;
    } catch (error) {
      this.logger.warn(`AI learning path generation failed: ${error?.message ?? error}`);
    }

    return [];
  }

  private normalizeWeeklyPlans(plans: any, availableItems: AvailableItem[]): WeeklyPlan[] {
    if (!Array.isArray(plans)) return [];

    const availableById = new Map(availableItems.map((item) => [item.id, item]));

    return plans
      .map((plan, index) => {
        const items = Array.isArray(plan.items) ? plan.items : [];
        const normalizedItems = items
          .map((item, itemIndex) => {
            const refId = String(item.refId ?? item.id ?? '');
            const available = availableById.get(refId);
            if (!available || !Types.ObjectId.isValid(refId)) return null;

            return {
              skill: available.skill,
              refId: new Types.ObjectId(refId),
              refModel: available.refModel,
              title: item.title || available.title,
              order: Number(item.order) || itemIndex + 1,
              estimatedMinutes:
                Number(item.estimatedMinutes) || available.estimatedMinutes || 15,
            };
          })
          .filter(Boolean) as WeeklyItem[];

        return {
          week: Number(plan.week) || index + 1,
          items: normalizedItems,
        };
      })
      .filter((plan) => plan.items.length > 0);
  }

  private buildFallbackPlans(
    availableItems: AvailableItem[],
    totalWeeks: number,
    dailyMinutes: number,
  ): WeeklyPlan[] {
    const itemsBySkill = new Map<SkillType, AvailableItem[]>();
    for (const item of availableItems) {
      const group = itemsBySkill.get(item.skill) ?? [];
      group.push(item);
      itemsBySkill.set(item.skill, group);
    }

    const skillQueues = [...itemsBySkill.entries()].map(([skill, items]) => ({
      skill,
      items: [...items],
      index: 0,
    }));

    return Array.from({ length: totalWeeks }, (_, weekIndex) => {
      const weeklyItems: WeeklyItem[] = [];
      let minutes = 0;
      let order = 1;
      const weeklyTarget = dailyMinutes * 7;

      while (minutes < weeklyTarget && weeklyItems.length < availableItems.length) {
        let added = false;
        for (const queue of skillQueues) {
          const item = queue.items[queue.index % queue.items.length];
          queue.index += 1;
          if (
            weeklyItems.some(
              (weeklyItem) =>
                weeklyItem.refId?.toString() === item.id && weeklyItem.skill === item.skill,
            )
          ) {
            continue;
          }
          weeklyItems.push({
            skill: item.skill,
            refId: new Types.ObjectId(item.id),
            refModel: item.refModel,
            title: item.title,
            order,
            estimatedMinutes: item.estimatedMinutes,
          });
          minutes += item.estimatedMinutes;
          order += 1;
          added = true;
          if (minutes >= weeklyTarget) break;
        }
        if (!added) break;
      }

      return {
        week: weekIndex + 1,
        items: weeklyItems,
      };
    });
  }

  private parseJson(raw: string) {
    const text = String(raw ?? '').trim();
    try {
      return JSON.parse(text);
    } catch {
      const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
      if (fenced) return JSON.parse(fenced);
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return JSON.parse(text.slice(start, end + 1));
      }
      throw new Error('AI response is not valid JSON');
    }
  }

  private shuffle<T>(items: T[]) {
    return [...items].sort(() => Math.random() - 0.5);
  }
}




