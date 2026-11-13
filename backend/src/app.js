// ประกอบแอป Express: middleware → หน้าเว็บ frontend → API → จัดการ error
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestLogger } from './middlewares/requestLogger.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { apiRoutes } from './routes/index.js';


const FRONTEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend');
const AXIOS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../node_modules/axios/dist');

export const app = express();


app.use(requestLogger);
app.use(express.json({ limit: '20kb' }));

app.use('/driver', express.static(path.join(FRONTEND_DIR, 'driver-app')));   // Driver
app.use('/staff', express.static(path.join(FRONTEND_DIR, 'staff-app')));     // Staff
app.use('/shared', express.static(path.join(FRONTEND_DIR, 'shared')));       // Shared code
app.use('/vendor/axios', express.static(AXIOS_DIR));                         // Axios (for frontend)
app.get('/', (req, res) => res.redirect('/driver/'));

app.use('/api', apiRoutes);
app.use('/api', notFound);
app.use(errorHandler);
