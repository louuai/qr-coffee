import express from 'express';
import { body, validationResult } from 'express-validator';
import { Hotel, Table, MenuItem, Order } from '../models';
import { generateTableQr, ensureOutputDir, buildMenuUrl } from '../services/qrcode.service';
import path from 'path';
import fs from 'fs/promises';
import { Op } from 'sequelize';
import { adminAuth, type AuthRequest } from '../middlewares/auth';

const router = express.Router();

function getUserId(req: AuthRequest) {
  return (req.user as any)?.id;
}

function slugifyName(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'business';
}

async function ensureHotelOwnership(req: AuthRequest, res: express.Response, hotelId: number) {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  const hotel = await (Hotel as any).findOne({ where: { id: hotelId, ownerId: userId } });
  if (!hotel) {
    res.status(404).json({ error: 'hotel not found' });
    return null;
  }
  return hotel;
}

// Get all hotels for the authenticated admin
router.get('/', adminAuth, async (req: AuthRequest, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const hotels = await (Hotel as any).findAll({
      where: { ownerId: userId },
      attributes: ['id', 'name', 'slug', 'address', 'location', 'businessPhone', 'personalPhone', 'tablesCount', 'createdAt']
    });
    res.json(hotels);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to fetch hotels' });
  }
});

// Onboarding: create business + tables with minimal info
router.post(
  '/onboarding',
  adminAuth,
  body('businessName').isLength({ min: 2 }),
  body('location').optional().isLength({ min: 2 }),
  body('businessPhone').optional().isLength({ min: 3 }),
  body('personalPhone').optional().isLength({ min: 3 }),
  body('tablesCount').optional().isInt({ min: 1, max: 50 }),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { businessName, businessPhone, personalPhone } = req.body;
    const location = (req.body.location || '').toString().trim() || 'N/A';
    const tablesCount = req.body.tablesCount ? Number(req.body.tablesCount) : 5;
    const baseSlug = slugifyName(businessName);
    let slug = baseSlug;
    let counter = 1;
    while (await (Hotel as any).findOne({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    try {
      const hotel = await (Hotel as any).create({
        name: businessName,
        slug,
        address: location,
        location,
        businessPhone,
        personalPhone,
        tablesCount,
        ownerId: userId,
        onboardedAt: new Date()
      });

      // create tables and qr codes
      for (let i = 1; i <= tablesCount; i++) {
        const table = await (Table as any).create({ hotelId: hotel.id, number: i });
        const { path: qrPath } = await generateTableQr(hotel.id, slug, i);
        table.qrPath = qrPath;
        await table.save();
      }

      res.json({ id: hotel.id, slug: hotel.slug, name: hotel.name });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'failed to create business' });
    }
  }
);

