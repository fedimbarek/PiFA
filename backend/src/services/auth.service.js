import crypto from 'node:crypto';
import { ROLES, SELF_REGISTER_ROLES } from '../utils/constants.js';
import { AppError, badRequest, conflict, forbidden, unauthorized } from '../utils/errors.js';

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Shape returned to clients — never includes hashes or reset tokens. */
export function toPublicUser(u) {
  if (!u) return null;
  return {
    id: String(u._id ?? u.id),
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    phone: u.phone || '',
    city: u.city || '',
    organizationName: u.organizationName || '',
    bio: u.bio || '',
    preferences: u.preferences,
    createdAt: u.createdAt,
  };
}

/**
 * @param {object} deps
 * @param {object} deps.userRepo
 * @param {{hash:(s:string)=>Promise<string>, compare:(s:string,h:string)=>Promise<boolean>}} deps.hasher
 * @param {{sign:(payload:object)=>string}} deps.tokens
 */
export function createAuthService({ userRepo, hasher, tokens, mailService, settingsService, appUrl = '', clock = () => new Date(), randomToken }) {
  const makeToken = randomToken || (() => crypto.randomBytes(32).toString('hex'));
  const issue = (user) => tokens.sign({ sub: String(user._id), role: user.role });

  async function register(input) {
    // Defense in depth: validation already rejects it, the service refuses it too.
    if (!SELF_REGISTER_ROLES.includes(input.role || ROLES.USER)) throw forbidden('Ce rôle ne peut pas être choisi à l’inscription.');
    if (input.role === ROLES.ORGANIZER && settingsService) {
      const s = await settingsService.get();
      if (s.allowOrganizerSignup === false) throw forbidden('Les inscriptions organisateur sont temporairement fermées.');
    }
    if (await userRepo.existsByEmail(input.email)) throw conflict('Un compte existe déjà avec cette adresse e-mail.', 'EMAIL_TAKEN');
    const passwordHash = await hasher.hash(input.password);
    const user = await userRepo.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role || ROLES.USER,
      organizationName: input.role === ROLES.ORGANIZER ? input.organizationName || '' : '',
    });
    return { user: toPublicUser(user), token: issue(user) };
  }

  async function login({ email, password }) {
    const user = await userRepo.findByEmail(email, { withPassword: true });
    // Same message for unknown e-mail and wrong password (no account enumeration).
    const ok = user ? await hasher.compare(password, user.passwordHash) : false;
    if (!user || !ok) throw unauthorized('Adresse e-mail ou mot de passe incorrect.');
    if (user.status === 'suspended') throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Votre compte est suspendu. Contactez l’administration.');
    await userRepo.updateById(user._id, { lastLoginAt: clock() });
    return { user: toPublicUser(user), token: issue(user) };
  }

  async function me(userId) {
    const user = await userRepo.findById(userId);
    if (!user) throw unauthorized('Session invalide.');
    return toPublicUser(user);
  }

  /** Always resolves the same way whether or not the e-mail exists. */
  async function forgotPassword({ email }) {
    const user = await userRepo.findByEmail(email);
    if (user && user.status === 'active') {
      const token = makeToken();
      await userRepo.setResetToken(user._id, hashToken(token), new Date(clock().getTime() + RESET_TOKEN_TTL_MS));
      const link = `${appUrl}/reinitialiser-mot-de-passe?token=${token}`;
      await mailService?.send({
        to: user.email,
        subject: 'InclusiVenue — Réinitialisation du mot de passe',
        text: `Bonjour ${user.name},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
      });
    }
    return { message: 'Si un compte correspond à cette adresse, un e-mail de réinitialisation a été envoyé.' };
  }

  async function resetPassword({ token, password }) {
    const user = await userRepo.findByResetTokenHash(hashToken(token), clock());
    if (!user) throw badRequest('Ce lien de réinitialisation est invalide ou a expiré.');
    await userRepo.setPassword(user._id, await hasher.hash(password), clock());
    return { message: 'Votre mot de passe a été modifié. Vous pouvez vous connecter.' };
  }

  async function changePassword(userId, { currentPassword, newPassword }) {
    const user = await userRepo.findByIdWithPassword(userId);
    if (!user || !(await hasher.compare(currentPassword, user.passwordHash))) throw badRequest('Le mot de passe actuel est incorrect.');
    await userRepo.setPassword(userId, await hasher.hash(newPassword), clock());
    return { message: 'Mot de passe modifié.' };
  }

  return { register, login, me, forgotPassword, resetPassword, changePassword };
}
