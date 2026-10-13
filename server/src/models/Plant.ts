import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICareInfo {
  shortDescription: string;
  idealTempMin: number;
  idealTempMax: number;
  criticalMinTemp: number;
  criticalMaxTemp: number;
  light: string;
  humidity: string;
  soilType: string;
  wateringNeeds: string;
  waterMlPerPotLitre: number;
  waterTypicalRange?: string;
  recommendedFrequencyPerWeek: number;
  droughtTolerance: 'low' | 'medium' | 'high';
  overwateringSensitivity: 'low' | 'medium' | 'high';
  commonProblems: string[];
  tips: string[];
}

export interface IPot {
  volumeL: number;
  diameterCm?: number;
  heightCm?: number;
  material: 'plastic' | 'terracotta' | 'ceramic';
  drainage: boolean;
}

export interface ILocation {
  city: string;
  lat: number;
  lon: number;
  country?: string;
}

export interface IPlant extends Document {
  userId: Types.ObjectId;
  name: string;
  emoji: string;
  photoUrl?: string;
  location: ILocation;
  environment: 'indoor' | 'balcony' | 'outdoor';
  pot: IPot;
  careInfo: ICareInfo;
  baseWaterMl: number;
  pourDaysOfWeek: number[]; // 0-6 (Sun-Sat)
  wateringTime: string; // e.g. "08:00"
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const careInfoSchema = new Schema<ICareInfo>(
  {
    shortDescription: { type: String, required: true },
    idealTempMin: { type: Number, default: 18 },
    idealTempMax: { type: Number, default: 28 },
    criticalMinTemp: { type: Number, default: 5 },
    criticalMaxTemp: { type: Number, default: 38 },
    light: { type: String, default: 'Bright indirect light' },
    humidity: { type: String, default: 'Moderate (40-60%)' },
    soilType: { type: String, default: 'Well-draining potting mix' },
    wateringNeeds: { type: String, default: 'Water when top 2-3 cm of soil is dry' },
    waterMlPerPotLitre: { type: Number, required: true, default: 80 },
    waterTypicalRange: { type: String, default: '60-100 ml/L' },
    recommendedFrequencyPerWeek: { type: Number, required: true, default: 1 },
    droughtTolerance: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    overwateringSensitivity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    commonProblems: { type: [String], default: [] },
    tips: { type: [String], default: [] },
  },
  { _id: false }
);

const potSchema = new Schema<IPot>(
  {
    volumeL: { type: Number, required: true, min: 0.1 },
    diameterCm: { type: Number, min: 1 },
    heightCm: { type: Number, min: 1 },
    material: { type: String, enum: ['plastic', 'terracotta', 'ceramic'], default: 'plastic' },
    drainage: { type: Boolean, default: true },
  },
  { _id: false }
);

const locationSchema = new Schema<ILocation>(
  {
    city: { type: String, required: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    country: { type: String, default: '' },
  },
  { _id: false }
);

const plantSchema = new Schema<IPlant>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    emoji: { type: String, default: '🌿' },
    photoUrl: { type: String },
    location: { type: locationSchema, required: true },
    environment: {
      type: String,
      enum: ['indoor', 'balcony', 'outdoor'],
      default: 'indoor',
    },
    pot: { type: potSchema, required: true },
    careInfo: { type: careInfoSchema, required: true },
    baseWaterMl: { type: Number, required: true, min: 10 },
    pourDaysOfWeek: {
      type: [Number],
      required: true,
      validate: {
        validator: (arr: number[]) => arr.length > 0 && arr.every((d) => d >= 0 && d <= 6),
        message: 'Must pick at least one valid day of week (0 to 6)',
      },
    },
    wateringTime: {
      type: String,
      default: '08:00',
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Watering time must be in HH:mm format'],
    },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

plantSchema.index({ userId: 1, archived: 1 });

export const Plant = mongoose.model<IPlant>('Plant', plantSchema);