router.post(
  '/',
  adminAuth,
  body('name').isLength({ min: 2 }),
  body('tablesCount').isInt({ min: 1 }),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const { name, address, tablesCount, openTime, closeTime } = req.body;
    const baseSlug = name.toLowerCase().replace(/\s+/g, '-');
    let slug = baseSlug;
    let counter = 1;
    while (await (Hotel as any).findOne({ where: { slug, ownerId: userId } })) {
      slug = `${baseSlug}-${counter++}`;
    }
    try {
      const hotel = await (Hotel as any).create({ name, slug, address, tablesCount, ownerId: userId, onboardedAt: new Date() });
      // create tables and generate QR
      for (let i = 1; i <= tablesCount; i++) {
        const table = await (Table as any).create({ hotelId: hotel.id, number: i });
        const { path: qrPath } = await generateTableQr(hotel.id, slug, i);
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

router.get('/:id', adminAuth, async (req: AuthRequest, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  const hotelId = Number(req.params.id);
  const hotel = await (Hotel as any).findOne({ where: { id: hotelId, ownerId: userId }, include: ['tables', 'menu'] });
  if (!hotel) return res.status(404).json({ error: 'not found' });
  res.json(hotel);
});

router.get('/:id/tables', adminAuth, async (req: AuthRequest, res) => {
  const hotelId = Number(req.params.id);
  const hotel = await ensureHotelOwnership(req, res, hotelId);
  if (!hotel) return;
  const tables = await (Table as any).findAll({ where: { hotelId } });
  res.json(tables);
});

router.get('/tables/:hotelId/:tableId/qrcode', adminAuth, async (req: AuthRequest, res) => {
  const hotelId = Number(req.params.hotelId);
  const tableId = Number(req.params.tableId);
  const hotel = await ensureHotelOwnership(req, res, hotelId);
  if (!hotel) return;
  const table = await (Table as any).findOne({ where: { hotelId, id: tableId } });
  if (!table) return res.status(404).json({ error: 'not found' });

  try {
    // Ensure file exists; if missing, regenerate

    const dir = await ensureOutputDir();
    const filename = `${hotel.id}-table-${table.number}.png`;
    const fsPath = path.join(dir, filename);

    let fileExists = true;
    try {
      await fs.access(fsPath);
    } catch {
      fileExists = false;
    }

    let qrPath = table.qrPath || `/public/qrcodes/${filename}`;
    let qrUrl = buildMenuUrl(hotel.slug, table.number);

    if (!fileExists || !table.qrPath) {
      const qrInfo = await generateTableQr(hotel.id, hotel.slug, table.number);
      qrPath = qrInfo.path;
      qrUrl = qrInfo.targetUrl;
      table.qrPath = qrPath;
      await table.save();
    }

    res.json({ qrPath, qrUrl });
  } catch (err) {
    console.error('qr route error', err);
    res.status(500).json({ error: 'failed to get qr' });
  }
});

// Tables CRUD
router.post('/:id/tables', adminAuth, body('number').isInt({ min: 1 }), async (req: AuthRequest, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { number } = req.body;
  const hotelId = Number(req.params.id);
  try {
    const hotel = await ensureHotelOwnership(req, res, hotelId);
    if (!hotel) return;
    const table = await (Table as any).create({ hotelId, number });
    const { path: qrPath } = await generateTableQr(hotel.id, hotel.slug, number);
    table.qrPath = qrPath;
    await table.save();
    res.json(table);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to create table' });
  }
});

router.put('/:id/tables/:tableId', adminAuth, async (req: AuthRequest, res) => {
  const { number, status } = req.body;
  const hotelId = Number(req.params.id);
  try {
    const hotel = await ensureHotelOwnership(req, res, hotelId);
    if (!hotel) return;
    const table = await (Table as any).findOne({ where: { hotelId, id: req.params.tableId } });
    if (!table) return res.status(404).json({ error: 'not found' });
    if (number !== undefined) table.number = number;
    if (status !== undefined) table.status = status;
    await table.save();
    res.json(table);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to update table' });
  }
});

router.delete('/:id/tables/:tableId', adminAuth, async (req: AuthRequest, res) => {
  const hotelId = Number(req.params.id);
  try {
    const hotel = await ensureHotelOwnership(req, res, hotelId);
    if (!hotel) return;
    const table = await (Table as any).findOne({ where: { hotelId, id: req.params.tableId } });
    if (!table) return res.status(404).json({ error: 'not found' });
    await table.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to delete table' });
  }
});

// Menu Items CRUD
router.get('/:id/menu', adminAuth, async (req: AuthRequest, res) => {
  const hotelId = Number(req.params.id);
  const hotel = await ensureHotelOwnership(req, res, hotelId);
  if (!hotel) return;
  const items = await (MenuItem as any).findAll({ where: { hotelId } });
  res.json(items);
});

router.post('/:id/menu', adminAuth, 
  body('name').isLength({ min: 1 }),
  body('price').isFloat({ min: 0 }),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const hotelId = Number(req.params.id);
    try {
      const hotel = await ensureHotelOwnership(req, res, hotelId);
      if (!hotel) return;
      const item = await (MenuItem as any).create({ ...req.body, hotelId });
      res.json(item);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'failed to create menu item' });
    }
  }
);

router.put('/:id/menu/:itemId', adminAuth, async (req: AuthRequest, res) => {
  const hotelId = Number(req.params.id);
  try {
    const hotel = await ensureHotelOwnership(req, res, hotelId);
    if (!hotel) return;
    const item = await (MenuItem as any).findOne({ where: { hotelId, id: req.params.itemId } });
    if (!item) return res.status(404).json({ error: 'not found' });
    await item.update(req.body);
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to update menu item' });
  }
});

