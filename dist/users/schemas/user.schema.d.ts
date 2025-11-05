import { Document } from 'mongoose';
export declare class User extends Document {
    email: string;
    passwordHash: string;
    role: string;
    status: string;
    premium_date?: Date;
    premium_expired_date?: Date;
    registeredAt: Date;
    lastLogin?: Date;
    provider: string;
    google_id?: string;
}
export declare const UserSchema: import("mongoose").Schema<User, import("mongoose").Model<User, any, any, any, Document<unknown, any, User, any, {}> & User & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, User, Document<unknown, {}, import("mongoose").FlatRecord<User>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<User> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
