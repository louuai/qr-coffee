import dotenv from 'dotenv';
dotenv.config();
import { initDb, Hotel, Table, MenuItem, User } from '../models';
import bcrypt from 'bcrypt';
import { generateTableQr } from '../services/qrcode.service';

async function seed() {
  await initDb();
  // create admin
  const passwordHash = await bcrypt.hash('password', 10);
  await (User as any).create({ name: 'Admin', email: 'admin@example.com', passwordHash, role: 'admin' }).catch(() => {});

  // create hotel + tables + menu
  const hotel = await (Hotel as any).create({ name: 'Demo Coffee', slug: 'demo-coffee', address: '123 Demo St', tablesCount: 10, onboardedAt: new Date() });
  for (let i = 1; i <= 10; i++) {
    const table = await (Table as any).create({ hotelId: hotel.id, number: i });
    const qrPath = await generateTableQr(hotel.id, hotel.slug, i);
    table.qrPath = qrPath;
    await table.save();
  }

  await (MenuItem as any).bulkCreate([
    { hotelId: hotel.id, name: 'Espresso', price: 2.5, category: 'Coffee', description: 'Strong espresso', available: true },
    { hotelId: hotel.id, name: 'Cappuccino', price: 3.5, category: 'Coffee', description: 'Frothed milk', available: true },
    { hotelId: hotel.id, name: 'Blueberry Muffin', price: 2.0, category: 'Bakery', description: 'Fresh muffin', available: true },
  ]);

  console.log('Seed complete');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
