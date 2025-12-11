import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';



import {
  uploadMenuImage,
  getTestMenu,
  importMenuWithDocAi,
  receiveMenuFromN8n,   // ⭐ AJOUT IMPORTANT
} from './menu-ocr.controller';

const router = express.Router();

// --- UPLOAD FOLDER EXISTANT ---
const uploadDir = path.resolve(__dirname, '../uploads/menu-ocr');
fs.mkdirSync(uploadDir, { recursive: true });

// --- STORAGE DISK POUR /upload ---
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `menu-${unique}${ext}`);
  },
});

const upload = multer({ storage });

// --- MEMORY STORAGE POUR /import (Document AI) ---
const memoryUpload = multer({ storage: multer.memoryStorage() });

// ----------------------
// ROUTES EXISTANTES
// ----------------------
router.post('/upload', upload.single('menuImage'), uploadMenuImage);
router.post('/import', memoryUpload.single('file'), importMenuWithDocAi);
router.get('/test', getTestMenu);

// ----------------------
//  NOUVELLE ROUTE POUR N8N
// /api/menu-ocr/receive
// ----------------------
//router.post('/receive', express.json(), receiveMenuFromN8n);
router.post('/receive', receiveMenuFromN8n);


// ----------------------
export default router;
