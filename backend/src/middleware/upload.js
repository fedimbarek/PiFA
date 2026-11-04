import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';
import { badRequest } from '../utils/errors.js';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/** Check the real file signature, not only the client-provided MIME type. */
export function sniffImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

export function createUploader({ maxMb }) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED.includes(file.mimetype)) return cb(badRequest('Formats acceptés : JPEG, PNG ou WebP.'));
      cb(null, true);
    },
  }).single('image');
}

/**
 * Verify, resize (max 1600px) and re-encode to WebP. Re-encoding strips metadata
 * (EXIF/GPS) and any payload hidden in the original file, and compresses the image.
 */
export async function processAndStoreImage(file, uploadDir) {
  if (!file) throw badRequest('Aucune image reçue.');
  if (!sniffImageType(file.buffer)) throw badRequest("Le fichier n'est pas une image valide.");
  await fs.mkdir(uploadDir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const base = sharp(file.buffer, { failOn: 'error' }).rotate();
  await base.clone().resize({ width: 1600, height: 1000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(uploadDir, `${name}.webp`));
  await base.clone().resize({ width: 640, height: 400, fit: 'cover' }).webp({ quality: 72 }).toFile(path.join(uploadDir, `${name}-sm.webp`));
  return { url: `/uploads/${name}.webp`, thumbUrl: `/uploads/${name}-sm.webp` };
}
