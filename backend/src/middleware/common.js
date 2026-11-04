import { ZodError } from 'zod';
import { AppError, badRequest } from '../utils/errors.js';

/** Turn Zod issues into { field: message } for accessible form error display. */
export function zodToFields(error) {
  const fields = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/**
 * Validate and replace req.body / req.query / req.params with parsed data.
 * Unknown keys are rejected by `.strict()` schemas (mass-assignment protection).
 */
export const validate =
  ({ body, query, params } = {}) =>
  (req, _res, next) => {
    try {
      if (params) req.params = params.parse(req.params);
      if (query) req.validatedQuery = query.parse(req.query);
      if (body) req.body = body.parse(req.body ?? {});
      next();
    } catch (e) {
      if (e instanceof ZodError) return next(badRequest('Certaines informations sont invalides.', zodToFields(e)));
      next(e);
    }
  };

/** Remove keys used for NoSQL operator injection ($gt, a.b). */
export function sanitize(obj) {
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('$') || k.includes('.')) continue;
      out[k] = sanitize(v);
    }
    return out;
  }
  return obj;
}

export function sanitizeRequest(req, _res, next) {
  if (req.body) req.body = sanitize(req.body);
  if (req.params) req.params = sanitize(req.params);
  // req.query is a getter in Express 5; in Express 4 it is a plain object.
  if (req.query) {
    for (const k of Object.keys(req.query)) {
      if (k.startsWith('$') || k.includes('.')) delete req.query[k];
      else if (typeof req.query[k] === 'object') delete req.query[k]; // no nested query objects
    }
  }
  next();
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route introuvable : ${req.method} ${req.originalUrl}` } });
}

export const errorHandler = (logger) => (err, req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, fields: err.details } });
  }
  if (err?.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Image trop volumineuse.' : 'Fichier invalide.';
    return res.status(400).json({ error: { code: 'UPLOAD_ERROR', message: msg } });
  }
  if (err?.name === 'ValidationError') {
    const fields = Object.fromEntries(Object.entries(err.errors || {}).map(([k, v]) => [k, v.message]));
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Données invalides.', fields } });
  }
  if (err?.name === 'CastError') {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Identifiant invalide.' } });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: { code: 'DUPLICATE', message: 'Cette ressource existe déjà.' } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Corps de requête JSON invalide.' } });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Requête trop volumineuse.' } });
  }
  logger?.error?.(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Une erreur interne est survenue.' } });
};
