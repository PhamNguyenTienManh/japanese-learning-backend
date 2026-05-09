import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// ---------------------------
// Subdocument: Action gắn kèm message AI
// (vd: nút "Xem sổ tay đã tạo" sau khi AI gọi tool tạo notebook)
// ---------------------------
export interface ChatMessageAction {
  type: 'view_notebook';
  label: string;
  notebookId?: string;
  notebookName?: string;
}

// ---------------------------
// Subdocument: Message
// ---------------------------
@Schema({ _id: false })
export class ChatMessage {
  @Prop({ type: String, enum: ['user', 'ai'], required: true })
  role: 'user' | 'ai'; // ai là người gửi

  @Prop({ type: String, required: true })
  content: string; // nội dung tin nhắn

  @Prop({ type: Date, default: Date.now })
  timestamp: Date; // thời gian gửi

  @Prop({ type: [Object], default: [] })
  actions?: ChatMessageAction[]; // các action gắn kèm (nút bấm)
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

// ---------------------------
// Main Schema: AIChatSession
// ---------------------------
@Schema({ timestamps: true, collection: 'ai_chat_sessions' })
export class AIChatSession extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  userId?: Types.ObjectId | null; // có thể là guest (null)

  @Prop({ type: [ChatMessageSchema], default: [] })
  messages: ChatMessage[]; // danh sách tin nhắn

  @Prop({ type: String, default: 'japanese-learning' })
  topic?: string; // Chủ đề: grammar, vocabulary, conversation, etc.

  @Prop({ type: String, enum: ['N5', 'N4', 'N3', 'N2', 'N1', 'beginner'], default: 'beginner' })
  level?: string; // Trình độ học viên

  @Prop({ type: Boolean, default: true })
  isActive?: boolean; // Session còn active không
}

export const AIChatSessionSchema = SchemaFactory.createForClass(AIChatSession);

AIChatSessionSchema.index({ userId: 1, createdAt: -1 });
AIChatSessionSchema.index({ isActive: 1, updatedAt: -1 });
