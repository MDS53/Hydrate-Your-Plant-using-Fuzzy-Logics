import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISnooze extends Document {
  plantId: Types.ObjectId;
  scheduleId: Types.ObjectId;
  personName: string;
  email: string;
  snoozeUntil: Date;
  snoozeMinutes: number;
  count: number; // number of times snoozed
  status: 'active' | 'fired' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const snoozeSchema = new Schema<ISnooze>(
  {
    plantId: { type: Schema.Types.ObjectId, ref: 'Plant', required: true, index: true },
    scheduleId: { type: Schema.Types.ObjectId, ref: 'Schedule', required: true, index: true },
    personName: { type: String, required: true },
    email: { type: String, required: true },
    snoozeUntil: { type: Date, required: true, index: true },
    snoozeMinutes: { type: Number, required: true },
    count: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['active', 'fired', 'cancelled'],
      default: 'active',
      index: true,
    },
  },
  { timestamps: true }
);

snoozeSchema.index({ snoozeUntil: 1, status: 1 });

export const Snooze = mongoose.model<ISnooze>('Snooze', snoozeSchema);
