import mongoose from 'mongoose';
import { NOTIFICATION_TYPES } from '../utils/constants.js';

const { Schema } = mongoose;

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 160 },
    message: { type: String, required: true, maxlength: 1000 },
    link: { type: String, default: '' },
    read: { type: Boolean, default: false },
    readAt: { type: Date },
    // "sent" (SMTP accepted), "logged" (dev outbox, NOT sent), "disabled" (user opted out), "failed", "none"
    emailStatus: { type: String, enum: ['none', 'sent', 'logged', 'disabled', 'failed'], default: 'none' },
  },
  { timestamps: true },
);
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

/** Single-document platform settings (key "platform"). */
const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'platform' },
    requireModeration: { type: Boolean, default: true },
    maxSeatsPerBooking: { type: Number, min: 1, max: 10, default: 4 },
    cancellationDeadlineHours: { type: Number, min: 0, max: 168, default: 2 },
    allowOrganizerSignup: { type: Boolean, default: true },
    maintenanceMessage: { type: String, maxlength: 300, default: '' },
  },
  { timestamps: true },
);
export const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);

const contactSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 80 },
    email: { type: String, required: true, maxlength: 160 },
    subject: { type: String, required: true, maxlength: 140 },
    message: { type: String, required: true, maxlength: 3000 },
    handled: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const ContactMessage = mongoose.models.ContactMessage || mongoose.model('ContactMessage', contactSchema);

/** Record of every outgoing email; in MAIL_MODE=log this is the development outbox. */
const emailLogSchema = new Schema(
  {
    to: { type: String, required: true },
    subject: { type: String, required: true },
    text: { type: String, required: true },
    mode: { type: String, enum: ['smtp', 'log'], required: true },
    status: { type: String, enum: ['sent', 'logged', 'failed'], required: true },
    error: { type: String, default: '' },
  },
  { timestamps: true },
);
emailLogSchema.index({ createdAt: -1 });
emailLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
export const EmailLog = mongoose.models.EmailLog || mongoose.model('EmailLog', emailLogSchema);
