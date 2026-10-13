import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '5001', 10),
  APP_URL: process.env.APP_URL || 'http://localhost:5173',
  MONGODB_URI: process.env.MONGODB_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_plant_care_secret_jwt_key_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  WEATHER_PROVIDER: process.env.WEATHER_PROVIDER || 'open-meteo',
  OPENWEATHERMAP_API_KEY: process.env.OPENWEATHERMAP_API_KEY || '',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.ethereal.email',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || '"Plant Care Companion" <noreply@plantcare.local>',
  SCHEDULER_CRON: process.env.SCHEDULER_CRON || '0 8 * * *',
};
