import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { Profile } from "src/modules/profiles/schemas/profiles.schema";

export type ContributionDocument = HydratedDocument<Contribution>;

@Schema({ timestamps: true })
export class Contribution {
  @Prop({ type: Types.ObjectId, ref: Profile.name, required: true })
  profileId: Types.ObjectId;

  @Prop({required: true })
  kanjiId: string;

  @Prop({ required: true })
  content: string;
}

export const ContributionSchema = SchemaFactory.createForClass(Contribution);