router.delete('/:id/menu/:itemId', adminAuth, async (req: AuthRequest, res) => {
  const hotelId = Number(req.params.id);
  try {
    const hotel = await ensureHotelOwnership(req, res, hotelId);
    if (!hotel) return;
    const item = await (MenuItem as any).findOne({ where: { hotelId, id: req.params.itemId } });
    if (!item) return res.status(404).json({ error: 'not found' });
    await item.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to delete menu item' });
  }
});

// Orders
router.get('/:id/orders', adminAuth, async (req: AuthRequest, res) => {
  const hotelId = Number(req.params.id);
  try {
    const hotel = await ensureHotelOwnership(req, res, hotelId);
    if (!hotel) return;
    const orders = await (Order as any).findAll({ 
      where: { hotelId },
      order: [['createdAt', 'DESC']]
    });
    // Get table numbers for orders
    const ordersWithTableNumber = await Promise.all(orders.map(async (order: any) => {
      const orderData = order.toJSON();
      if (typeof orderData.items === 'string') {
        try {
          orderData.items = JSON.parse(orderData.items);
        } catch (err) {
          console.warn('Failed to parse order items JSON', orderData.items, err);
          orderData.items = [];
        }
      } else if (!Array.isArray(orderData.items)) {
        orderData.items = [];
      }
      if (orderData.tableId) {
        const table = await (Table as any).findByPk(orderData.tableId);
        orderData.tableNumber = table ? table.number : null;
      } else {
        orderData.tableNumber = null;
      }
      return orderData;
    }));
    res.json(ordersWithTableNumber);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to load orders' });
  }
});

