import { z } from 'zod';
import { ACCESSIBILITY_KEYS, EVENT_STATUS, SELF_REGISTER_ROLES, ROLES } from '../utils/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identifiant invalide.');
const trimmed = (min, max, label) =>
  z
    .string({ required_error: `${label} est obligatoire.` })
    .trim()
    .min(min, `${label} doit contenir au moins ${min} caractères.`)
    .max(max, `${label} ne doit pas dépasser ${max} caractères.`);
const optionalText = (max) => z.string().trim().max(max).optional();
const boolish = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]);

export const passwordSchema = z
  .string({ required_error: 'Le mot de passe est obligatoire.' })
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
  .max(128, 'Le mot de passe ne doit pas dépasser 128 caractères.')
  .regex(/[a-z]/, 'Le mot de passe doit contenir une minuscule.')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir une majuscule.')
  .regex(/\d/, 'Le mot de passe doit contenir un chiffre.');

const email = z.string({ required_error: "L'adresse e-mail est obligatoire." }).trim().toLowerCase().email('Adresse e-mail invalide.').max(160);

export const idParams = z.object({ id: objectId });

// ---------- Auth ----------
export const registerSchema = z
  .object({
    name: trimmed(2, 80, 'Le nom'),
    email,
    password: passwordSchema,
    // "admin" is deliberately not accepted here.
    role: z.enum(SELF_REGISTER_ROLES, { errorMap: () => ({ message: 'Rôle invalide.' }) }).default(ROLES.USER),
    organizationName: optionalText(120),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: "Vous devez accepter les conditions d'utilisation." }) }),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.role === ROLES.ORGANIZER && !v.organizationName) {
      ctx.addIssue({ code: 'custom', path: ['organizationName'], message: "Le nom de l'association est obligatoire pour un organisateur." });
    }
  });

export const loginSchema = z.object({ email, password: z.string().min(1, 'Le mot de passe est obligatoire.').max(128) }).strict();
export const forgotPasswordSchema = z.object({ email }).strict();
export const resetPasswordSchema = z.object({ token: z.string().regex(/^[a-f\d]{64}$/i, 'Lien invalide.'), password: passwordSchema }).strict();
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema })
  .strict();

// ---------- Users ----------
export const profileSchema = z
  .object({
    name: trimmed(2, 80, 'Le nom').optional(),
    phone: z.string().trim().max(30).regex(/^[+\d\s().-]*$/, 'Numéro de téléphone invalide.').optional(),
    city: optionalText(80),
    organizationName: optionalText(120),
    bio: optionalText(600),
  })
  .strict();

export const preferencesSchema = z
  .object({
    fontScale: z.union([z.literal(100), z.literal(112), z.literal(125), z.literal(150), z.literal(175), z.literal(200)]),
    highContrast: z.boolean(),
    reducedMotion: z.boolean(),
    screenReaderMode: z.boolean(),
    dyslexiaFont: z.boolean(),
    underlineLinks: z.boolean(),
    hearingMode: z.boolean(),
    preferredFeatures: z.array(z.enum(ACCESSIBILITY_KEYS)).max(ACCESSIBILITY_KEYS.length),
    emailNotifications: z.boolean(),
    otherNeeds: z.string().trim().max(500),
  })
  .partial()
  .strict();

