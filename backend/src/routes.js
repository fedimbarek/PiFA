import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, Event, Booking } from './models.js';
import { auth, sign, wrap } from './auth.js';
const r = Router();
const pub = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, prefs: u.prefs });

// ---- Auth & profil ----
r.post('/auth/register', wrap(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || password.length < 8) return res.status(400).json({ error: 'Nom, email et mot de passe (8 caractères minimum) sont requis.' });
  if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ error: 'Cet email est déjà utilisé.' });
  const u = await User.create({ name, email, password: await bcrypt.hash(password, 10), role: role === 'organizer' ? 'organizer' : 'user' });
  res.status(201).json({ token: sign(u), user: pub(u) });
}));
r.post('/auth/login', wrap(async (req, res) => {
  const u = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password))) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  res.json({ token: sign(u), user: pub(u) });
}));
r.put('/me/prefs', auth(), wrap(async (req, res) => {
  const u = await User.findByIdAndUpdate(req.user.id, { prefs: req.body }, { new: true });
  res.json(pub(u));
}));

// ---- Événements : recherche, filtres, tri, pagination ----
r.get('/events', wrap(async (req, res) => {
  const { q, accessibility, free, from, sort = 'date', page = 1, limit = 9 } = req.query;
  const f = { status: 'published' };
  if (q) f.$text = { $search: q };
  if (accessibility) f.accessibility = { $all: accessibility.split(',') };
  if (free === 'true') f.free = true;
  if (from) f.date = { $gte: new Date(from) };
  const [items, total] = await Promise.all([
    Event.find(f).sort(sort === 'date' ? { date: 1 } : { createdAt: -1 }).skip((page - 1) * limit).limit(+limit).lean(),
    Event.countDocuments(f)]);
  res.json({ items, total, pages: Math.ceil(total / limit) });
}));
r.get('/events/:id', wrap(async (req, res) => {
  const e = await Event.findById(req.params.id).lean();
  e ? res.json(e) : res.status(404).json({ error: 'Événement introuvable.' });
}));
r.post('/events', auth(['organizer', 'admin']), wrap(async (req, res) => {
  const e = await Event.create({ ...req.body, organizer: req.user.id, status: 'draft', booked: 0 });
  res.status(201).json(e);
}));
r.put('/events/:id', auth(['organizer', 'admin']), wrap(async (req, res) => {
  const f = { _id: req.params.id, ...(req.user.role === 'admin' ? {} : { organizer: req.user.id }) };
  const { booked, organizer, ...data } = req.body;
  const e = await Event.findOneAndUpdate(f, data, { new: true });
  e ? res.json(e) : res.status(404).json({ error: 'Événement introuvable.' });
}));
// publication / archivage (organisateur) ; modération (admin sur tous)
r.patch('/events/:id/status', auth(['organizer', 'admin']), wrap(async (req, res) => {
  if (!['draft', 'published', 'archived'].includes(req.body.status)) return res.status(400).json({ error: 'Statut invalide.' });
  const f = { _id: req.params.id, ...(req.user.role === 'admin' ? {} : { organizer: req.user.id }) };
  const e = await Event.findOneAndUpdate(f, { status: req.body.status }, { new: true });
  e ? res.json(e) : res.status(404).json({ error: 'Événement introuvable.' });
}));

// ---- Réservation avec quota atomique ----
r.post('/events/:id/book', auth(), wrap(async (req, res) => {
  const seats = Math.min(Math.max(+req.body.seats || 1, 1), 4);
  const e = await Event.findOneAndUpdate(
    { _id: req.params.id, status: 'published', $expr: { $lte: [{ $add: ['$booked', seats] }, '$capacity'] } },
    { $inc: { booked: seats } }, { new: true });
  if (!e) return res.status(409).json({ error: 'Plus assez de places disponibles pour cet événement.' });
  const b = await Booking.create({ user: req.user.id, event: e._id, seats });
  res.status(201).json(b); // TODO notification : email de confirmation (nodemailer)
}));
r.get('/bookings/mine', auth(), wrap(async (req, res) =>
  res.json(await Booking.find({ user: req.user.id }).populate('event').sort('-createdAt').lean())));
r.delete('/bookings/:id', auth(), wrap(async (req, res) => {
  const b = await Booking.findOneAndUpdate({ _id: req.params.id, user: req.user.id, status: 'confirmed' }, { status: 'cancelled' });
  if (!b) return res.status(404).json({ error: 'Réservation introuvable.' });
  await Event.updateOne({ _id: b.event }, { $inc: { booked: -b.seats } });
  res.status(204).end();
}));
// Fonctionnalité différenciante : export iCal
r.get('/bookings/mine/calendar.ics', auth(), wrap(async (req, res) => {
  const bs = await Booking.find({ user: req.user.id, status: 'confirmed' }).populate('event').lean();
  const d = (x) => new Date(x).toISOString().replace(/[-:]|\.\d{3}/g, '');
  const ev = bs.map((b) => `BEGIN:VEVENT\r\nUID:${b._id}@inclusivenue\r\nDTSTAMP:${d(Date.now())}\r\nDTSTART:${d(b.event.date)}\r\nDTEND:${d(+new Date(b.event.date) + 7200000)}\r\nSUMMARY:${b.event.title}\r\nLOCATION:${b.event.place || ''}\r\nEND:VEVENT`);
  res.type('text/calendar').send(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//InclusiVenue//FR\r\n${ev.join('\r\n')}\r\nEND:VCALENDAR`);
}));

// ---- Espace organisateur & admin ----
r.get('/organizer/events', auth(['organizer', 'admin']), wrap(async (req, res) =>
  res.json(await Event.find({ organizer: req.user.id }).sort('-createdAt').lean())));
r.get('/admin/stats', auth(['admin']), wrap(async (req, res) => {
  const [users, events, bookings] = await Promise.all([User.countDocuments(), Event.countDocuments(), Booking.countDocuments({ status: 'confirmed' })]);
  res.json({ users, events, bookings, pending: await Event.countDocuments({ status: 'draft' }) });
}));
r.get('/admin/events', auth(['admin']), wrap(async (req, res) =>
  res.json(await Event.find().sort('-createdAt').populate('organizer', 'name').lean())));
r.get('/admin/users', auth(['admin']), wrap(async (req, res) =>
  res.json(await User.find().select('name email role').lean())));
r.delete('/admin/users/:id', auth(['admin']), wrap(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });
  await User.findByIdAndDelete(req.params.id);
  res.status(204).end();
}));
export default r;
