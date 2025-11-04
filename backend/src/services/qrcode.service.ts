import path from 'path';
import fs from 'fs/promises';
import QRCode from 'qrcode';
import dotenv from 'dotenv';
dotenv.config();

const QR_OUTPUT_DIR = process.env.QR_OUTPUT_DIR || './public/qrcodes';

export async function ensureOutputDir() {
  const dir = path.resolve(process.cwd(), 'backend', QR_OUTPUT_DIR.replace(/^\.\//, ''));
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function generateTableQr(hotelId: number, hotelSlug: string, tableNumber: number) {
  const dir = await ensureOutputDir();
  const url = `${process.env.HOST_BASE_URL || 'http://localhost:3000'}/menu/${hotelSlug}?table=${tableNumber}`;
  const filename = `${hotelId}-table-${tableNumber}.png`;
  const outPath = path.join(dir, filename);
  await QRCode.toFile(outPath, url, { type: 'png', margin: 1, width: 300 });
  // return public path relative to backend public
  return `/public/qrcodes/${filename}`;
}
