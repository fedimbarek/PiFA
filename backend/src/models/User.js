import mongoose from 'mongoose';
import { ROLES } from '../utils/constants.js';

const { Schema } = mongoose;

export const defaultPreferences = () => ({
  fontScale: 100,
  highContrast: false,
  reducedMotion: false,
  screenReaderMode: false,
  dyslexiaFont: false,
  underlineLinks: false,
  hearingMode: false,
  preferredFeatures: [],
  emailNotifications: true,
  otherNeeds: '',
});

const preferencesSchema = new Schema(
  {
    fontScale: { type: Number, enum: [100, 112, 125, 150, 175, 200], default: 100 },
    highContrast: { type: Boolean, default: false },
    reducedMotion: { type: Boolean, default: false },
    screenReaderMode: { type: Boolean, default: false },
    dyslexiaFont: { type: Boolean, default: false },
    underlineLinks: { type: Boolean, default: false },
    // Deaf / hard-of-hearing: visual alerts, prioritise sign language & subtitles.
    hearingMode: { type: Boolean, default: false },
    preferredFeatures: [{ type: String }],
    emailNotifications: { type: Boolean, default: true },
    otherNeeds: { type: String, maxlength: 500, default: '' },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.USER, index: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
    phone: { type: String, trim: true, maxlength: 30, default: '' },
    city: { type: String, trim: true, maxlength: 80, default: '' },
    organizationName: { type: String, trim: true, maxlength: 120, default: '' },
    bio: { type: String, trim: true, maxlength: 600, default: '' },
    preferences: { type: preferencesSchema, default: defaultPreferences },
    passwordReset: {
      tokenHash: { type: String, select: false },
      expiresAt: { type: Date, select: false },
    },
    passwordChangedAt: { type: Date },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.index({ name: 'text', email: 'text', organizationName: 'text' });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
