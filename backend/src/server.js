import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import app from './app.js';
import { User, Event } from './models.js';

await mongoose.connect(process.env.MONGO_URL);
// Seed de démo (premier lancement)
if (!(await User.exists({}))) {
  const hash = await bcrypt.hash('Password123', 10);
  await User.create({ name: 'Admin', email: 'admin@inclusivenue.tn', password: hash, role: 'admin' });
  const org = await User.create({ name: 'Association Tanit', email: 'orga@inclusivenue.tn', password: hash, role: 'organizer' });
  await User.create({ name: 'Sami', email: 'user@inclusivenue.tn', password: hash });
  const d = (n) => new Date(Date.now() + n * 864e5);
  await Event.insertMany([
    { title: 'Atelier théâtre en langue des signes', description: 'Initiation au théâtre visuel, ouverte à toutes et tous.', category: 'atelier', date: d(6), place: 'Maison de la culture, Tunis', free: true, capacity: 20, accessibility: ['signLanguage', 'wheelchair'] },
    { title: 'Concert avec boucle magnétique', description: 'Musique andalouse, salle équipée de boucle à induction.', category: 'spectacle', date: d(12), place: 'Théâtre municipal, Tunis', free: false, price: 15, capacity: 80, accessibility: ['hearingLoop', 'wheelchair', 'adaptedTransport'] },
    { title: 'Exposition tactile : mosaïques de Carthage', description: 'Œuvres à toucher, audiodescription incluse.', category: 'exposition', date: d(20), place: 'Musée de Carthage', free: true, capacity: 40, accessibility: ['audioDescription', 'wheelchair'] }
  ].map((e) => ({ ...e, organizer: org._id, status: 'published' })));
  console.log('Seed OK — admin@ / orga@ / user@inclusivenue.tn, mot de passe Password123');
}
app.listen(process.env.PORT || 4000, () => console.log('API prête'));
