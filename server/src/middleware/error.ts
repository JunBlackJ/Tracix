import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../config';

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  if (err instanceof Error) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

    if (config.nodeEnv === 'development') {
      res.status(500).json({ error: err.message, stack: err.stack });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
    return;
  }

  res.status(500).json({ error: 'Unknown error' });
}
