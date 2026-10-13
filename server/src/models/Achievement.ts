import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAchievement extends Document {
  plantId?: Types.ObjectId;
  userId?: Types.ObjectId;
  personName: string;
  badge: 'Early Bird' | 'Never Missed' | 'Last-Minute Hero' | 'Plant Whisperer' | 'Weather Warrior' | 'MVP of the Month' | 'Plant Parent of the Week';
  description: string;
  icon: string;
  awardedAt: Date;
  metadata?: Record<string, any>;
}

const achievementSchema = new Schema<IAchievement>(
  {
    plantId: { type: Schema.Types.ObjectId, ref: 'Plant', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    personName: { type: String, required: true, trim: true },
    badge: {
      type: String,
      enum: [
        'Early Bird',
        'Never Missed',
        'Last-Minute Hero',
        'Plant Whisperer',
        'Weather Warrior',
        'MVP of the Month',
        'Plant Parent of the Week',
      ],
      required: true,
    },
    description: { type: String, required: true },
    icon: { type: String, required: true, default: '🏆' },
    awardedAt: { type: Date, default: Date.now, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

achievementSchema.index({ personName: 1, badge: 1 });

export const Achievement = mongoose.model<IAchievement>('Achievement', achievementSchema);
