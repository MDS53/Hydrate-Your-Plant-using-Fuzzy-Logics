import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IWeatherSnapshot {
  temp: number;
  tempMax?: number;
  tempMin?: number;
  humidity: number;
  rainMm: number;
  rainProb?: number;
  windSpeed?: number;
  uvIndex?: number;
  conditionDescription?: string;
  source?: string;
  fetchedAt: Date;
}

export interface IFuzzyTrace {
  reason: string;
  factor: number;
  rulesFired: string[];
  memberships: {
    temperature: Record<string, number>;
    humidity: Record<string, number>;
    rain: Record<string, number>;
  };
  crispInputs: {
    temp: number;
    humidity: number;
    rainMm: number;
    environment: string;
    droughtTolerance: string;
    potMaterial: string;
  };
}

export interface IAssignedTo {
  role: 'owner' | 'caretaker';
  name: string;
  email: string;
  caretakerId?: Types.ObjectId;
}

export interface ISchedule extends Document {
  plantId: Types.ObjectId;
  userId: Types.ObjectId;
  date: Date; // date of watering
  assignedTo: IAssignedTo;
  baseMl: number;
  suggestedMl: number;
  fuzzyFactor: number;
  fuzzyTrace?: IFuzzyTrace;
  weatherSnapshot?: IWeatherSnapshot;
  status: 'pending' | 'completed' | 'missed' | 'snoozed' | 'skipped';
  lastReminderSentAt?: Date;
  magicToken?: string; // One-time or secure token for friend confirmation
  createdAt: Date;
  updatedAt: Date;
}

const scheduleSchema = new Schema<ISchedule>(
  {
    plantId: { type: Schema.Types.ObjectId, ref: 'Plant', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, index: true },
    assignedTo: {
      role: { type: String, enum: ['owner', 'caretaker'], required: true },
      name: { type: String, required: true },
      email: { type: String, required: true },
      caretakerId: { type: Schema.Types.ObjectId, ref: 'Caretaker' },
    },
    baseMl: { type: Number, required: true },
    suggestedMl: { type: Number, required: true },
    fuzzyFactor: { type: Number, required: true, default: 1.0 },
    fuzzyTrace: { type: Schema.Types.Mixed },
    weatherSnapshot: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['pending', 'completed', 'missed', 'snoozed', 'skipped'],
      default: 'pending',
      index: true,
    },
    lastReminderSentAt: { type: Date },
    magicToken: { type: String, index: true },
  },
  { timestamps: true }
);

scheduleSchema.index({ plantId: 1, date: 1 });
scheduleSchema.index({ userId: 1, status: 1 });

export const Schedule = mongoose.model<ISchedule>('Schedule', scheduleSchema);
