import { badRequest, conflict, notFound } from '../utils/errors.js';

export const slugify = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);

/** Platform settings with a short in-memory cache. */
export function createSettingsService({ settingRepo, ttlMs = 30_000, clock = () => Date.now() }) {
  let cache = null;
  let cachedAt = 0;
  async function get() {
    if (cache && clock() - cachedAt < ttlMs) return cache;
    cache = await settingRepo.get();
    cachedAt = clock();
    return cache;
  }
  async function update(data) {
    cache = await settingRepo.update(data);
    cachedAt = clock();
    return cache;
  }
  return { get, update };
}

export function createCategoryService({ categoryRepo }) {
  return {
    list: (opts) => categoryRepo.list(opts),
    async create(data) {
      try {
        return await categoryRepo.create({ ...data, slug: slugify(data.name) });
      } catch (e) {
        if (e?.code === 11000) throw conflict('Cette catégorie existe déjà.');
        throw e;
      }
    },
    async update(id, data) {
      const patch = { ...data };
      if (data.name) patch.slug = slugify(data.name);
      const c = await categoryRepo.updateById(id, patch);
      if (!c) throw notFound('Catégorie introuvable.');
      return c;
    },
    async remove(id) {
      if ((await categoryRepo.countEvents(id)) > 0) {
        throw badRequest('Cette catégorie est utilisée par des événements : désactivez-la plutôt que de la supprimer.');
      }
      const c = await categoryRepo.deleteById(id);
      if (!c) throw notFound('Catégorie introuvable.');
    },
  };
}

export function createContactService({ contactRepo, notificationService }) {
  return {
    async submit(data) {
      const msg = await contactRepo.create(data);
      await notificationService.notifyAdmins(
        {
          type: 'contact_message',
          title: 'Nouveau message de contact',
          message: `${data.name} (${data.email}) : « ${data.subject} »`,
          link: '/admin',
        },
        { email: true },
      );
      return { id: msg._id, message: 'Merci, votre message a bien été transmis à l’équipe InclusiVenue.' };
    },
    list: () => contactRepo.list(),
    markHandled: (id) => contactRepo.markHandled(id),
  };
}
