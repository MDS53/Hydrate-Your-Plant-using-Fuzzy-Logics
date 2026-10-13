import mongoose, { Schema, Document, Types } from 'mongoose';
import { IWeatherSnapshot } from './Schedule.js';

export interface IWaterLog extends Document {
  plantId: Types.ObjectId;
  userId: Types.ObjectId;
  scheduleId?: Types.ObjectId;
  personName: string;
  status: 'poured' | 'missed' | 'skipped';
  amountMl: number;
  baseAmountMl: number;
  suggestedAmountMl: number;
  pouredAt: Date;
  notes?: string;
  weatherSnapshot?: IWeatherSnapshot;
  fuzzyFactor?: number;
  createdAt: Date;
  updatedAt: Date;
}

const waterLogSchema = new Schema<IWaterLog>(
  {
    plantId: { type: Schema.Types.ObjectId, ref: 'Plant', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    scheduleId: { type: Schema.Types.ObjectId, ref: 'Schedule' },
    personName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['poured', 'missed', 'skipped'],
      required: true,
      default: 'poured',
    },
    amountMl: { type: Number, required: true },
    baseAmountMl: { type: Number, required: true },
    suggestedAmountMl: { type: Number, required: true },
    pouredAt: { type: Date, required: true, default: Date.now, index: true },
    notes: { type: String, trim: true },
    weatherSnapshot: { type: Schema.Types.Mixed },
    fuzzyFactor: { type: Number },
  },
  { timestamps: true }
);

waterLogSchema.index({ plantId: 1, pouredAt: -1 });
waterLogSchema.index({ userId: 1, pouredAt: -1 });

export const WaterLog = mongoose.model<IWaterLog>('WaterLog', waterLogSchema);
