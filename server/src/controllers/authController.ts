import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { User } from '../models/User.js';
import { AuthRequest } from '../middleware/authMiddleware.js';
import { getSmtpStatus, configureSmtp, verifySmtp, sendTestEmail } from '../services/emailService.js';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must have at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  timezone: z.string().optional(),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid reminder time format').optional(),
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

function generateToken(userId: string): string {
  const secret = process.env.JWT_SECRET || 'dev_plant_care_secret_jwt_key_2026';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ userId }, secret, { expiresIn: expiresIn as any });
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const validated = registerSchema.parse(req.body);

    const existing = await User.findOne({ email: validated.email.toLowerCase() });
    if (existing) {
      res.status(400).json({ error: 'An account with this email address already exists.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(validated.password, salt);

    const user = await User.create({
      name: validated.name.trim(),
      email: validated.email.toLowerCase().trim(),
      passwordHash,
      timezone: validated.timezone || 'UTC',
      reminderTime: validated.reminderTime || '08:00',
    });

    const token = generateToken(user._id.toString());

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        timezone: user.timezone,
        reminderTime: user.reminderTime,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.issues.map((e) => e.message).join(', ') });
      return;
    }
    console.error('[AuthController] Register error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const validated = loginSchema.parse(req.body);

    const user = await User.findOne({ email: validated.email.toLowerCase().trim() });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isMatch = await bcrypt.compare(validated.password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = generateToken(user._id.toString());

    res.json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        timezone: user.timezone,
        reminderTime: user.reminderTime,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.issues.map((e) => e.message).join(', ') });
      return;
    }
    console.error('[AuthController] Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
}

export async function getCurrentUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        timezone: req.user.timezone,
        reminderTime: req.user.reminderTime,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching user.' });
  }
}

export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { name, timezone, reminderTime } = req.body;
    if (name) req.user.name = name.trim();
    if (timezone) req.user.timezone = timezone.trim();
    if (reminderTime) req.user.reminderTime = reminderTime;

    await req.user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        timezone: req.user.timezone,
        reminderTime: req.user.reminderTime,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating profile.' });
  }
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Don't reveal if account exists for security
      res.json({ message: 'If that email is registered, password reset instructions have been generated.' });
      return;
    }

    const resetToken = crypto.randomBytes(24).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    console.log(`[Auth] Password reset token for ${user.email}: ${resetToken}`);

    res.json({
      message: 'If that email is registered, password reset instructions have been generated.',
      debugToken: resetToken, // Provided for easy development testing
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error during password reset request.' });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'Valid token and new password (min 6 chars) are required.' });
      return;
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired password reset token.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error during password reset.' });
  }
}

/**
 * GET /api/auth/smtp-status
 */
export async function getSmtpConfigHandler(req: Request, res: Response): Promise<void> {
  try {
    const status = getSmtpStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error fetching SMTP status' });
  }
}

/**
 * POST /api/auth/smtp-config
 */
export async function saveSmtpConfigHandler(req: Request, res: Response): Promise<void> {
  try {
    const { service, host, port, user, pass, from } = req.body;
    configureSmtp({
      service,
      host,
      port: port ? Number(port) : 587,
      user,
      pass,
      from,
    });

    // Persist to server/.env if user & pass provided
    if (user && pass) {
      try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
          let envContent = fs.readFileSync(envPath, 'utf-8');
          envContent = envContent.replace(/SMTP_SERVICE=.*/, `SMTP_SERVICE=${service || 'gmail'}`);
          envContent = envContent.replace(/SMTP_USER=.*/, `SMTP_USER=${user}`);
          envContent = envContent.replace(/SMTP_PASS=.*/, `SMTP_PASS=${pass}`);
          if (host) envContent = envContent.replace(/SMTP_HOST=.*/, `SMTP_HOST=${host}`);
          if (port) envContent = envContent.replace(/SMTP_PORT=.*/, `SMTP_PORT=${port}`);
          fs.writeFileSync(envPath, envContent, 'utf-8');
          console.log('[Auth] Persisted SMTP configuration to server/.env');
        }
      } catch (envErr) {
        console.warn('[Auth] Could not write to .env:', envErr);
      }
    }

    const verifyResult = await verifySmtp();
    const status = getSmtpStatus();
    res.json({
      message: verifyResult.message,
      verified: verifyResult.success,
      isEthereal: verifyResult.isEthereal,
      status,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error saving SMTP configuration' });
  }
}

/**
 * POST /api/auth/test-email
 */
export async function sendTestEmailHandler(req: Request, res: Response): Promise<void> {
  try {
    const toEmail = (req.body.toEmail || req.body.email || '').trim();
    if (!toEmail) {
      res.status(400).json({ error: 'Recipient email address is required' });
      return;
    }

    const result = await sendTestEmail(toEmail);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to send test email' });
  }
}

