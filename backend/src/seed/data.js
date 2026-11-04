/**
 * Demo dataset (pure data + cover generation) shared by the seed script.
 * No database access here.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { ACCESSIBILITY_KEYS } from '../utils/constants.js';

export const DEMO_PASSWORD = 'Password123';

export const CATEGORIES = [
  ['Atelier', 'Ateliers pratiques et créatifs'],
  ['Spectacle', 'Théâtre, danse, cirque et arts vivants'],
  ['Conférence', 'Conférences, tables rondes et rencontres'],
  ['Exposition', 'Expositions, musées et visites guidées'],
  ['Concert', 'Musique live'],
  ['Cinéma', 'Projections et ciné-débats'],
  ['Activité communautaire', 'Sorties, rencontres et actions associatives'],
];

const day = 24 * 3600 * 1000;
export const at = (daysFromNow, hour, minute = 0) => {
  const d = new Date(Date.now() + daysFromNow * day);
  d.setUTCHours(hour - 1, minute, 0, 0); // Tunis = UTC+1
  return d;
};
export const feats = (...keys) => Object.fromEntries(ACCESSIBILITY_KEYS.map((k) => [k, keys.includes(k)]));

export const VENUES = {
  theatre: { name: 'Théâtre municipal de Tunis', address: 'Avenue Habib Bourguiba', city: 'Tunis', lat: 36.7999, lng: 10.1817, access: 'Entrée accessible par la rue de Grèce, ascenseur jusqu’au balcon. Places PMR au rang A.' },
  cite: { name: 'Cité de la Culture', address: 'Avenue Mohamed V', city: 'Tunis', lat: 36.8125, lng: 10.1793, access: 'Parking PMR au niveau -1, ascenseurs dans le hall principal, bandes podotactiles.' },
  bardo: { name: 'Musée national du Bardo', address: 'Rue Mongi Slim, Le Bardo', city: 'Tunis', lat: 36.8093, lng: 10.1343, access: 'Rampe à l’entrée est, fauteuils roulants prêtés à l’accueil.' },
  sfax: { name: 'Centre culturel Dar El Djazira', address: 'Route de la Médina', city: 'Sfax', lat: 34.7398, lng: 10.7600, access: 'Plain-pied, sanitaires adaptés au rez-de-chaussée.' },
  sousse: { name: 'Maison de la Culture de Sousse', address: 'Boulevard Hassouna Ayachi', city: 'Sousse', lat: 35.8256, lng: 10.6411, access: 'Rampe d’accès, boucle magnétique en salle principale.' },
  bizerte: { name: 'Médiathèque de Bizerte', address: 'Quai Khémais Ternane', city: 'Bizerte', lat: 37.2744, lng: 9.8739, access: 'Accès par l’ascenseur côté quai.' },
  nabeul: { name: 'Espace Néapolis', address: 'Avenue Habib Thameur', city: 'Nabeul', lat: 36.4561, lng: 10.7376, access: 'Accès de plain-pied, espace calme disponible sur demande.' },
  carthage: { name: 'Acropolium de Carthage', address: 'Colline de Byrsa, Carthage', city: 'Carthage', lat: 36.8526, lng: 10.3230, access: 'Navette adaptée depuis la gare TGM Carthage-Hannibal sur réservation.' },
};

export const EVENTS = [
  ['Atelier de calligraphie arabe pour tous', 'Atelier', 'cite', 6, 10, 3, 0, 18, ['wheelchair', 'easyRead', 'accessibleToilets', 'quietSpace'], 'Découvrez les gestes de la calligraphie arabe avec un maître calligraphe. Matériel adapté (calames ergonomiques, supports inclinés) fourni.'],
  ['Spectacle « Les voix du silence » surtitré et signé', 'Spectacle', 'theatre', 9, 19, 2, 15, 120, ['wheelchair', 'signLanguage', 'subtitles', 'hearingLoop', 'reservedSeating'], 'Une création théâtrale bilingue arabe/français, intégralement interprétée en langue des signes tunisienne et surtitrée en français.'],
  ['Visite audiodécrite des mosaïques du Bardo', 'Exposition', 'bardo', 12, 10, 2, 0, 15, ['wheelchair', 'audioDescription', 'braille', 'assistanceDogs'], 'Visite guidée multisensorielle : audiodescription détaillée, reproductions tactiles de mosaïques et livret en braille.'],
  ['Conférence : villes inclusives et mobilité', 'Conférence', 'cite', 15, 14, 3, 0, 200, ['wheelchair', 'signLanguage', 'hearingLoop', 'subtitles', 'adaptedTransport'], 'Urbanistes, associations et usagers débattent de l’accessibilité des transports et de l’espace public en Tunisie.'],
  ['Concert acoustique malouf', 'Concert', 'sousse', 18, 20, 2, 10, 80, ['wheelchair', 'hearingLoop', 'reservedSeating'], 'Un ensemble de malouf revisite le répertoire andalou dans une salle équipée de boucle magnétique.'],
  ['Ciné-débat audiodécrit : « Le Challat de Tunis »', 'Cinéma', 'bizerte', 8, 18, 3, 0, 60, ['audioDescription', 'subtitles', 'wheelchair'], 'Projection en version audiodécrite et sous-titrée pour sourds et malentendants, suivie d’un échange avec l’équipe.'],
  ['Balade sensorielle dans la médina', 'Activité communautaire', 'sfax', 5, 9, 3, 0, 12, ['adaptedTransport', 'audioDescription', 'assistanceDogs'], 'Une balade guidée à travers les sons, odeurs et textures de la médina de Sfax. Navette adaptée au départ de la gare.'],
  ['Atelier poterie en espace calme', 'Atelier', 'nabeul', 20, 15, 2, 25, 10, ['wheelchair', 'quietSpace', 'easyRead', 'accessibleToilets'], 'Atelier de poterie de Nabeul en petit groupe, rythme adapté, consignes en FALC. Idéal pour les personnes avec troubles cognitifs.'],
  ['Exposition « Regards tactiles »', 'Exposition', 'carthage', 25, 11, 6, 0, 40, ['wheelchair', 'braille', 'audioDescription', 'adaptedTransport', 'assistanceDogs'], 'Une exposition de sculptures contemporaines à toucher, accompagnée de cartels en braille et d’un audioguide.'],
  ['Atelier d’initiation à la langue des signes', 'Atelier', 'cite', 4, 17, 2, 0, 20, ['signLanguage', 'wheelchair', 'subtitles'], 'Apprenez les bases de la langue des signes tunisienne avec des formateurs sourds. Aucun prérequis.'],
  ['Danse inclusive : performance et atelier', 'Spectacle', 'sousse', 30, 18, 3, 15, 50, ['wheelchair', 'reservedSeating', 'quietSpace'], 'Une compagnie de danseurs valides et en fauteuil présente sa création, suivie d’un atelier ouvert à tous.'],
  ['Rencontre : emploi et handicap', 'Conférence', 'sfax', 11, 9, 4, 0, 90, ['wheelchair', 'signLanguage', 'hearingLoop', 'easyRead'], 'Employeurs, associations et chercheurs d’emploi se rencontrent autour de l’insertion professionnelle.'],
];

/** Generate a simple, compressed cover image (WebP) with sharp — no external download. */
export async function makeCover(dir, title, category, index) {
  const palettes = [
    ['#0B1F3A', '#1D4ED8'],
    ['#102A43', '#2563EB'],
    ['#0F2747', '#1E40AF'],
    ['#132B50', '#3B5BDB'],
  ];
  const [a, b] = palettes[index % palettes.length];
  const safe = (s) => s.replace(/[<>&"]/g, '');
  const words = safe(title).split(' ');
  const lines = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + w).length <= 26) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  const text = lines
    .slice(0, 3)
    .map((l, i) => `<text x="64" y="${470 + i * 62}" font-family="Arial, sans-serif" font-size="52" font-weight="700" fill="#FFFFFF">${l}</text>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="1200" height="675" fill="url(#g)"/>
    <circle cx="1040" cy="120" r="220" fill="#E3B341" opacity="0.18"/>
    <circle cx="1120" cy="560" r="140" fill="#FFFFFF" opacity="0.06"/>
    <rect x="64" y="340" width="${safe(category).length * 19 + 48}" height="56" rx="28" fill="#E3B341"/>
    <text x="88" y="378" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#0B1F3A">${safe(category)}</text>
    ${text}
  </svg>`;
  const { default: sharp } = await import('sharp');
  await fs.mkdir(dir, { recursive: true });
  const file = `seed-${index + 1}.webp`;
  await sharp(Buffer.from(svg)).webp({ quality: 74 }).toFile(path.join(dir, file));
  return `/uploads/${file}`;
}

