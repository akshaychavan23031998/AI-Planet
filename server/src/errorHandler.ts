import type { ErrorRequestHandler } from 'express';
import { mapApiError } from './api/v1/errorMapping.js';

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req,
  res,
  next,
) => {
  const mapped = mapApiError(error);
  if (mapped.status === 500)
    req.log.error({ code: 'INTERNAL_ERROR' }, 'Unexpected request error');
  if (res.headersSent) {
    next(error);
    return;
  }
  res.status(mapped.status).json(mapped.body);
};
