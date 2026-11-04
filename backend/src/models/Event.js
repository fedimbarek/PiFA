import mongoose from 'mongoose';
import { ACCESSIBILITY_KEYS, EVENT_STATUS } from '../utils/constants.js';

const { Schema } = mongoose;

const accessibilityShape = Object.fromEntries(ACCESSIBILITY_KEYS.map((k) => [k, { type: Boolean, default: false }]));

const eventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 140 },
    summary: { type: String, trim: true, maxlength: 280, default: '' },
    description: { type: String, required: true, trim: true, minlength: 20, maxlength: 8000 },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    venue: {
      name: { type: String, required: true, trim: true, maxlength: 140 },
      address: { type: String, required: true, trim: true, maxlength: 240 },
      city: { type: String, required: true, trim: true, maxlength: 80 },
      // GeoJSON point [lng, lat] — optional, used by the accessible map.
      location: {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number], default: undefined },
      },
      accessInstructions: { type: String, trim: true, maxlength: 1000, default: '' },
    },
    organizer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    price: { type: Number, min: 0, max: 10000, default: 0 },
    isFree: { type: Boolean, default: true },
    capacity: { type: Number, required: true, min: 1, max: 100000 },
    availableSeats: { type: Number, required: true, min: 0 },
    coverImage: {
      url: { type: String, default: '' },
      alt: { type: String, trim: true, maxlength: 250, default: '' },
    },
    accessibility: accessibilityShape,
    accessibilityNotes: { type: String, trim: true, maxlength: 1500, default: '' },
    language: { type: String, default: 'fr', maxlength: 10 },
    status: { type: String, enum: Object.values(EVENT_STATUS), default: EVENT_STATUS.DRAFT, index: true },
    moderation: {
      reason: { type: String, default: '' },
      moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      moderatedAt: { type: Date },
      submittedAt: { type: Date },
    },
    publishedAt: { type: Date },
    archivedAt: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

eventSchema.virtual('bookedSeats').get(function bookedSeats() {
  return this.capacity - this.availableSeats;
});

eventSchema.pre('validate', function syncDerived(next) {
  this.isFree = !this.price || this.price === 0;
  if (this.endDate && this.startDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'La date de fin doit être postérieure à la date de début.');
  }
  if (this.availableSeats > this.capacity) {
    this.invalidate('availableSeats', 'Les places disponibles ne peuvent dépasser la capacité.');
  }
  if (this.venue?.location && !this.venue.location.coordinates?.length) {
    this.venue.location = undefined;
  }
  next();
});

// Search & listing indexes
eventSchema.index(
  { title: 'text', summary: 'text', description: 'text', 'venue.city': 'text', 'venue.name': 'text' },
  { weights: { title: 10, summary: 5, 'venue.city': 4, 'venue.name': 3, description: 1 }, default_language: 'french', language_override: 'textSearchLanguage', name: 'event_text' },
);
eventSchema.index({ status: 1, startDate: 1 });
eventSchema.index({ status: 1, category: 1, startDate: 1 });
eventSchema.index({ 'venue.city': 1, status: 1 });
eventSchema.index({ 'venue.location': '2dsphere' }, { sparse: true });
eventSchema.index({ organizer: 1, createdAt: -1 });

export const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);
