import express from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models';

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
    try {
      const user = await (User as any).create({ name, email, passwordHash, role: 'admin' });
      res.json({ id: user.id, email: user.email });
    } catch (err) {
      res.status(500).json({ error: 'failed to create user' });
    }
  }
);

router.post('/login', body('email').isEmail(), body('password').exists(), async (req, res) => {
  const { email, password } = req.body;
  const user = await (User as any).findOne({ where: { email } });
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
  res.json({ token });
});

export default router;
