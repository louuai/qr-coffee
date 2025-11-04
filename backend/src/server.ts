import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import cors from 'cors';
import { initDb } from './models';
import authRoutes from './routes/auth';
import hotelsRoutes from './routes/hotels';
import publicRoutes from './routes/public';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// static QR images
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

// sockets
io.on('connection', (socket) => {
  socket.on('joinHotel', (hotelId: number) => {
    socket.join(`hotel_${hotelId}`);
  });
});

// attach io to app.locals for controllers to emit
(app as any).io = io;

app.use('/api/auth', authRoutes);
app.use('/api/hotels', hotelsRoutes);
app.use('/api', publicRoutes);

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server listening on ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize DB', err);
  });

export { io };
