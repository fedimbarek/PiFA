import mongoose from 'mongoose';
import { BOOKING_STATUS } from '../utils/constants.js';

const { Schema } = mongoose;

const bookingSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    event: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    seats: { type: Number, required: true, min: 1, max: 10 },
    status: { type: String, enum: Object.values(BOOKING_STATUS), default: BOOKING_STATUS.CONFIRMED, index: true },
    reference: { type: String, required: true, unique: true },
    accessibilityNeeds: [{ type: String }],
    note: { type: String, trim: true, maxlength: 500, default: '' },
    unitPrice: { type: Number, default: 0 },
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date },
    cancelledAt: { type: Date },
    cancelledBy: { type: String, enum: ['user', 'organizer', 'admin', 'system', null], default: null },
    reminderSentAt: { type: Date },
  },
  { timestamps: true },
);

// One active (confirmed) booking per user and event — enforced by the database,
// so concurrent duplicate requests cannot both succeed.
bookingSchema.index(
  { user: 1, event: 1 },
  { unique: true, partialFilterExpression: { status: BOOKING_STATUS.CONFIRMED }, name: 'uniq_active_booking' },
);
bookingSchema.index({ event: 1, status: 1 });
bookingSchema.index({ status: 1, reminderSentAt: 1 });

export const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
