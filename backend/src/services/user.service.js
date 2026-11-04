import { ROLES } from '../utils/constants.js';
import { badRequest, notFound } from '../utils/errors.js';
import { paginate, pageResult } from '../utils/pagination.js';
import { toPublicUser } from './auth.service.js';

export function mergePreferences(current = {}, patch = {}) {
  const next = { ...current, ...patch };
  if (patch.preferredFeatures) next.preferredFeatures = [...new Set(patch.preferredFeatures)];
  return next;
}

export function createUserService({ userRepo }) {
  async function getProfile(userId) {
    const u = await userRepo.findById(userId);
    if (!u) throw notFound('Utilisateur introuvable.');
    return toPublicUser(u);
  }

  async function updateProfile(user, data) {
    const patch = { ...data };
    if (user.role !== ROLES.ORGANIZER && user.role !== ROLES.ADMIN) delete patch.organizationName;
    const u = await userRepo.updateById(user.id, { $set: patch });
    return toPublicUser(u);
  }

  async function updatePreferences(userId, patch) {
    const current = await userRepo.findById(userId);
    if (!current) throw notFound('Utilisateur introuvable.');
    const preferences = mergePreferences(current.preferences, patch);
    const u = await userRepo.updateById(userId, { $set: { preferences } });
    return u.preferences;
  }

  // ----- Administration -----
  async function list(query) {
    const p = paginate(query, 100);
    const { items, total } = await userRepo.list({ ...query, skip: p.skip, limit: p.limit });
    return pageResult(items.map(toPublicUser), total, p);
  }

  async function adminUpdate(admin, id, { role, status }) {
    if (String(id) === String(admin.id)) throw badRequest('Vous ne pouvez pas modifier votre propre rôle ou statut.');
    const target = await userRepo.findById(id);
    if (!target) throw notFound('Utilisateur introuvable.');
    const set = {};
    if (role) set.role = role;
    if (status) set.status = status;
    return toPublicUser(await userRepo.updateById(id, { $set: set }));
  }

  async function adminDelete(admin, id) {
    if (String(id) === String(admin.id)) throw badRequest('Vous ne pouvez pas supprimer votre propre compte.');
    const deleted = await userRepo.deleteById(id);
    if (!deleted) throw notFound('Utilisateur introuvable.');
  }

  return { getProfile, updateProfile, updatePreferences, list, adminUpdate, adminDelete };
}
