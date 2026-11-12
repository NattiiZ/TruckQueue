// ประกอบแอป Express: middleware → หน้าเว็บ frontend → API → จัดการ error
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestLogger } from './middlewares/requestLogger.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { apiRoutes } from './routes/index.js';

const FRONTEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend');

export const app = express();

app.use(requestLogger);
app.use(express.json({ limit: '20kb' }));

// หน้าเว็บเปิดจากเซิร์ฟเวอร์นี้ที่เดียว (หน้าเว็บกับ API อยู่ที่อยู่เดียวกัน ไม่ต้องตั้งค่า)
app.use('/driver', express.static(path.join(FRONTEND_DIR, 'driver-app')));   // หน้าคนขับ
app.use('/staff', express.static(path.join(FRONTEND_DIR, 'staff-app')));     // หน้าพนักงาน
app.use('/shared', express.static(path.join(FRONTEND_DIR, 'shared')));       // โค้ดที่สองหน้าใช้ร่วมกัน
app.get('/', (req, res) => res.redirect('/driver/'));

app.use('/api', apiRoutes);
app.use('/api', notFound);
app.use(errorHandler);