// Helper date ranges
function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d = new Date()) { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function monthRange(year: number, month01: number) { // month01 = 1..12
  const start = new Date(year, month01 - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month01, 0, 23, 59, 59, 999);
  return { start, end };
}

// KPIs for dashboard
router.get('/:id/kpis', adminAuth, async (req: AuthRequest, res) => {
  const hotelId = Number(req.params.id);
  try {
    const hotel = await ensureHotelOwnership(req, res, hotelId);
    if (!hotel) return;
    const [totalTables, activeTables] = await Promise.all([
      (Table as any).count({ where: { hotelId } }),
      (Table as any).count({ where: { hotelId, status: { [Op.ne]: 'idle' } } })
    ]);

    const newOrders = await (Order as any).count({ where: { hotelId, status: 'new' } });

    const start = startOfDay(); const end = endOfDay();
    const ordersToday = await (Order as any).findAll({ where: { hotelId, createdAt: { [Op.gte]: start, [Op.lte]: end } }, attributes: ['id','createdAt','updatedAt','status','total'] });
    const customersToday = ordersToday.length;
    const servedToday = ordersToday.filter((o: any) => o.status === 'served');
    const avgWaitMinutes = servedToday.length > 0 ? Math.round(servedToday.reduce((acc: number, o: any) => acc + Math.max(0, (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime())/60000), 0) / servedToday.length) : 0;

    res.json({ totalTables, activeTables, newOrders, customersToday, avgWaitMinutes });
  } catch (err) {
    console.error('kpis error', err);
    res.status(500).json({ error: 'failed to load kpis' });
  }
});

// Monthly aggregated stats for a given month
router.get('/:id/history', adminAuth, async (req: AuthRequest, res) => {
  const hotelId = Number(req.params.id);
  try {
    const hotel = await ensureHotelOwnership(req, res, hotelId);
    if (!hotel) return;
    const now = new Date();
    const m = (req.query.month as string) || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const [yStr, moStr] = m.split('-');
    const y = Number(yStr); const mo = Number(moStr);
    const { start, end } = monthRange(y, mo);

    const orders = await (Order as any).findAll({ where: { hotelId, createdAt: { [Op.gte]: start, [Op.lte]: end } }, order: [['createdAt','ASC']] });
    const totalOrders = orders.length;
    const served = orders.filter((o: any) => o.status === 'served');
    const cancelled = orders.filter((o: any) => o.status === 'cancelled');
    const revenue = orders.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
    const avgWaitMinutes = served.length>0 ? Math.round(served.reduce((a: number, o: any) => a + Math.max(0, (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime())/60000), 0)/served.length) : 0;

    res.json({ month: m, totalOrders, served: served.length, cancelled: cancelled.length, revenue, avgWaitMinutes });
  } catch (err) {
    console.error('history error', err);
    res.status(500).json({ error: 'failed to load history' });
  }
});

// Export monthly CSV under public/reports and return public path
router.get('/:id/export-csv', adminAuth, async (req: AuthRequest, res) => {
  const hotelId = Number(req.params.id);
  try {
    const hotel = await ensureHotelOwnership(req, res, hotelId);
    if (!hotel) return;
    const now = new Date();
    const m = (req.query.month as string) || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const [yStr, moStr] = m.split('-');
    const y = Number(yStr); const mo = Number(moStr);
    const { start, end } = monthRange(y, mo);

    const orders = await (Order as any).findAll({ where: { hotelId, createdAt: { [Op.gte]: start, [Op.lte]: end } }, order: [['createdAt','ASC']] });
    const header = ['id','createdAt','updatedAt','status','tableId','total'];
    const rows = [header.join(',')].concat(orders.map((o: any)=>[
      o.id,
      new Date(o.createdAt).toISOString(),
      new Date(o.updatedAt).toISOString(),
      o.status,
      o.tableId ?? '',
      Number(o.total||0).toFixed(2)
    ].join(',')));

    const reportsDir = path.resolve(process.cwd(), 'public', 'reports');
    await fs.mkdir(reportsDir, { recursive: true });
    const file = `hotel-${hotelId}-${m}.csv`;
    const full = path.join(reportsDir, file);
    await fs.writeFile(full, rows.join('\n'), 'utf8');
    return res.json({ path: `/public/reports/${file}` });
  } catch (err) {
    console.error('export csv error', err);
    res.status(500).json({ error: 'failed to export csv' });
  }
});
router.put('/orders/:orderId/status', adminAuth, body('status').isIn(['new', 'preparing', 'served', 'cancelled']), async (req: AuthRequest, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const order = await (Order as any).findByPk(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'not found' });
    const hotel = await ensureHotelOwnership(req, res, Number(order.hotelId));
    if (!hotel) return;
    order.status = req.body.status;
    await order.save();
    
    // Update table status and unreadOrders counter
    if (order.tableId) {
      const table = await (Table as any).findByPk(order.tableId);
      if (table) {
        const newOrdersCount = await (Order as any).count({
          where: { hotelId: table.hotelId, tableId: table.id, status: 'new' }
        });
        const preparingCount = await (Order as any).count({
          where: { hotelId: table.hotelId, tableId: table.id, status: 'preparing' }
        });
        table.unreadOrders = newOrdersCount;

        if (newOrdersCount > 0) {
          table.status = 'new';
        } else if (preparingCount > 0) {
          table.status = 'in_progress';
        } else if (req.body.status === 'served') {
          table.status = 'served';
        } else if (req.body.status === 'cancelled') {
          table.status = 'idle';
        } else {
          table.status = 'idle';
        }
        
        await table.save();
      }
    }
    
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to update order status' });
  }
});

router.delete('/orders/:orderId', adminAuth, async (req: AuthRequest, res) => {
  try {
    const order = await (Order as any).findByPk(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'not found' });
    const hotel = await ensureHotelOwnership(req, res, Number(order.hotelId));
    if (!hotel) return;
    const tableId = order.tableId;
    await order.destroy();

    if (tableId) {
      const table = await (Table as any).findByPk(tableId);
      if (table) {
        const newOrdersCount = await (Order as any).count({
          where: { hotelId: table.hotelId, tableId: table.id, status: 'new' }
        });
        const preparingCount = await (Order as any).count({
          where: { hotelId: table.hotelId, tableId: table.id, status: 'preparing' }
        });
        table.unreadOrders = newOrdersCount;
        if (newOrdersCount > 0) {
          table.status = 'new';
        } else if (preparingCount > 0) {
          table.status = 'in_progress';
        } else {
          table.status = 'idle';
        }
        await table.save();
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to delete order' });
  }
});

export default router;
