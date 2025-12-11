import type { Request, Response } from 'express';
import fs from 'fs/promises';
import { extractTextFromImage } from './ocr.service';
import { splitMenuImage } from './image-splitter';
import { detectCategoriesFromText } from './category-detector';
import { parseMenuBlocksToProducts } from './menu-parser';
import type { OCRDebugPayload, CategoryBlock } from './types';
import { MenuItem } from '../src/models';
import path from 'path';
import axios from "axios";


// Extraction de prix simple
function extractPrice(text: string): number | null {
  if (!text) return null;
  const match = text.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const n = parseFloat(match[1].replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

// Route upload (inchangée)
export async function uploadMenuImage(req: Request, res: Response) {
  try {
    const file = req.file;
    if (!file?.path) {
      return res.status(400).json({ error: 'Image manquante' });
    }
    const hotelId = Number(req.body?.hotelId);
    if (!hotelId || Number.isNaN(hotelId)) {
      return res.status(400).json({ error: 'hotelId requis' });
    }

    // Lire l'image et l'envoyer au webhook n8n
    let imageBase64: string;
    try {
      const buffer = await fs.readFile(file.path);
      imageBase64 = buffer.toString('base64');
    } catch (err) {
      console.error('[menu-ocr] failed to read file', err);
      return res.status(500).json({ error: 'failed_to_read_image' });
    }

    // Appel n8n pour OCR + structuration
    let n8nResponse;

try {
  const resp = await axios.post(
    'https://nonpersistent-julieta-fraudfully.ngrok-free.dev/webhook-test/menu-ocr',
    { hotelId, imageBase64 },
    { headers: { "Content-Type": "application/json" } }
  );

  n8nResponse = resp.data;
} catch (err) {
  console.error('[menu-ocr] n8n webhook failed', err);
  return res.status(500).json({ error: 'ocr_pipeline_failed' });
}   const menu = n8nResponse?.menu;
    const items = Array.isArray(menu?.items) ? menu.items : [];

    let created = 0;
    let updated = 0;

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const name = (item.name || '').toString().trim();
      const price = Number(item.price);
      if (!name || Number.isNaN(price)) continue;

      const category = (item.category || '').toString().trim();
      const description = (item.description || '').toString();

      const existing = await (MenuItem as any).findOne({
        where: { hotelId, name },
      });

      if (existing) {
        existing.price = price;
        if (category) existing.category = category;
        if (description) existing.description = description;
        await existing.save();
        updated++;
      } else {
        await (MenuItem as any).create({
          hotelId,
          name,
          price,
          category,
          description,
          available: true,
        });
        created++;
      }
    }

    return res.json({ ok: true, created, updated, items });
  } catch (error) {
    console.error('[menu-ocr] upload error', error);
    return res.status(500).json({ error: 'menu_ocr_failed' });
  }
}

// Route import (Document AI Layout Parser)
export async function importMenuWithDocAi(req: Request, res: Response) {
  try {
    // Lazy load pour éviter les erreurs au démarrage si le module n'est pas dispo
    let DocumentProcessorServiceClient: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      DocumentProcessorServiceClient = require('@google-cloud/documentai').DocumentProcessorServiceClient;
    } catch (err) {
      console.error('[menu-ocr] Failed to load @google-cloud/documentai', err);
      return res.status(500).json({ error: 'docai_not_available' });
    }

    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({ error: 'Image manquante' });
    }

    const projectId = 'qr-coffee-ocr';
    const location = 'us';
    const processorId = '9dccfa2899ee5160';
    const keyFile = path.resolve(__dirname, '../../frontend-backup/qr-coffee-ocr-d0647c3e6044.json');

    const client = new DocumentProcessorServiceClient({ keyFilename: keyFile });
    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

    const rawDocument = {
      content: file.buffer.toString('base64'),
      mimeType: file.mimetype || 'image/jpeg',
    };

    const [result] = await client.processDocument({ name, rawDocument });
    const doc = result.document;
    const rawText = doc?.text || '';

    const layoutText = (layout: any) => {
      if (!layout?.textAnchor?.textSegments || !doc?.text) return '';
      return layout.textAnchor.textSegments
        .map((s: any) => doc.text.substring(Number(s.startIndex || 0), Number(s.endIndex || 0)))
        .join('');
    };

    const lines: string[] = [];
    (doc?.pages || []).forEach((p: any) => {
      (p.paragraphs || []).forEach((para: any) => {
        const t = layoutText(para.layout).trim();
        if (t) lines.push(t);
      });
      (p.blocks || []).forEach((b: any) => {
        const t = layoutText(b.layout).trim();
        if (t) lines.push(t);
      });
      (p.tables || []).forEach((table: any) => {
        (table.headerRows || []).concat(table.bodyRows || []).forEach((row: any) => {
          const cellTexts = (row.cells || []).map((c: any) => layoutText(c.layout).trim()).filter(Boolean);
          const rowText = cellTexts.join(' ');
          if (rowText) lines.push(rowText);
        });
      });
      (p.entities || []).forEach((ent: any) => {
        const t = layoutText(ent.layout).trim();
        if (t) lines.push(t);
      });
    });

    const categories: CategoryBlock[] = [];
    const products: any[] = [];
    let currentCategory = 'Autodetected';

    const isHeading = (text: string): boolean => {
      const t = text.trim();
      if (!t || t.length < 2) return false;
      if (/\d/.test(t)) return false;
      if (t.length > 40) return false;
      if (!/^[A-Z]/.test(t)) return false;
      return true;
    };

    for (const rawLine of lines) {
      const text = rawLine.replace(/\s+/g, ' ').trim();
      if (!text) continue;

      if (isHeading(text)) {
        currentCategory = text || 'Autodetected';
        if (!categories.find((c) => c.title === currentCategory)) {
          categories.push({ title: currentCategory, items: [] });
        }
        continue;
      }

      const price = extractPrice(text);
      if (price !== null) {
        const name = text.replace(/(\d+(?:[.,]\d+)?)/g, '').trim() || 'Produit';
        products.push({
          category: currentCategory,
          name,
          price,
          image: undefined,
        });
        const cat = categories.find((c) => c.title === currentCategory);
        if (cat) cat.items.push({ rawText: text });
        else categories.push({ title: currentCategory, items: [{ rawText: text }] });
      } else {
        const cat = categories.find((c) => c.title === currentCategory);
        if (cat) cat.items.push({ rawText: text });
        else categories.push({ title: currentCategory, items: [{ rawText: text }] });
      }
    }

    if (!categories.length && lines.length) {
      categories.push({ title: 'Autodetected', items: lines.map((rawText) => ({ rawText })) });
    }

    const payload: OCRDebugPayload = { rawText, categories, products };

    try {
      await fetch('http://nonpersistent-julieta-fraudfully.ngrok-free.dev:5678/webhook/menu-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, debug: payload }),
      });
    } catch (err) {
      console.warn('[menu-ocr] webhook n8n failed', err);
    }

    return res.json({ ok: true, debug: payload });
  } catch (error) {
    console.error('[menu-ocr] import error', error);
    return res.status(500).json({ error: 'menu_ocr_failed' });
  }
}

