import { forbidden, unauthorized, AppError } from '../utils/errors.js';

export const AUTH_COOKIE = 'iv_token';

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return { token: header.slice(7), via: 'header' };
  if (req.cookies?.[AUTH_COOKIE]) return { token: req.cookies[AUTH_COOKIE], via: 'cookie' };
  return { token: null, via: null };
}

/**
 * Builds authentication middleware.
 *  - `required`: 401 without a valid token.
 *  - `optional`: attaches req.user when a valid token is present (public routes that
 *    adapt to the viewer, e.g. "my booking" on an event page).
 * The user is reloaded on each request so suspended accounts, role changes and
 * password changes take effect immediately (tokens issued before a password change
 * are rejected).
 */
export function createAuthMiddleware({ verify, userRepo }) {
  async function resolve(req) {
    const { token, via } = extractToken(req);
    if (!token) return null;
    let payload;
    try {
      payload = verify(token);
    } catch {
      throw unauthorized('Session expirée ou invalide. Veuillez vous reconnecter.');
    }
    const user = await userRepo.findById(payload.sub);
    if (!user) throw unauthorized('Session invalide.');
    if (user.status === 'suspended') throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Votre compte est suspendu.');
    if (user.passwordChangedAt && payload.iat * 1000 < new Date(user.passwordChangedAt).getTime() - 1000) {
      throw unauthorized('Votre mot de passe a changé. Veuillez vous reconnecter.');
    }
    req.authVia = via;
    return { id: String(user._id), role: user.role, name: user.name, email: user.email, preferences: user.preferences };
  }

  const required = async (req, _res, next) => {
    try {
      const user = await resolve(req);
      if (!user) throw unauthorized();
      req.user = user;
      next();
    } catch (e) {
      next(e);
    }
  };

  const optional = async (req, _res, next) => {
    try {
      req.user = (await resolve(req)) || null;
      next();
    } catch {
      req.user = null; // an invalid token on a public route behaves like a visitor
      next();
    }
  };

  return { required, optional };
}

/** Role-based authorization. Must run after `required`. */
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (roles.length && !roles.includes(req.user.role)) return next(forbidden());
    next();
  };

/**
 * CSRF mitigation for cookie-authenticated, state-changing requests: the browser
 * client must send a custom header, which cross-site forms cannot set
 * (combined with SameSite=Strict cookies and a strict CORS origin).
 */
export function requireCsrfHeader(req, _res, next) {
  const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (unsafe && !req.headers.authorization && req.cookies?.[AUTH_COOKIE] && req.get('x-requested-with') !== 'XMLHttpRequest') {
    return next(forbidden('En-tête X-Requested-With manquant.'));
  }
  next();
}
