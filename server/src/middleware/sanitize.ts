import { Request, Response, NextFunction } from 'express';

function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const cleaned: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    // Strip leading '$' or '.' to prevent NoSQL injection operators ($gt, $where, etc.)
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    cleaned[key] = sanitizeObject(obj[key]);
  }
  return cleaned;
}

export function sanitizeInputs(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
}
