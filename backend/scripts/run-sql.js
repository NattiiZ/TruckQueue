// รันไฟล์ SQL หนึ่งไฟล์กับฐานข้อมูลใน .env (ใช้รัน migration ใหม่)
// ใช้: npm run db:run -- db/migrations/005_xxx.sql
import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';

const file = process.argv[2];
if (!file) { console.error('ใช้: npm run db:run -- <ไฟล์.sql>'); process.exit(1); }

const conn = await mysql.createConnection({ ...env.db, multipleStatements: true, charset: 'utf8mb4' });
try {
  await conn.query(await fs.readFile(file, 'utf8'));
  const [tables] = await conn.query('SHOW TABLES');
  console.log(`✔ รัน ${file} สำเร็จ · ตาราง: ${tables.map((t) => Object.values(t)[0]).join(', ')}`);
} finally {
  await conn.end();
}
