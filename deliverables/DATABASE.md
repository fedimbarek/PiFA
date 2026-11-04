# Modèle de données — MongoDB / Mongoose

Diagramme : `diagrams/database.svg`. Sources : `backend/src/models/`.

## Collections

### users
| Champ | Type | Règles |
|---|---|---|
| name | String | requis, 2–80 |
| email | String | requis, **unique**, minuscules |
| passwordHash | String | bcrypt, `select: false` (jamais renvoyé) |
| role | `user` \| `organizer` \| `admin` | défaut `user` ; `admin` impossible à l'inscription |
| status | `active` \| `suspended` | |
| phone, city, organizationName, bio | String | longueurs bornées |
| preferences | sous-document | `fontScale` (100/112/125/150/175/200), `highContrast`, `reducedMotion`, `screenReaderMode`, `dyslexiaFont`, `underlineLinks`, `hearingMode`, `preferredFeatures[]`, `emailNotifications`, `otherNeeds` |
| passwordReset | {tokenHash, expiresAt} | SHA-256 du jeton, `select: false` |
| passwordChangedAt, lastLoginAt | Date | invalidation des anciens jetons |

Index : `email` unique, `role`, `status`, texte (name, email, organizationName).

### events
| Champ | Type | Règles |
|---|---|---|
| title, summary, description | String | 3–140 / ≤280 / 20–8000 |
| category | ObjectId → categories | requis |
| organizer | ObjectId → users | requis |
| startDate, endDate | Date | fin > début |
| venue | {name, address, city, location GeoJSON Point [lng, lat], accessInstructions} | |
| price, isFree | Number, Boolean | `isFree` dérivé du prix |
| capacity, availableSeats | Number | `0 ≤ availableSeats ≤ capacity` ; décrément atomique |
| coverImage | {url, alt} | |
| accessibility | 12 booléens | wheelchair, signLanguage, hearingLoop, audioDescription, adaptedTransport, accessibleToilets, subtitles, easyRead, braille, quietSpace, assistanceDogs, reservedSeating |
| accessibilityNotes | String | |
| status | draft \| pending \| published \| rejected \| archived | |
| moderation | {reason, moderatedBy, moderatedAt, submittedAt} | |
| publishedAt, archivedAt | Date | |

Index : texte pondéré (titre 10, résumé 5, ville 4, lieu 3, description 1 ; langue française), `{status, startDate}`, `{status, category, startDate}`, `{venue.city, status}`, `2dsphere(venue.location)`, `{organizer, createdAt}`.

### bookings
| Champ | Type | Règles |
|---|---|---|
| user, event | ObjectId | requis |
| seats | Number | 1–10 (plafond plateforme 4 par défaut) |
| status | confirmed \| cancelled | |
| reference | String | **unique** (`IV-XXXXXXXX`) |
| accessibilityNeeds | [String] | besoins signalés à l'organisateur |
| note, unitPrice | | |
| checkedIn, checkedInAt | | pointage de présence |
| cancelledAt, cancelledBy | | user / organizer / admin / system |
| reminderSentAt | Date | rappel J-1 envoyé une seule fois |

Index : **unique partiel `(user, event)` où `status = confirmed`** (anti-doublon concurrent), `{event, status}`, `{status, reminderSentAt}`, `user`.

### categories — `name` et `slug` uniques, `active`.
### notifications — `user`, `type`, `title`, `message`, `link`, `read`, `emailStatus` (none / sent / logged / disabled / failed). Index `{user, read, createdAt}`.
### settings — document unique `key: "platform"` : `requireModeration`, `maxSeatsPerBooking`, `cancellationDeadlineHours`, `allowOrganizerSignup`, `maintenanceMessage`.
### contactmessages — messages du formulaire de contact (`handled`).
### emaillogs — journal des e-mails (`mode`, `status` sent / logged / failed) ; **expiration automatique (TTL) après 30 jours**.

## Invariants garantis

- `availableSeats` ne devient jamais négatif ni supérieur à `capacity` (filtres conditionnels dans `reserveSeats`, `releaseSeats`, `updateCapacity`).
- Une seule réservation confirmée par utilisateur et par événement (index unique partiel).
- Une réservation ne passe qu'une fois de `confirmed` à `cancelled` (mise à jour conditionnelle), donc les places ne sont restituées qu'une fois.