// Réception JSON depuis n8n (aucune suppression, mise à jour / insertion)
export async function receiveMenuFromN8n(req: Request, res: Response) {
   try {
    // 1) Récupération de l'hôtel
    const rawHotelId = (req.body?.hotelId ?? req.body?.hotelID ?? req.body?.hotelid);
    const hotelIdNum = Number(rawHotelId);

    if (!rawHotelId || Number.isNaN(hotelIdNum)) {
      return res.status(400).json({ error: 'hotelId requis' });
    }

    // 2) Normalisation du menu envoyé par n8n
    let rawMenu: any = req.body?.menu ?? req.body;

    // Si menu est une string => on essaye de parser
    if (typeof rawMenu === 'string') {
      try {
        rawMenu = JSON.parse(rawMenu);
      } catch (e) {
        console.warn('[menu-ocr] menu est une string non parsable');
      }
    }

    // Si pas d'items dans rawMenu mais qu'ils sont à la racine
    if (!rawMenu?.items && Array.isArray(req.body?.items)) {
      rawMenu = {
        items: req.body.items,
        categories: req.body.categories ?? [],
      };
    }

    const menu = rawMenu;
    const menuItems = menu?.items;

    if (!Array.isArray(menuItems)) {
      return res.status(400).json({ error: 'menu.items doit être un tableau' });
    }

    let created = 0;
    let updated = 0;

    for (const item of menuItems) {
      if (!item || typeof item !== 'object') continue;
      const name = (item.name || '').toString().trim();
      const price = Number(item.price);
      if (!name || Number.isNaN(price)) continue;

      const category = (item.category || '').toString().trim();
      const description = (item.description || '').toString();

      const existing = await (MenuItem as any).findOne({
        where: { hotelId: hotelIdNum, name },
      });

      if (existing) {
        existing.price = price;
        if (category) existing.category = category;
        if (description) existing.description = description;
        await existing.save();
        updated++;
      } else {
        await (MenuItem as any).create({
          hotelId: hotelIdNum,
          name,
          price,
          category,
          description,
          available: true,
        });
        created++;
      }
    }

    return res.json({ ok: true, updated, created });
  } catch (error) {
    console.error('[menu-ocr] receiveMenuFromN8n error', error);
    return res.status(500).json({ error: 'menu_ocr_receive_failed' });
  }
}

// Test (inchangé)
export async function getTestMenu(_req: Request, res: Response) {
  return res.json([
    { category: 'Boissons chaudes', name: 'Express', price: 2.5, image: '/uploads/express.png' },
    { category: 'Boissons chaudes', name: 'Latte', price: 5.8, image: '/uploads/latte.png' },
    { category: 'Desserts', name: 'Cheesecake', price: 7.2, image: '/uploads/cheesecake.png' },
  ]);
}
