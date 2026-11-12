// ติดตั้งฐานข้อมูลเครื่องใหม่: สร้าง database + ทุกตาราง (db/schema.sql) + ข้อมูลตั้งต้น (db/seed.sql)
// ใช้: npm run db:setup
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const { database, ...server } = env.db;
if (!/^[A-Za-z0-9_]+$/.test(database)) throw new Error('DB_NAME ใช้ได้เฉพาะ A-Z a-z 0-9 _');

const conn = await mysql.createConnection({ ...server, multipleStatements: true, charset: 'utf8mb4' });
try {
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${database}\``);
  await conn.query(await fs.readFile(path.join(dir, '../db/schema.sql'), 'utf8'));
  await conn.query(await fs.readFile(path.join(dir, '../db/seed.sql'), 'utf8'));
  const [tables] = await conn.query('SHOW TABLES');
  console.log(`✔ ฐานข้อมูล "${database}" พร้อมใช้งาน (${tables.length} ตาราง)`);
} finally {
  await conn.end();
}
