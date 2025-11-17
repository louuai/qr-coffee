import path from 'path';
import fs from 'fs/promises';
// use require to avoid missing type declarations in this environment
const QRCode: any = require('qrcode');
import dotenv from 'dotenv';
dotenv.config();

const QR_OUTPUT_DIR = process.env.QR_OUTPUT_DIR || './public/qrcodes';
const PUBLIC_MENU_BASE = (
  process.env.PUBLIC_MENU_BASE_URL ||
  process.env.HOST_BASE_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

export function buildMenuUrl(slug: string, tableNumber: number) {
  return `${PUBLIC_MENU_BASE}/menu/${slug}?table=${tableNumber}`;
}

export async function ensureOutputDir() {
  // Write inside the running app directory so Express static can serve it
  // process.cwd() in container is /usr/src/app
  const dir = path.resolve(process.cwd(), QR_OUTPUT_DIR.replace(/^\.\//, ''));
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function generateTableQr(
  hotelId: number,
  hotelSlug: string,
  tableNumber: number
) {
  const dir = await ensureOutputDir();
  const url = buildMenuUrl(hotelSlug, tableNumber);
  const filename = `${hotelId}-table-${tableNumber}.png`;
  const outPath = path.join(dir, filename);
  await QRCode.toFile(outPath, url, { type: 'png', margin: 1, width: 300 });
  return {
    path: `/public/qrcodes/${filename}`,
    targetUrl: url,
  };
}
