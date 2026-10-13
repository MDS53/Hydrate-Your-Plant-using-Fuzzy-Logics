import nodemailer, { type Transporter } from 'nodemailer';

export interface SmtpSettings {
  service?: string; // e.g. 'gmail'
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
}

let runtimeSmtpSettings: SmtpSettings | null = null;
let transporter: Transporter | null = null;
let lastTestMessageUrl: string | null = null;

export function configureSmtp(settings: SmtpSettings): void {
  runtimeSmtpSettings = { ...settings };
  transporter = null; // force recreation
  console.log('[Email] Runtime SMTP settings updated.');
}

export function getEffectiveConfig(): SmtpSettings {
  const service = (runtimeSmtpSettings?.service || process.env.SMTP_SERVICE || '').trim();
  const host = (runtimeSmtpSettings?.host || process.env.SMTP_HOST || '').trim();
  const port = runtimeSmtpSettings?.port || (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587);
  const secure =
    runtimeSmtpSettings?.secure !== undefined
      ? runtimeSmtpSettings.secure
      : process.env.SMTP_SECURE === 'true' || port === 465;
  const user = (runtimeSmtpSettings?.user || process.env.SMTP_USER || '').trim();
  const pass = (runtimeSmtpSettings?.pass || process.env.SMTP_PASS || '').trim();

  // All outgoing mails must be sent strictly from this authenticated mail address to any user
  let from = (runtimeSmtpSettings?.from || process.env.EMAIL_FROM || '').trim();
  if (user) {
    from = `"Hydrate your plant using fuzzy logic" <${user}>`;
  } else if (!from) {
    from = '"Hydrate your plant using fuzzy logic" <noreply@hydrateplant.app>';
  }

  return { service, host, port, secure, user, pass, from };
}

export function getSmtpStatus(): {
  configured: boolean;
  service?: string;
  host: string;
  port: number;
  user: string;
  from: string;
  isEthereal: boolean;
  lastTestMessageUrl: string | null;
} {
  const config = getEffectiveConfig();
  const hasCreds = Boolean(config.user && config.pass);
  const isEthereal = !hasCreds || (config.host || '').includes('ethereal.email');

  let maskedUser = '';
  if (config.user) {
    if (config.user.includes('@')) {
      const [u, d] = config.user.split('@');
      maskedUser = `${u.slice(0, 2)}***@${d}`;
    } else {
      maskedUser = `${config.user.slice(0, 2)}***`;
    }
  }

  return {
    configured: hasCreds,
    service: config.service,
    host: config.service === 'gmail' ? 'smtp.gmail.com' : config.host || 'smtp.ethereal.email',
    port: config.port || 587,
    user: maskedUser,
    from: config.from || 'noreply@hydrateplant.app',
    isEthereal,
    lastTestMessageUrl,
  };
}

async function getTransporter(): Promise<Transporter> {
  if (transporter) return transporter;

  const config = getEffectiveConfig();

  if (config.user && config.pass) {
    if (config.service === 'gmail' || (config.host || '').includes('gmail')) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: config.user, pass: config.pass },
      });
      console.log(`[Email] Configured live Gmail transporter for ${config.user}`);
    } else {
      transporter = nodemailer.createTransport({
        host: config.host || 'smtp.gmail.com',
        port: config.port || 587,
        secure: config.secure || false,
        auth: { user: config.user, pass: config.pass },
        tls: { rejectUnauthorized: false },
      });
      console.log(`[Email] Configured live SMTP transporter (${config.host}:${config.port}) for ${config.user}`);
    }
  } else {
    // Development fallback test account
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`[Email] Generated Ethereal test mailer: ${testAccount.user}`);
    } catch (err) {
      console.warn('[Email] Could not create Ethereal account, falling back to stream mailer.');
      transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      });
    }
  }

  return transporter;
}

