// ประกอบแอป Express: middleware → หน้าเว็บ frontend → API → จัดการ error
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestLogger } from './middlewares/requestLogger.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { createFrontend } from './middlewares/frontendFiles.js';
import { apiRoutes } from './routes/index.js';


const FRONTEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend');
const AXIOS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../node_modules/axios/dist');

export const app = express();


app.use(requestLogger);
app.use(express.json({ limit: '20kb' }));

// ไฟล์หน้าเว็บ: ลิงก์ .js/.css ในหน้า .html มี ?v=เวลาแก้ไฟล์ ต่อท้ายให้อัตโนมัติ (ดู middlewares/frontendFiles.js)
const frontend = createFrontend({
  '/driver/': path.join(FRONTEND_DIR, 'driver-app'),
  '/staff/': path.join(FRONTEND_DIR, 'staff-app'),
  '/shared/': path.join(FRONTEND_DIR, 'shared'),
  '/vendor/axios/': AXIOS_DIR,
});
app.use((req, res, next) => (req.path === '/driver' || req.path === '/staff') ? res.redirect(301, req.path + '/') : next());
app.use('/driver', frontend('/driver/'));        // Driver
app.use('/staff', frontend('/staff/'));          // Staff
app.use('/shared', frontend('/shared/'));        // Shared code
app.use('/vendor/axios', frontend('/vendor/axios/'));   // Axios (for frontend)
app.get('/', (req, res) => res.redirect('/driver/'));

app.use('/api', apiRoutes);
app.use('/api', notFound);
app.use(errorHandler);