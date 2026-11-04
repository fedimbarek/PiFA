import { z } from 'zod';

/** Client-side schemas (mirroring the API rules) used with React Hook Form. */
const password = z
  .string()
  .min(8, 'Au moins 8 caractères.')
  .regex(/[a-z]/, 'Au moins une minuscule.')
  .regex(/[A-Z]/, 'Au moins une majuscule.')
  .regex(/\d/, 'Au moins un chiffre.');
const email = z.string().trim().min(1, "L'adresse e-mail est obligatoire.").email('Adresse e-mail invalide (exemple : nom@domaine.tn).');

export const loginSchema = z.object({ email, password: z.string().min(1, 'Le mot de passe est obligatoire.') });

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Le nom doit contenir au moins 2 caractères.').max(80),
    email,
    password,
    confirm: z.string(),
    role: z.enum(['user', 'organizer']),
    organizationName: z.string().trim().max(120).optional(),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: "Vous devez accepter les conditions d'utilisation." }) }),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Les deux mots de passe ne correspondent pas.' })
  .refine((v) => v.role !== 'organizer' || (v.organizationName && v.organizationName.length >= 2), {
    path: ['organizationName'],
    message: "Indiquez le nom de votre association ou structure.",
  });

export const forgotSchema = z.object({ email });
export const resetSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Les deux mots de passe ne correspondent pas.' });
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, 'Obligatoire.'), newPassword: password, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Les deux mots de passe ne correspondent pas.' });

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Au moins 2 caractères.').max(80),
  phone: z.string().trim().max(30).regex(/^[+\d\s().-]*$/, 'Numéro invalide.').optional().or(z.literal('')),
  city: z.string().trim().max(80).optional(),
  organizationName: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(600, '600 caractères maximum.').optional(),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Indiquez votre nom.').max(80),
  email,
  subject: z.string().trim().min(3, "Précisez l'objet (3 caractères minimum).").max(140),
  message: z.string().trim().min(10, 'Votre message doit contenir au moins 10 caractères.').max(3000),
});

const optNumber = z.preprocess((v) => (v === '' || v === null || v === undefined || Number.isNaN(v) ? undefined : Number(v)), z.number().optional());

export const eventFormSchema = z
  .object({
    title: z.string().trim().min(3, 'Le titre doit contenir au moins 3 caractères.').max(140),
    summary: z.string().trim().max(280, '280 caractères maximum.').optional(),
    description: z.string().trim().min(20, 'La description doit contenir au moins 20 caractères.').max(8000),
    category: z.string().min(1, 'Choisissez une catégorie.'),
    startDate: z.string().min(1, 'La date de début est obligatoire.'),
    endDate: z.string().min(1, 'La date de fin est obligatoire.'),
    venueName: z.string().trim().min(2, 'Indiquez le nom du lieu.').max(140),
    address: z.string().trim().min(3, "Indiquez l'adresse.").max(240),
    city: z.string().trim().min(2, 'Indiquez la ville.').max(80),
    latitude: optNumber.pipe(z.number().min(-90, 'Latitude invalide.').max(90, 'Latitude invalide.').optional()),
    longitude: optNumber.pipe(z.number().min(-180, 'Longitude invalide.').max(180, 'Longitude invalide.').optional()),
    accessInstructions: z.string().trim().max(1000).optional(),
    price: z.coerce.number({ invalid_type_error: 'Prix invalide.' }).min(0, 'Le prix ne peut pas être négatif.').max(10000),
    capacity: z.coerce.number({ invalid_type_error: 'Capacité invalide.' }).int('Nombre entier attendu.').min(1, 'Au moins 1 place.').max(100000),
    accessibility: z.record(z.boolean()).default({}),
    accessibilityNotes: z.string().trim().max(1500).optional(),
    coverAlt: z.string().trim().max(250).optional(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate > v.startDate, { path: ['endDate'], message: 'La fin doit être après le début.' })
  .refine((v) => (v.latitude === undefined) === (v.longitude === undefined), { path: ['longitude'], message: 'Renseignez la latitude et la longitude, ou aucune des deux.' });
