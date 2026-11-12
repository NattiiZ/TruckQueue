// จุดเริ่มต้นของ backend: npm start
import os from 'node:os';
import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/database.js';

app.listen(env.port, '0.0.0.0', async () => {
  console.log(`TruckQ Server: http://localhost:${env.port}`);
  for (const nets of Object.values(os.networkInterfaces()))
    for (const n of nets || []) if (n.family === 'IPv4' && !n.internal) console.log(` Truck Driver App: http://${n.address}:${env.port}/driver/`);
  try {
    const [[r]] = await pool.query('SELECT DATABASE() AS db');
    console.log(` - Connected to database ${r.db}`);
  } catch (e) {
    console.error(` - Failed to connect to database: ${e.code || e.message} (Please check backend/.env)`);
  }
});
