import express from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, Hotel, Table } from '../models';
import { generateTableQr } from '../services/qrcode.service';
import { adminAuth, type AuthRequest } from '../middlewares/auth';

const router = express.Router();

router.post(
  '/register',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, email, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const slugify = (value: string) =>
      value
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'business';

    try {
      const user = await (User as any).create({ name, email, passwordHash, role: 'admin' });

      // Auto-provision a default hotel so the dashboard has data right after sign-up
      try {
        const baseName = (req.body.businessName || name || email.split('@')[0] || 'Mon Café').toString().trim();
        const baseSlug = slugify(baseName);
        let slug = baseSlug;
        let counter = 1;
        while (await (Hotel as any).findOne({ where: { slug } })) {
          slug = `${baseSlug}-${counter++}`;
        }

        const tablesCount = Number(req.body.tablesCount || 5);
        const hotel = await (Hotel as any).create({
          name: baseName,
          slug,
          address: req.body.location || '',
          location: req.body.location || '',
          tablesCount,
          ownerId: user.id,
          onboardedAt: new Date(),
        });

        // Create tables + QR codes
        for (let i = 1; i <= tablesCount; i++) {
          const table = await (Table as any).create({ hotelId: hotel.id, number: i });
          try {
            const { path: qrPath } = await generateTableQr(hotel.id, slug, i);
            table.qrPath = qrPath;
            await table.save();
          } catch (qrErr) {
            console.warn('QR generation failed for table', i, qrErr);
          }
        }
      } catch (provisionErr) {
        console.warn('Auto-provisioning hotel failed', provisionErr);
      }

      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
      res.json({ id: user.id, email: user.email, token });
    } catch (err) {
      const message = (err as any)?.message || err;
      // Sequelize unique email constraint
      if ((err as any)?.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ error: 'email_already_exists' });
      }
      console.error('Register error:', message);
      res.status(500).json({ error: 'failed to create user', message });
    }
  }
);

router.post('/login', 
  body('email').isEmail().withMessage('Email must be valid'),
  body('password').notEmpty().withMessage('Password is required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation failed', errors: errors.array() });
    }
    
    try {
      const { email, password } = req.body;
      console.log('Login request received:', { email, passwordLength: password?.length });
      
      const user = await (User as any).findOne({ where: { email } });
      if (!user) {
        console.log('User not found:', email);
        return res.status(401).json({ error: 'invalid credentials' });
      }
      
      console.log('User found:', user.email, 'ID:', user.id);
      
      // Vérifier le hash du mot de passe
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        console.log('Password comparison failed for user:', email);
        console.log('Stored hash:', user.passwordHash?.substring(0, 20) + '...');
        return res.status(401).json({ error: 'invalid credentials' });
      }
      
      console.log('Password verified successfully for user:', email);
      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
      res.json({ token });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'database connection error', message: err && (err as any).message ? (err as any).message : 'unknown error' });
    }
  }
);

export default router;

// Current user profile
router.get('/me', adminAuth, async (req: AuthRequest, res) => {
  try {
    const id = (req.user as any)?.id;
    if (!id) return res.status(401).json({ error: 'unauthorized' });
    const user = await (User as any).findByPk(id, { attributes: ['id', 'name', 'email', 'role'] });
    if (!user) return res.status(404).json({ error: 'not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'failed to fetch profile' });
  }
});

router.put('/me', adminAuth, async (req: AuthRequest, res) => {
  try {
    const id = (req.user as any)?.id;
    if (!id) return res.status(401).json({ error: 'unauthorized' });
    const user = await (User as any).findByPk(id);
    if (!user) return res.status(404).json({ error: 'not found' });

    const { name, currentPassword, newPassword } = req.body || {};
    if (name) user.name = name;

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'current password required' });
      }
      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) return res.status(400).json({ error: 'invalid current password' });
      user.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await user.save();

    // Optionally return a new token if password changed
    let token: string | undefined;
    if (newPassword) {
      token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    }
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role, token });
  } catch (err) {
    res.status(500).json({ error: 'failed to update profile' });
  }
});
