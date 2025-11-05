import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

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
}

export const AIChatSessionSchema = SchemaFactory.createForClass(AIChatSession);
