export interface User {
  id: string;
  name: string;
  email: string;
  timezone: string;
  reminderTime: string;
}

export interface CareInfo {
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

export interface Pot {
  volumeL: number;
  diameterCm?: number;
  heightCm?: number;
  material: 'plastic' | 'terracotta' | 'ceramic';
  drainage: boolean;
}

export interface Location {
  city: string;
  lat: number;
  lon: number;
  country?: string;
}

export interface HealthScore {
  score: number;
  label: 'Thriving' | 'OK' | 'Thirsty' | 'Critical';
  emoji: string;
  color: string;
  breakdown: {
    consistencyPoints: number;
    punctualityPoints: number;
    adherencePoints: number;
  };
}

export interface WeatherBadgeInfo {
  temp: string;
  humidity: string;
  rain: string;
  emoji: string;
}

export interface TodaySuggestion {
  suggestedMl: number;
  baseMl: number;
  reason: string;
  fuzzyFactor: number;
  badge: WeatherBadgeInfo;
  shouldSkipOrMinimal: boolean;
  verbalSuggestion?: string;
  crispBracketText?: string;
  crispDeltaMl?: number;
  weatherSnapshot?: {
    temp: number;
    humidity: number;
    rainMm: number;
    conditionDescription?: string;
    description?: string;
  };
}

export interface PlantSummary {
  id: string;
  name: string;
  species?: string;
  emoji: string;
  photoUrl?: string;
  pot: Pot;
  location: Location;
  environment: 'indoor' | 'balcony' | 'outdoor';
  baseWaterMl: number;
  nextWateringDate: string | null;
  todaySuggestion: TodaySuggestion;
  health: HealthScore;
  pourDaysOfWeek: number[];
  wateringTime?: string;
  isWateredToday?: boolean;
  canWaterNow?: boolean;
  lastWateredAt?: string;
}

export interface PlantDetail {
  _id: string;
  name: string;
  emoji: string;
  photoUrl?: string;
  location: Location;
  environment: 'indoor' | 'balcony' | 'outdoor';
  pot: Pot;
  careInfo: CareInfo;
  baseWaterMl: number;
  pourDaysOfWeek: number[];
  wateringTime?: string;
  createdAt: string;
}

export interface Caretaker {
  _id: string;
  plantId: string;
  name: string;
  email: string;
}

export interface FuzzyTrace {
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

export interface ScheduleItem {
  _id: string;
  plantId: string;
  date: string;
  assignedTo: {
    role: 'owner' | 'caretaker';
    name: string;
    email: string;
  };
  baseMl: number;
  suggestedMl: number;
  fuzzyFactor: number;
  fuzzyTrace?: FuzzyTrace;
  weatherSnapshot?: {
    temp: number;
    tempMax?: number;
    tempMin?: number;
    humidity: number;
    rainMm: number;
    conditionDescription?: string;
  };
  status: 'pending' | 'completed' | 'missed' | 'snoozed' | 'skipped';
  magicToken?: string;
  completedAt?: string;
  completedBy?: string;
  actualMl?: number;
}

export interface WaterLogItem {
  _id: string;
  personName: string;
  status: 'poured' | 'missed' | 'skipped';
  amountMl: number;
  baseAmountMl: number;
  suggestedAmountMl: number;
  pouredAt: string;
  notes?: string;
  fuzzyFactor?: number;
  weatherSnapshot?: {
    temp: number;
    humidity: number;
    rainMm: number;
    conditionDescription?: string;
  };
}

export interface AchievementItem {
  _id: string;
  personName: string;
  badge: string;
  description: string;
  icon: string;
  awardedAt: string;
}
