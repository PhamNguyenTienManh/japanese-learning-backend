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
} from './schemas/placement-question.schema';

type AvailableItem = {
  id: string;
  skill: SkillType;
  refModel: string;
  estimatedMinutes: number;
  title: string;
};

type ReviewSuggestionType = 'speed_up' | 'slow_down' | 'focus_skill' | 'add_review';

const LEVELS: PlacementLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
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
    private readonly aiClient: GoogleGenAIClient,
  ) {}

  async onModuleInit() {
    const count = await this.placementQuestionModel.estimatedDocumentCount();
    if (count > 0) return;

    await this.placementQuestionModel.insertMany(PLACEMENT_QUESTIONS_DATA);
    this.logger.log(`Seeded ${PLACEMENT_QUESTIONS_DATA.length} placement questions`);
  }

  async getPlacementQuestions(count = 20) {
    const safeCount = Math.min(Math.max(count, 10), 40);
    const perLevel = Math.max(2, Math.floor(safeCount / LEVELS.length));
    const selected: PlacementQuestionDocument[] = [];

    for (const level of LEVELS) {
      const vocab = await this.samplePlacementQuestions(level, 'vocab', Math.ceil(perLevel / 2));
      const grammar = await this.samplePlacementQuestions(level, 'grammar', Math.floor(perLevel / 2));
      selected.push(...vocab, ...grammar);
    }

    if (selected.length < safeCount) {
      const existingIds = selected.map((question) => question._id);
      const extra = await this.placementQuestionModel
        .aggregate([
          { $match: { _id: { $nin: existingIds } } },
          { $sample: { size: safeCount - selected.length } },
        ])
        .exec();
      selected.push(...extra);
    }

    return this.shuffle(selected)
      .slice(0, safeCount)
      .map((question: any) => ({
        id: question._id?.toString(),
        content: question.content,
        options: question.options,
        level: question.level,
        skill: question.skill,
      }));
  }

  async submitPlacement(dto: SubmitPlacementDto) {
    if (!dto.answers?.length) {
      throw new BadRequestException('answers is required');
    }

    const questionIds = dto.answers.map((answer) => answer.questionId);
    const questions = await this.placementQuestionModel
      .find({ _id: { $in: questionIds } })
      .lean()
      .exec();

    if (questions.length === 0) {
      throw new NotFoundException('Placement questions not found');
    }

    const answerByQuestionId = new Map(
      dto.answers.map((answer) => [answer.questionId, answer.selected]),
    );
    const levelStats = this.createStatsMap(LEVELS);
    const skillStats = this.createStatsMap(['vocab', 'grammar']);

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
    const skillBreakdown = {
      vocab: this.toPercent(skillStats.vocab),
      grammar: this.toPercent(skillStats.grammar),
    };

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
      .select('_id level goal.type goal.types currentWeek createdAt')
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
    const todayTasks: any[] = [];
    let assignedMinutes = 0;

    for (const item of enrichedWeekItems
      .filter((item) => !item.progress?.isComplete)
      .sort((a, b) => (a.order || 0) - (b.order || 0))) {
      todayTasks.push(item);
      assignedMinutes += item.estimatedMinutes || 15;
      if (assignedMinutes >= dailyMinutes) break;
    }

    const createdAt = new Date((learningPath as any).createdAt);
    const daysElapsed = Number.isNaN(createdAt.getTime())
      ? 0
      : Math.max(
          0,
          Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000)),
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
      focusSkills,
      totalWeeks,
      fallbackPlans,
    });
    const weeklyPlans = aiPlans.length ? aiPlans : fallbackPlans;
    const generationSource = aiPlans.length ? 'ai' : 'fallback';
    const warnings = aiPlans.length ? [] : ['AI generation failed, used fallback plan'];

    const learningPath = await this.learningPathModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        userId: new Types.ObjectId(userId),
        level: dto.level,
        goal: {
          type: primaryGoalType,
          types: goalTypes,
          examDate: dto.goal.examDate ? new Date(dto.goal.examDate) : undefined,
          dailyMinutes: dto.goal.dailyMinutes,
          focusSkills,
        },
        weeklyPlans,
        currentWeek: 1,
        streakDays: 0,
        generationSource,
        lastActiveAt: undefined,
        lastReview: undefined,
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
        $setOnInsert: {
          userId: userObjectId,
          skill,
          refKey,
          level: body?.level || learningPath.level,
          weekKey,
          metadata: body?.metadata || {},
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const count = await this.learningResourceProgressModel.countDocuments({
      userId: userObjectId,
      skill,
      weekKey,
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

  private samplePlacementQuestions(level: PlacementLevel, skill: 'vocab' | 'grammar', size: number) {
    return this.placementQuestionModel
      .aggregate([
        { $match: { level, skill } },
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
    skillBreakdown: { vocab: number; grammar: number },
    fallback: PlacementLevel,
    maxAllowedLevel: PlacementLevel,
  ): Promise<PlacementLevel> {
    try {
      const prompt = `
User placement JLPT breakdown: ${JSON.stringify(levelBreakdown)}.
Skill vocab: ${skillBreakdown.vocab}%, grammar: ${skillBreakdown.grammar}%.

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

  private toWeekKey(weekStart: Date) {
    return weekStart.toISOString().slice(0, 10);
  }

  private async enrichWeeklyItems(
    userId: string,
    learningPath: LearningPathDocument,
    weekItems: WeeklyItem[],
  ) {
    const userObjectId = new Types.ObjectId(userId);
    const { weekStart, weekEnd } = this.getCurrentWeekWindow(learningPath);
    const weekKey = this.toWeekKey(weekStart);
    const level = learningPath.level;
    const examIds = await this.examModel
      .find({ level }, { _id: 1 })
      .lean()
      .exec();
    const examObjectIds = examIds.map((exam: any) => exam._id);

    const [knownBySkill, passedExamCount, latestPassedExam, resourceCounts] = await Promise.all([
      this.getWeeklyKnownCounts(userObjectId, level, weekStart, weekEnd),
      examObjectIds.length
        ? this.examResultModel.countDocuments({
            userId: userObjectId,
            examId: { $in: examObjectIds },
            status: ExamResultStatus.COMPLETED,
            total_score: { $gte: 80 },
            end_time: { $gte: weekStart, $lt: weekEnd },
          })
        : 0,
      examObjectIds.length
        ? this.examResultModel
            .findOne({
              userId: userObjectId,
              examId: { $in: examObjectIds },
              status: ExamResultStatus.COMPLETED,
              end_time: { $gte: weekStart, $lt: weekEnd },
            })
            .sort({ total_score: -1, end_time: -1, createdAt: -1 })
            .lean()
            .exec()
        : null,
      this.getWeeklyResourceCounts(userObjectId, weekKey),
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
          label:
            item.skill === 'jlpt_exam'
              ? `${progressCount}/${targetCount} đề đạt >=80`
              : item.skill === 'reading'
                ? `${progressCount}/${targetCount} bài đọc`
                : item.skill === 'writing'
                  ? `${progressCount}/${targetCount} PDF`
              : `${progressCount}/${targetCount} mục`,
          requirement,
          latestScore,
        },
      };
    });
  }

  private async getWeeklyKnownCounts(
    userId: Types.ObjectId,
    level: string,
    weekStart: Date,
    weekEnd: Date,
  ) {
    const rows = await this.jlptCardProgressModel
      .aggregate([
        {
          $match: {
            userId,
            level,
            status: 'known',
            updatedAt: { $gte: weekStart, $lt: weekEnd },
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
  ) {
    const rows = await this.learningResourceProgressModel
      .aggregate([
        {
          $match: {
            userId,
            weekKey,
            skill: { $in: ['reading', 'writing'] },
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
    return this.jlptCardProgressModel.countDocuments({
      userId: new Types.ObjectId(userId),
      skill,
      level,
      status: 'known',
      updatedAt: { $gte: weekStart, $lt: weekEnd },
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
    const createdAt = new Date((learningPath as any).createdAt);
    const daysElapsed = Number.isNaN(createdAt.getTime())
      ? 0
      : Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000)));

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




