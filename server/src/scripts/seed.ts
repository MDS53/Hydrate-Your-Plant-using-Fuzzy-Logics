import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Plant } from '../models/Plant.js';
import { Caretaker } from '../models/Caretaker.js';
import { Schedule } from '../models/Schedule.js';
import { WaterLog } from '../models/WaterLog.js';
import { Achievement } from '../models/Achievement.js';
import { Snooze } from '../models/Snooze.js';
import { evaluateFuzzyWatering } from '../fuzzy/engine.js';
import crypto from 'crypto';

dotenv.config();

export async function seedDatabase(disconnectOnFinish = true): Promise<void> {
  console.log('🌱 Starting Plant Care Companion database seeding...');
  if (mongoose.connection.readyState === 0) {
    await connectDB();
  }

  // Clean collections
  await Promise.all([
    User.deleteMany({}),
    Plant.deleteMany({}),
    Caretaker.deleteMany({}),
    Schedule.deleteMany({}),
    WaterLog.deleteMany({}),
    Achievement.deleteMany({}),
    Snooze.deleteMany({}),
  ]);

  console.log('🧹 Cleaned existing records.');

  // 1. Create Demo User
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  const user = await User.create({
    name: 'Sophia Botanica',
    email: 'sophia@example.com',
    passwordHash,
    timezone: 'Europe/Berlin',
    reminderTime: '08:00',
  });
  console.log(`👤 Created user: ${user.name} (${user.email}) / password123`);

  // 2. Create Plants
  // Plant 1: Monstera
  const monstera = await Plant.create({
    userId: user._id,
    name: 'Monstera Deliciosa (Monty)',
    emoji: '🪴',
    location: { city: 'Zurich', lat: 47.3769, lon: 8.5417, country: 'Switzerland' },
    environment: 'indoor',
    pot: { volumeL: 5.0, diameterCm: 22, heightCm: 20, material: 'ceramic', drainage: true },
    careInfo: {
      shortDescription: 'Monstera deliciosa is an iconic tropical climbing plant with dramatic perforated leaves.',
      idealTempMin: 18,
      idealTempMax: 28,
      criticalMinTemp: 10,
      criticalMaxTemp: 35,
      light: 'Bright indirect sunlight',
      humidity: 'High (60-80%)',
      soilType: 'Chunky aroid mix with bark and perlite',
      wateringNeeds: 'Water when top 3-4 cm of soil dry out.',
      waterMlPerPotLitre: 85,
      waterTypicalRange: '70 - 100 ml/L',
      recommendedFrequencyPerWeek: 1.5,
      droughtTolerance: 'medium',
      overwateringSensitivity: 'high',
      commonProblems: ['Yellow leaves from overwatering', 'Dry brown edges from low humidity'],
      tips: ['Clean broad leaves with damp sponge', 'Provide moss pole for climbing'],
    },
    baseWaterMl: 400, // 85 * 5.0 * 0.95 = ~400 ml
    pourDaysOfWeek: [1, 5], // Monday & Friday
  });

  // Plant 2: Snake Plant
  const snakePlant = await Plant.create({
    userId: user._id,
    name: 'Sansevieria (Blade)',
    emoji: '🌿',
    location: { city: 'Zurich', lat: 47.3769, lon: 8.5417, country: 'Switzerland' },
    environment: 'balcony',
    pot: { volumeL: 3.5, diameterCm: 18, heightCm: 18, material: 'terracotta', drainage: true },
    careInfo: {
      shortDescription: 'Hardy architectural succulent with upright sword-like variegated foliage.',
      idealTempMin: 16,
      idealTempMax: 30,
      criticalMinTemp: 8,
      criticalMaxTemp: 38,
      light: 'Direct sun to medium indirect',
      humidity: 'Low to average (30-50%)',
      soilType: 'Gritty cactus & succulent soil',
      wateringNeeds: 'Let potting mix dry out completely before watering.',
      waterMlPerPotLitre: 50,
      waterTypicalRange: '40 - 65 ml/L',
      recommendedFrequencyPerWeek: 1,
      droughtTolerance: 'high',
      overwateringSensitivity: 'high',
      commonProblems: ['Root rot from water accumulation'],
      tips: ['Never leave sitting in standing drainage water'],
    },
    baseWaterMl: 200, // 50 * 3.5 * 1.15 = ~200 ml
    pourDaysOfWeek: [3], // Wednesday
  });

  // Plant 3: Fiddle Leaf Fig
  const fiddleFig = await Plant.create({
    userId: user._id,
    name: 'Fiddle Leaf Fig (Figaro)',
    emoji: '🌳',
    location: { city: 'Zurich', lat: 47.3769, lon: 8.5417, country: 'Switzerland' },
    environment: 'indoor',
    pot: { volumeL: 7.0, diameterCm: 25, heightCm: 25, material: 'plastic', drainage: true },
    careInfo: {
      shortDescription: 'Magnificent indoor statement tree with glossy violin-shaped foliage.',
      idealTempMin: 18,
      idealTempMax: 26,
      criticalMinTemp: 12,
      criticalMaxTemp: 34,
      light: 'Bright filtered sunlight',
      humidity: 'Moderate to high (50-65%)',
      soilType: 'Rich aerated loamy mix',
      wateringNeeds: 'Water thoroughly once top 5 cm dry out.',
      waterMlPerPotLitre: 90,
      waterTypicalRange: '75 - 110 ml/L',
      recommendedFrequencyPerWeek: 1,
      droughtTolerance: 'low',
      overwateringSensitivity: 'high',
      commonProblems: ['Brown leaf spots', 'Foliage drop if moved'],
      tips: ['Keep away from drafty doorways or AC vents'],
    },
    baseWaterMl: 630, // 90 * 7.0 = 630 ml
    pourDaysOfWeek: [0, 4], // Sunday & Thursday
  });

  console.log('🪴 Created 3 plants with complete botanical & pot profiles.');

  // 3. Create Caretakers (Friends)
  const alex = await Caretaker.create({
    plantId: monstera._id,
    name: 'Alex Green',
    email: 'alex@example.com',
    invitedBy: user._id,
    magicTokenHash: 'magic_token_alex_123',
    tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  const lucas = await Caretaker.create({
    plantId: snakePlant._id,
    name: 'Lucas Moss',
    email: 'lucas@example.com',
    invitedBy: user._id,
    magicTokenHash: 'magic_token_lucas_456',
    tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  console.log('👥 Created caretakers (Alex Green, Lucas Moss).');

  // 4. Create Historical WaterLogs (Last 3 weeks)
  const now = new Date();
  const pastEvents = [
    {
      daysAgo: 21,
      plant: monstera,
      person: 'Sophia Botanica',
      baseMl: 400,
      temp: 19,
      humidity: 55,
      rain: 0,
      actualMl: 400,
    },
    {
      daysAgo: 18,
      plant: snakePlant,
      person: 'Lucas Moss',
      baseMl: 200,
      temp: 14,
      humidity: 65,
      rain: 0,
      actualMl: 180,
    },
    {
      daysAgo: 14,
      plant: monstera,
      person: 'Alex Green',
      baseMl: 400,
      temp: 26,
      humidity: 35,
      rain: 0,
      actualMl: 440,
    },
    {
      daysAgo: 11,
      plant: fiddleFig,
      person: 'Sophia Botanica',
      baseMl: 630,
      temp: 22,
      humidity: 50,
      rain: 0,
      actualMl: 630,
    },
    {
      daysAgo: 7,
      plant: monstera,
      person: 'Sophia Botanica',
      baseMl: 400,
      temp: 1, // Freezing snap
      humidity: 70,
      rain: 0,
      actualMl: 240,
    },
    {
      daysAgo: 4,
      plant: snakePlant,
      person: 'Sophia Botanica',
      baseMl: 200,
      temp: 31, // Heat wave
      humidity: 30,
      rain: 0,
      actualMl: 230,
    },
    {
      daysAgo: 2,
      plant: fiddleFig,
      person: 'Alex Green',
      baseMl: 630,
      temp: 21,
      humidity: 50,
      rain: 0,
      actualMl: 630,
    },
  ];

  for (const event of pastEvents) {
    const eventDate = new Date(now);
    eventDate.setDate(now.getDate() - event.daysAgo);
    eventDate.setHours(8, 30, 0, 0);

    const fuzzy = evaluateFuzzyWatering({
      temp: event.temp,
      humidity: event.humidity,
      rainMm: event.rain,
      environment: event.plant.environment,
      droughtTolerance: event.plant.careInfo.droughtTolerance,
      potMaterial: event.plant.pot.material,
      baseWaterMl: event.baseMl,
    });

    await WaterLog.create({
      plantId: event.plant._id,
      userId: user._id,
      personName: event.person,
      status: 'poured',
      amountMl: event.actualMl,
      baseAmountMl: event.baseMl,
      suggestedAmountMl: fuzzy.suggestedWaterMl,
      pouredAt: eventDate,
      fuzzyFactor: fuzzy.finalFuzzyFactor,
      weatherSnapshot: {
        temp: event.temp,
        tempMax: event.temp + 3,
        tempMin: event.temp - 3,
        humidity: event.humidity,
        rainMm: event.rain,
        conditionDescription: event.temp <= 3 ? 'Freezing / Frost' : event.temp >= 30 ? 'Clear / Sunny' : 'Pleasant',
        fetchedAt: eventDate,
      },
    });
  }

  console.log(`📊 Created ${pastEvents.length} historical watering logs spanning the last 3 weeks.`);

  // 5. Create Upcoming Schedules (Today and next 10 days)
  const upcomingPlan = [
    { daysFromNow: 0, plant: monstera, assigned: { role: 'owner' as const, name: user.name, email: user.email }, temp: 22, hum: 48, rain: 0 },
    { daysFromNow: 2, plant: snakePlant, assigned: { role: 'caretaker' as const, name: lucas.name, email: lucas.email, caretakerId: lucas._id }, temp: 24, hum: 45, rain: 0 },
    { daysFromNow: 4, plant: fiddleFig, assigned: { role: 'owner' as const, name: user.name, email: user.email }, temp: 19, hum: 55, rain: 2.0 },
    { daysFromNow: 5, plant: monstera, assigned: { role: 'caretaker' as const, name: alex.name, email: alex.email, caretakerId: alex._id }, temp: 23, hum: 50, rain: 0 },
    { daysFromNow: 7, plant: fiddleFig, assigned: { role: 'owner' as const, name: user.name, email: user.email }, temp: 20, hum: 52, rain: 0 },
  ];

  for (const item of upcomingPlan) {
    const schedDate = new Date(now);
    schedDate.setDate(now.getDate() + item.daysFromNow);
    schedDate.setHours(item.daysFromNow === 0 ? 9 : 8, 0, 0, 0);

    const fuzzy = evaluateFuzzyWatering({
      temp: item.temp,
      humidity: item.hum,
      rainMm: item.rain,
      environment: item.plant.environment,
      droughtTolerance: item.plant.careInfo.droughtTolerance,
      potMaterial: item.plant.pot.material,
      baseWaterMl: item.plant.baseWaterMl,
    });

    const magicToken = crypto.randomBytes(16).toString('hex');

    await Schedule.create({
      plantId: item.plant._id,
      userId: user._id,
      date: schedDate,
      assignedTo: item.assigned,
      baseMl: item.plant.baseWaterMl,
      suggestedMl: fuzzy.suggestedWaterMl,
      fuzzyFactor: fuzzy.finalFuzzyFactor,
      fuzzyTrace: {
        reason: fuzzy.reason,
        factor: fuzzy.finalFuzzyFactor,
        rulesFired: fuzzy.explanation.rulesTriggered.map((r) => r.description),
        memberships: fuzzy.explanation.memberships,
        crispInputs: {
          temp: item.temp,
          humidity: item.hum,
          rainMm: item.rain,
          environment: item.plant.environment,
          droughtTolerance: item.plant.careInfo.droughtTolerance,
          potMaterial: item.plant.pot.material,
        },
      },
      weatherSnapshot: {
        temp: item.temp,
        tempMax: item.temp + 4,
        tempMin: item.temp - 3,
        humidity: item.hum,
        rainMm: item.rain,
        conditionDescription: item.rain > 0 ? 'Light Rain' : 'Sunny',
        fetchedAt: new Date(),
      },
      magicToken,
      status: 'pending',
    });
  }

  console.log(`📅 Created ${upcomingPlan.length} scheduled watering events including TODAY.`);

  // 6. Create Badges / Achievements
  await Achievement.create([
    {
      plantId: monstera._id,
      userId: user._id,
      personName: 'Sophia Botanica',
      badge: 'Plant Whisperer',
      description: 'Poured the exact fuzzy-suggested water amount within 5% precision!',
      icon: '🎯',
      awardedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
    {
      plantId: monstera._id,
      userId: user._id,
      personName: 'Sophia Botanica',
      badge: 'Weather Warrior',
      description: 'Successfully adapted watering during a 1°C freezing cold snap!',
      icon: '🛡️',
      awardedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
    {
      plantId: monstera._id,
      userId: user._id,
      personName: 'Alex Green',
      badge: 'Early Bird',
      description: 'Poured water before 9:00 AM on schedule!',
      icon: '🌅',
      awardedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    },
    {
      plantId: snakePlant._id,
      userId: user._id,
      personName: 'Sophia Botanica',
      badge: 'Never Missed',
      description: 'Completed 5 consecutive watering sessions without missing a single pour!',
      icon: '⭐',
      awardedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
    {
      userId: user._id,
      personName: 'Sophia Botanica',
      badge: 'MVP of the Month',
      description: 'Logged the highest number of successful plant watering sessions this month!',
      icon: '🏆',
      awardedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  ]);

  console.log('🏆 Awarded badges (Plant Whisperer, Weather Warrior, Early Bird, Never Missed, MVP of Month).');
  console.log('✅ Seed completed successfully! You can now log in with sophia@example.com / password123');

  if (disconnectOnFinish) {
    await disconnectDB();
  }
}

// If executed directly from command line
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase(true).catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  });
}
