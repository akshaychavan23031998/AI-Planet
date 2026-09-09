import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import { resolveDemoActor } from '../../domain/claims/identity.js';
import type { Actor } from '../../domain/claims/types.js';
import { ApiError } from './errorMapping.js';
import { parse } from './validation.js';

declare module 'express-serve-static-core' {
  interface Request {
    actor?: Actor;
  }
}
export const demoIdentity: RequestHandler = async (req, _res, next) => {
  const code = req.get('X-Demo-Employee-Code');
  if (!code?.trim())
    throw new ApiError(
      'DEMO_IDENTITY_REQUIRED',
      'X-Demo-Employee-Code is required.',
    );
  req.actor = await resolveDemoActor(
    parse(
      z
        .string()
        .trim()
        .regex(/^NX-\d{4}$/),
      code,
      'INVALID_REQUEST',
    ),
  );
  next();
};
export function requestActor(req: Request): Actor {
  if (!req.actor)
    throw new ApiError('DEMO_IDENTITY_REQUIRED', 'Demo identity is required.');
  return req.actor;
}
