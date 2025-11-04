import express from 'express';
import { body, validationResult } from 'express-validator';
import { Hotel, Table } from '../models';
import { generateTableQr } from '../services/qrcode.service';
import { adminAuth } from '../middlewares/auth';

const router = express.Router();

router.post(
  '/',
  adminAuth,
  body('name').isLength({ min: 2 }),
  body('tablesCount').isInt({ min: 1 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, address, tablesCount, openTime, closeTime } = req.body;
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    try {
      const hotel = await (Hotel as any).create({ name, slug, address, tablesCount, onboardedAt: new Date() });
      // create tables and generate QR
      for (let i = 1; i <= tablesCount; i++) {
        const table = await (Table as any).create({ hotelId: hotel.id, number: i });
        const qrPath = await generateTableQr(hotel.id, slug, i);
        table.qrPath = qrPath;
        await table.save();
      }
      res.json({ id: hotel.id, slug: hotel.slug });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'failed to create hotel' });
    }
  }
);

router.get('/:id', adminAuth, async (req, res) => {
  const hotel = await (Hotel as any).findByPk(req.params.id, { include: ['tables', 'menu'] });
  if (!hotel) return res.status(404).json({ error: 'not found' });
  res.json(hotel);
});

router.get('/:id/tables', adminAuth, async (req, res) => {
  const tables = await (Table as any).findAll({ where: { hotelId: req.params.id } });
  res.json(tables);
});

router.get('/tables/:hotelId/:tableId/qrcode', adminAuth, async (req, res) => {
  const table = await (Table as any).findOne({ where: { hotelId: req.params.hotelId, id: req.params.tableId } });
  if (!table) return res.status(404).json({ error: 'not found' });
  res.json({ qrPath: table.qrPath });
});

export default router;
