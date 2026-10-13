import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICaretaker extends Document {
  plantId: Types.ObjectId;
  name: string;
  email: string;
  magicTokenHash?: string;
  tokenExpiresAt?: Date;
  invitedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const caretakerSchema = new Schema<ICaretaker>(
  {
    plantId: { type: Schema.Types.ObjectId, ref: 'Plant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    magicTokenHash: { type: String },
    tokenExpiresAt: { type: Date },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

caretakerSchema.index({ plantId: 1, email: 1 });
caretakerSchema.index({ tokenExpiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB TTL index

export const Caretaker = mongoose.model<ICaretaker>('Caretaker', caretakerSchema);
