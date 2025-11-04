import express from 'express';
import { body, validationResult } from 'express-validator';
import { Hotel, MenuItem, Order, Table } from '../models';

const router = express.Router();

router.get('/menu/:hotelSlug', async (req, res) => {
  const { hotelSlug } = req.params;
  const hotel = await (Hotel as any).findOne({ where: { slug: hotelSlug }, include: ['menu'] });
  if (!hotel) return res.status(404).json({ error: 'hotel not found' });
  res.json({ hotel: { id: hotel.id, name: hotel.name, slug: hotel.slug }, menu: hotel.menu });
});

router.post('/order/public',
  body('hotelId').isInt(),
  body('tableNumber').isInt(),
  body('items').isArray(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { hotelId, tableNumber, items, customerNote } = req.body;
    try {
      // find table
      const table = await (Table as any).findOne({ where: { hotelId, number: tableNumber } });
      const total = (items || []).reduce((s: number, it: any) => s + (it.price || 0) * (it.qty || 1), 0);
      const order = await (Order as any).create({ hotelId, tableId: table ? table.id : null, items, total, customerInfo: { note: customerNote } });

      // increment unread on table and emit socket
      if (table) {
        table.unreadOrders = (table.unreadOrders || 0) + 1;
        await table.save();
      }

      const io = (req.app as any).io;
      if (io) {
        io.to(`hotel_${hotelId}`).emit('order:new', { orderId: order.id, tableNumber, total, createdAt: order.createdAt });
      }

      res.json({ id: order.id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'failed to create order' });
    }
  }
);

export default router;