export const adminUserQuery = z.object({
  q: z.string().trim().max(80).optional(),
  role: z.enum(Object.values(ROLES)).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const adminUserUpdate = z
  .object({ role: z.enum(Object.values(ROLES)).optional(), status: z.enum(['active', 'suspended']).optional() })
  .strict()
  .refine((v) => v.role || v.status, 'Aucune modification fournie.');

// ---------- Categories & settings ----------
export const categorySchema = z
  .object({
    name: trimmed(2, 60, 'Le nom'),
    description: optionalText(300),
    active: z.boolean().optional(),
  })
  .strict();
export const categoryUpdateSchema = categorySchema.partial();

export const settingsSchema = z
  .object({
    requireModeration: z.boolean(),
    maxSeatsPerBooking: z.number().int().min(1).max(10),
    cancellationDeadlineHours: z.number().int().min(0).max(168),
    allowOrganizerSignup: z.boolean(),
    maintenanceMessage: z.string().trim().max(300),
  })
  .partial()
  .strict();

// ---------- Events ----------
const accessibilitySchema = z.object(Object.fromEntries(ACCESSIBILITY_KEYS.map((k) => [k, z.boolean().optional()]))).strict();

const eventBase = z.object({
  title: trimmed(3, 140, 'Le titre'),
  summary: optionalText(280),
  description: trimmed(20, 8000, 'La description'),
  category: objectId,
  startDate: z.coerce.date({ errorMap: () => ({ message: 'Date de début invalide.' }) }),
  endDate: z.coerce.date({ errorMap: () => ({ message: 'Date de fin invalide.' }) }),
  venue: z
    .object({
      name: trimmed(2, 140, 'Le nom du lieu'),
      address: trimmed(3, 240, "L'adresse"),
      city: trimmed(2, 80, 'La ville'),
      latitude: z.number().min(-90).max(90).optional().nullable(),
      longitude: z.number().min(-180).max(180).optional().nullable(),
      accessInstructions: optionalText(1000),
    })
    .strict(),
  price: z.number().min(0, 'Le prix ne peut pas être négatif.').max(10000).default(0),
  capacity: z.number().int('La capacité doit être un nombre entier.').min(1, 'La capacité doit être au moins 1.').max(100000),
  accessibility: accessibilitySchema.default({}),
  accessibilityNotes: optionalText(1500),
  coverAlt: optionalText(250),
  language: z.string().max(10).optional(),
});

const dateOrder = (v, ctx) => {
  if (v.startDate && v.endDate && v.endDate <= v.startDate) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'La date de fin doit être après la date de début.' });
  }
};

export const createEventSchema = eventBase
  .strict()
  .superRefine(dateOrder)
  .superRefine((v, ctx) => {
    if (v.startDate && v.startDate.getTime() < Date.now() - 60_000) {
      ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'La date de début doit être dans le futur.' });
    }
  });

export const updateEventSchema = eventBase.partial().strict().superRefine(dateOrder);

export const rejectSchema = z.object({ reason: trimmed(5, 500, 'Le motif') }).strict();

export const eventQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.union([objectId, z.string().regex(/^[a-z0-9-]{2,60}$/)]).optional(),
  city: z.string().trim().max(80).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  free: z.enum(['true', 'false']).optional(),
  // Comma-separated accessibility keys: all must be present.
  features: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []))
    .pipe(z.array(z.enum(ACCESSIBILITY_KEYS))),
  available: z.enum(['true', 'false']).optional(),
  sort: z.enum(['date', '-date', 'price', '-price', 'recent', 'relevance']).default('date'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  includePast: z.enum(['true', 'false']).optional(),
});

export const adminEventQuery = z.object({
  status: z.enum(Object.values(EVENT_STATUS)).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------- Bookings ----------
export const createBookingSchema = z
  .object({
    eventId: objectId,
    seats: z.number().int().min(1, 'Au moins une place.').max(10),
    accessibilityNeeds: z.array(z.enum(ACCESSIBILITY_KEYS)).max(ACCESSIBILITY_KEYS.length).default([]),
    note: optionalText(500),
  })
  .strict();

export const checkInSchema = z.object({ checkedIn: z.boolean() }).strict();

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().max(20).optional(),
  unread: z.enum(['true', 'false']).optional(),
});

// ---------- Contact ----------
export const contactSchema = z
  .object({
    name: trimmed(2, 80, 'Le nom'),
    email,
    subject: trimmed(3, 140, "L'objet"),
    message: trimmed(10, 3000, 'Le message'),
  })
  .strict();

export { boolish };
