import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import cors, { type CorsOptions } from 'cors';
import { initDb } from './models';
import authRoutes from './routes/auth';
import hotelsRoutes from './routes/hotels';
import publicRoutes from './routes/public';

// Suppress the DEP0066 deprecation warning for OutgoingMessage._headers
// This is a known issue with Node.js 18.x and will be fixed in future versions
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('OutgoingMessage.prototype._headers')) {
    return; // Suppress this specific warning
  }
  console.warn(warning.name, warning.message);
});

dotenv.config();

const defaultCorsOrigins = [
  'http://localhost:*',
  'http://127.0.0.1:*',
  'http://172.*',
  'http://192.168.*',
  'http://10.*',
  'http://localhost:3000'
];

const parseOrigins = (raw: string | undefined): string[] => {
  if (!raw) return defaultCorsOrigins;
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const allowedOrigins = parseOrigins(process.env.CORS_ALLOWED_ORIGINS);

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const originAllowed = (origin: string): boolean => {
  if (allowedOrigins.includes('*')) return true;
  if (allowedOrigins.includes(origin)) return true;

  return allowedOrigins.some((pattern) => {
    if (!pattern.includes('*')) return false;
    const regex = new RegExp(
      `^${escapeRegex(pattern).replace(/\\\*/g, '.*')}$`
    );
    return regex.test(origin);
  });
};

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (originAllowed(origin)) return callback(null, true);
    console.warn(`CORS blocked origin: ${origin}`);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// static QR images
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

// Serve frontend (prefer built React app if available)
const projectRoot = path.join(__dirname, '..', '..');
const legacyFrontendPath = path.join(projectRoot, 'frontend-backup');
const fallbackFrontend = legacyFrontendPath;

app.use('/css', express.static(path.join(fallbackFrontend, 'css')));
app.use('/js', express.static(path.join(fallbackFrontend, 'js')));
app.use('/img', express.static(path.join(fallbackFrontend, 'img')));
app.use('/admin', express.static(path.join(fallbackFrontend, 'admin')));

// Serve favicon
app.get('/favicon.svg', (req, res) => {
  const faviconPath = path.join(fallbackFrontend, 'favicon.svg');
  res.setHeader('Content-Type', 'image/svg+xml');
  res.sendFile(faviconPath, (err) => {
    if (err) {
      res.status(404).end();
    }
  });
});

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// sockets
io.on('connection', (socket) => {
  socket.on('joinHotel', (hotelId: number) => {
    socket.join(`hotel_${hotelId}`);
  });
});

// attach io to app.locals for controllers to emit
(app as any).io = io;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/hotels', hotelsRoutes);
app.use('/api', publicRoutes);

// Explicit API 404 JSON to avoid ambiguous plain text responses
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not found', path: req.originalUrl });
});

// Serve frontend index.html for menu routes (SPA fallback)
// This must be AFTER the API routes to avoid conflicts
app.get('/menu/:slug', (req, res) => {
  const indexFile = path.join(fallbackFrontend, 'index.html');
  res.sendFile(indexFile);
});

// Serve admin pages
app.get('/admin/login.html', (req, res) => {
  res.sendFile(path.join(fallbackFrontend, 'admin', 'login.html'));
});

app.get('/admin/register.html', (req, res) => {
  res.sendFile(path.join(fallbackFrontend, 'admin', 'register.html'));
});

app.get('/admin/*', (req, res) => {
  const indexFile = path.join(fallbackFrontend, 'index.html');
  res.sendFile(indexFile);
});

const PORT = process.env.PORT || 3000;

// Start server even if DB connection fails (will retry on requests)
server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
  console.log(`Server ready at http://localhost:${PORT}`);
  // Initialize DB in background
  initDb()
    .then(() => {
      console.log('Database connected');
    })
    .catch((err) => {
      console.error('Failed to initialize DB', err);
      console.log('Server will continue but database operations may fail');
    });
});

server.on('error', (err: any) => {
  console.error('Server error:', err);
});

export { io };