export async function verifySmtp(): Promise<{ success: boolean; message: string; isEthereal: boolean }> {
  const config = getEffectiveConfig();
  const isEthereal = !config.user || !config.pass;
  try {
    const t = await getTransporter();
    await t.verify();
    return {
      success: true,
      message: isEthereal
        ? 'Connected to Ethereal Test Mailer. Emails will generate clickable preview links in server logs.'
        : 'SMTP connection verified successfully! Live emails will be delivered.',
      isEthereal,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to connect to SMTP server. Please verify credentials.',
      isEthereal,
    };
  }
}

export async function sendTestEmail(toEmail: string): Promise<{ success: boolean; message: string; previewUrl?: string }> {
  try {
    const t = await getTransporter();
    const config = getEffectiveConfig();
    const info = await t.sendMail({
      from: config.from,
      to: toEmail,
      subject: '🌱 Test Notification - Hydrate your plant using fuzzy logic',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e7e5e4; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #065f46; margin-top: 0;">🌿 Email Delivery Verified!</h2>
          <p>Congratulations! Your email notification setup for <strong>Hydrate your plant using fuzzy logic</strong> is working seamlessly.</p>
          <p style="font-size: 13px; color: #57534e;">All upcoming watering schedules, time-to-water alerts, and watering confirmations will be safely delivered to this inbox.</p>
          <div style="margin-top: 20px; padding: 12px; background: #f0fdf4; border-radius: 8px; font-size: 12px; color: #166534;">
            Status: Active &bull; Time: ${new Date().toLocaleString()}
          </div>
        </div>
      `,
    });

    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) {
      lastTestMessageUrl = preview;
      console.log(`[Email] 📨 TEST EMAIL PREVIEW: ${preview}`);
    }

    return {
      success: true,
      message: `Test email sent to ${toEmail}!`,
      previewUrl: preview ? (preview as string) : undefined,
    };
  } catch (err: any) {
    console.error('[Email] Failed to send test email:', err);
    throw new Error(err.message || 'Failed to dispatch test email');
  }
}

/**
 * Send the whole schedule notification to user or added friend
 */
export async function sendScheduleNotificationEmail(params: {
  recipientEmail: string;
  recipientName: string;
  plantName: string;
  plantEmoji: string;
  plantId?: string;
  assignedDates: string[];
  baseAmountMl: number;
  wateringTime?: string;
  potInfo?: {
    volumeL: number;
    material?: string;
    dimensions?: string;
    drainage?: boolean;
  };
  caretakers?: { name: string; email: string }[];
  appUrl: string;
}): Promise<{ messageId?: string; previewUrl?: string | null }> {
  const {
    recipientEmail,
    recipientName,
    plantName,
    plantEmoji,
    plantId,
    assignedDates,
    baseAmountMl,
    wateringTime = '08:00',
    potInfo,
    caretakers = [],
    appUrl,
  } = params;

  const config = getEffectiveConfig();
  const directLink = plantId ? `${appUrl}/plant/${plantId}` : appUrl;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f6; margin: 0; padding: 24px; color: #292524; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e7e5e4; }
    .header { background: linear-gradient(135deg, #065f46, #047857); color: #ffffff; padding: 32px 24px; text-align: center; }
    .emoji { font-size: 52px; margin-bottom: 8px; }
    .title { font-size: 24px; font-weight: 800; margin: 0; }
    .subtitle { font-size: 14px; opacity: 0.9; margin-top: 6px; }
    .content { padding: 32px 24px; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #065f46; margin: 20px 0 8px 0; }
    .spec-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #fbfbfb; border: 1px solid #f0eee9; border-radius: 12px; padding: 14px; margin-bottom: 16px; }
    .spec-item { font-size: 13px; color: #44403c; }
    .spec-item strong { color: #1c1917; }
    .schedule-box { background: #fafaf9; border-radius: 12px; padding: 16px; border: 1px solid #e7e5e4; }
    .date-badge { display: inline-block; background: #ecfdf5; color: #065f46; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 6px; margin: 4px; border: 1px solid #a7f3d0; }
    .btn { display: inline-block; background: #065f46; color: #ffffff !important; text-decoration: none; padding: 13px 28px; border-radius: 10px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(6,95,70,0.25); }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #78716c; border-top: 1px solid #f5f5f4; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="emoji">${plantEmoji}</div>
      <h1 class="title">${plantName} - Complete Watering Schedule</h1>
      <div class="subtitle">Hydrate your plant using fuzzy logic</div>
    </div>
    <div class="content">
      <p style="font-size: 15px;">Hello <strong>${recipientName}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.6; color: #44403c;">
        Here is the full watering schedule for <strong>${plantName}</strong>. You and your added care team can monitor and keep this plant healthy together!
      </p>

      <div class="section-title">Plant & Pot Specifications</div>
      <div class="spec-grid">
        <div class="spec-item"><strong>Base Hydration:</strong> ${baseAmountMl} ml per pour</div>
        <div class="spec-item"><strong>Preferred Time:</strong> ${wateringTime}</div>
        ${potInfo ? `<div class="spec-item"><strong>Pot Volume:</strong> ${potInfo.volumeL} L</div>` : ''}
        ${potInfo?.dimensions ? `<div class="spec-item"><strong>Dimensions:</strong> ${potInfo.dimensions}</div>` : ''}
        ${potInfo?.material ? `<div class="spec-item"><strong>Pot Material:</strong> ${potInfo.material}</div>` : ''}
        ${potInfo?.drainage !== undefined ? `<div class="spec-item"><strong>Drainage:</strong> ${potInfo.drainage ? 'Yes' : 'No'}</div>` : ''}
      </div>

      <div class="section-title">Upcoming Scheduled Watering Dates</div>
      <div class="schedule-box">
        <div style="margin-bottom: 8px;">
          ${assignedDates.map((d) => `<span class="date-badge">📅 ${d} at ${wateringTime}</span>`).join(' ')}
        </div>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #57534e; line-height: 1.5;">
          <em>Note:</em> At each scheduled time, our Mamdani fuzzy inference engine evaluates live temperature, humidity, and rainfall to calculate the optimal milliliters of water!
        </p>
      </div>

      ${caretakers.length > 0 ? `
      <div class="section-title">Assigned Care Team</div>
      <div style="background: #fbfbfb; border: 1px solid #f0eee9; border-radius: 12px; padding: 12px; font-size: 13px; color: #44403c;">
        <p style="margin: 0 0 6px 0;"><strong>Active Caretakers:</strong></p>
        <ul style="margin: 0; padding-left: 20px;">
          ${caretakers.map((c) => `<li>${c.name} (${c.email})</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      <div style="text-align: center; margin-top: 28px;">
        <a href="${directLink}" class="btn">View Plant on Website &rarr;</a>
        <p style="margin-top: 10px; font-size: 12px; color: #78716c;">
          Link: <a href="${directLink}" style="color: #065f46;">${directLink}</a>
        </p>
      </div>
    </div>
    <div class="footer">
      Hydrate your plant using fuzzy logic &bull; Smart Botanical Hydration
    </div>
  </div>
</body>
</html>
  `;

  try {
    const t = await getTransporter();
    const info = await t.sendMail({
      from: config.from,
      to: recipientEmail,
      subject: `🌱 Whole Watering Schedule for ${plantName}`,
      html,
    });

    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) {
      lastTestMessageUrl = preview;
      console.log(`[Email] 📨 SCHEDULE EMAIL PREVIEW for ${recipientEmail}: ${preview}`);
    } else {
      console.log(`[Email] Schedule notification sent to ${recipientEmail} (ID: ${info.messageId})`);
    }

    return { messageId: info.messageId, previewUrl: preview ? (preview as string) : null };
  } catch (err) {
    console.error(`[Email] Failed to send schedule email to ${recipientEmail}:`, err);
    throw err;
  }
}

/**
 * Send Time-to-Water Reminder at selected time to user & friends
 * Must include: "stating that its time to water provide a link to website stating that: please update it in website"
 */
export async function sendWateringReminderEmail(params: {
  recipientEmail: string;
  recipientName: string;
  plantName: string;
  plantEmoji: string;
  plantId?: string;
  scheduleId?: string;
  wateringTime?: string;
  suggestedMl: number;
  baseMl: number;
  weatherReason: string;
  weatherBadge: { temp: string; humidity: string; rain: string; emoji: string };
  actionUrl: string;
  websiteUrl?: string;
}): Promise<{ messageId?: string; previewUrl?: string | null }> {
  const {
    recipientEmail,
    recipientName,
    plantName,
    plantEmoji,
    wateringTime = 'scheduled time',
    suggestedMl,
    baseMl,
    weatherReason,
    weatherBadge,
    actionUrl,
    websiteUrl,
  } = params;

  const config = getEffectiveConfig();
  const directWebLink = websiteUrl || actionUrl;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f6; margin: 0; padding: 24px; color: #292524; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e7e5e4; }
    .header { background: linear-gradient(135deg, #065f46, #047857); color: #ffffff; padding: 32px 24px; text-align: center; }
    .emoji { font-size: 52px; margin-bottom: 8px; }
    .title { font-size: 24px; font-weight: 800; margin: 0; }
    .content { padding: 32px 24px; }
    .water-box { background: #ecfdf5; border: 2px dashed #065f46; border-radius: 14px; padding: 22px; text-align: center; margin: 24px 0; }
    .water-amount { font-size: 34px; font-weight: 800; color: #065f46; margin: 6px 0; }
    .base-amount { font-size: 14px; color: #047857; font-weight: 500; }
    .weather-pill { display: inline-flex; align-items: center; gap: 8px; background: #ffffff; border: 1px solid #bbf7d0; padding: 6px 14px; border-radius: 20px; font-size: 13px; color: #166534; margin-top: 10px; }
    .btn { display: inline-block; background: #065f46; color: #ffffff !important; text-decoration: none; padding: 14px 30px; border-radius: 10px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(6,95,70,0.25); }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #78716c; border-top: 1px solid #f5f5f4; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="emoji">${plantEmoji}</div>
      <h1 class="title">It's time to water ${plantName}!</h1>
    </div>
    <div class="content">
      <p style="font-size: 15px;">Hello <strong>${recipientName}</strong>,</p>
      <p style="font-size: 15px; color: #1c1917; line-height: 1.6;">
        <strong>It's time to water ${plantName}!</strong> It has reached your selected watering time (<strong>${wateringTime}</strong>).
      </p>
      
      <div class="water-box">
        <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #047857; font-weight: 700;">Live Weather-Smart Suggestion</div>
        <div class="water-amount">${suggestedMl} ml</div>
        <div class="base-amount">(Standard base: ${baseMl} ml)</div>
        <div class="weather-pill">
          ${weatherBadge.emoji} ${weatherBadge.temp} &bull; ${weatherBadge.humidity} humidity &bull; ${weatherBadge.rain} rain
        </div>
        <p style="margin: 12px 0 0 0; font-size: 13px; color: #15803d; font-style: italic;">
          "${weatherReason}"
        </p>
      </div>

      <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0;">
        <p style="margin: 0 0 14px 0; font-size: 15px; font-weight: 600; color: #1c1917;">
          After pouring the water, please update it in website:
        </p>
        <a href="${actionUrl}" class="btn">Please update it in website &rarr;</a>
        <p style="margin: 14px 0 0 0; font-size: 13px; color: #57534e;">
          Website link: <a href="${directWebLink}" style="color: #065f46; font-weight: 600;">${directWebLink}</a>
        </p>
      </div>

      <p style="font-size: 13px; color: #78716c; text-align: center; margin-top: 16px;">
        Updating the website records your pour in the health log and notifies your care team members.
      </p>
    </div>
    <div class="footer">
      Hydrate your plant using fuzzy logic &bull; Weather-Smart Watering Companion
    </div>
  </div>
</body>
</html>
  `;

  try {
    const t = await getTransporter();
    const info = await t.sendMail({
      from: config.from,
      to: recipientEmail,
      subject: `🌱 It's time to water ${plantName}! Please update it in website`,
      html,
    });

    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) {
      lastTestMessageUrl = preview;
      console.log(`[Email] 📨 TIME-TO-WATER REMINDER PREVIEW for ${recipientEmail}: ${preview}`);
    } else {
      console.log(`[Email] Reminder sent to ${recipientEmail} (ID: ${info.messageId})`);
    }

    return { messageId: info.messageId, previewUrl: preview ? (preview as string) : null };
  } catch (err) {
    console.error(`[Email] Failed to send reminder email to ${recipientEmail}:`, err);
    throw err;
  }
}

/**
 * Send Confirmation Broadcast Email (Owner & Friends notification when someone waters)
 */
export async function sendWateringConfirmationNotification(params: {
  recipients: { email: string; name: string }[];
  pouredBy: string;
  plantName: string;
  plantEmoji: string;
  plantId?: string;
  amountMl: number;
  status: 'poured' | 'missed' | 'skipped';
  reason?: string;
  pouredAt: Date;
  websiteUrl?: string;
}): Promise<void> {
  const { recipients, pouredBy, plantName, plantEmoji, plantId, amountMl, status, reason, pouredAt, websiteUrl } = params;
  const config = getEffectiveConfig();

  const isPoured = status === 'poured';
  const subject = isPoured
    ? `✅ ${pouredBy} watered ${plantName}! (${amountMl} ml)`
    : `⚠️ Notice: ${plantName} watering was marked as ${status}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f6; margin: 0; padding: 24px; color: #292524; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e7e5e4; }
    .header { background: ${isPoured ? 'linear-gradient(135deg, #065f46, #047857)' : 'linear-gradient(135deg, #b45309, #d97706)'}; color: #ffffff; padding: 28px 24px; text-align: center; }
    .content { padding: 28px 24px; }
    .details { background: #fafaf9; border-radius: 12px; padding: 18px; margin: 18px 0; border: 1px solid #e7e5e4; font-size: 14px; }
    .btn { display: inline-block; background: #065f46; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; margin-top: 16px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #78716c; border-top: 1px solid #f5f5f4; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div style="font-size: 44px; margin-bottom: 6px;">${plantEmoji}</div>
      <h2 style="margin: 0; font-size: 22px;">${isPoured ? 'Watering Completed!' : 'Watering Status Update'}</h2>
    </div>
    <div class="content">
      <p style="font-size: 15px;">Hello Plant Care Team,</p>
      <p style="font-size: 14px; color: #44403c; line-height: 1.6;">
        <strong>${pouredBy}</strong> just recorded an update for <strong>${plantName}</strong>:
      </p>
      
      <div class="details">
        <p style="margin: 0 0 8px 0;"><strong>Status:</strong> ${status.toUpperCase()}</p>
        ${isPoured ? `<p style="margin: 0 0 8px 0;"><strong>Amount Poured:</strong> ${amountMl} ml</p>` : ''}
        ${reason ? `<p style="margin: 0 0 8px 0;"><strong>Notes / Reason:</strong> ${reason}</p>` : ''}
        <p style="margin: 0;"><strong>Logged at:</strong> ${pouredAt.toLocaleString()}</p>
      </div>

      <p style="font-size: 14px; color: #57534e; line-height: 1.5;">
        ${isPoured ? 'Great work! The plant hydration status and health score have been updated in the dashboard.' : 'If you are available, please check on the plant or update the schedule on the website.'}
      </p>

      ${websiteUrl ? `
      <div style="text-align: center; margin-top: 20px;">
        <a href="${websiteUrl}" class="btn">View Updated Plant on Website</a>
      </div>
      ` : ''}
    </div>
    <div class="footer">
      Hydrate your plant using fuzzy logic &bull; Collaborative Plant Care
    </div>
  </div>
</body>
</html>
  `;

  for (const recipient of recipients) {
    try {
      const t = await getTransporter();
      const info = await t.sendMail({
        from: config.from,
        to: recipient.email,
        subject,
        html,
      });

      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) {
        lastTestMessageUrl = preview;
        console.log(`[Email] 📨 CONFIRMATION BROADCAST PREVIEW for ${recipient.email}: ${preview}`);
      } else {
        console.log(`[Email] Confirmation email sent to ${recipient.email} (ID: ${info.messageId})`);
      }
    } catch (err) {
      console.error(`[Email] Error sending confirmation broadcast to ${recipient.email}:`, err);
    }
  }
}
