import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const id = { type: Schema.Types.ObjectId };

export const User = model('User', new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'organizer', 'admin'], default: 'user' },
  prefs: { fontSize: { type: Number, default: 100 }, contrast: { type: Boolean, default: false }, deafMode: { type: Boolean, default: false } }
}, { timestamps: true }));

export const A11Y = ['signLanguage', 'hearingLoop', 'wheelchair', 'audioDescription', 'adaptedTransport'];
const eventSchema = new Schema({
  title: { type: String, required: true }, description: String,
  category: { type: String, enum: ['atelier', 'spectacle', 'conference', 'exposition'], default: 'atelier' },
  date: { type: Date, required: true, index: true }, place: String,
  free: { type: Boolean, default: true }, price: { type: Number, default: 0 },
  capacity: { type: Number, required: true, min: 1 }, booked: { type: Number, default: 0 },
  accessibility: [{ type: String, enum: A11Y }],
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
  organizer: { ...id, ref: 'User', index: true }
}, { timestamps: true });
eventSchema.index({ title: 'text', description: 'text' });
export const Event = model('Event', eventSchema);

export const Booking = model('Booking', new Schema({
  user: { ...id, ref: 'User', index: true }, event: { ...id, ref: 'Event' },
  seats: { type: Number, default: 1, min: 1, max: 4 }, status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' }
}, { timestamps: true }));
