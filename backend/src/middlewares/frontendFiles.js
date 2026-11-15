// เสิร์ฟหน้าเว็บ frontend โดยกันไม่ให้มือถือ/Cloudflare ใช้ไฟล์ .js/.css เก่าค้างไว้หลังอัปเดตโค้ด
// - หน้า .html: เติม ?v=<เวลาแก้ไฟล์ล่าสุด> ท้ายลิงก์ .js/.css ทุกไฟล์ของเรา → แก้ไฟล์เมื่อไร URL เปลี่ยน ต้องโหลดใหม่ทันที
//   (Cloudflare ตั้ง cache ไฟล์ .js/.css ไว้ 4 ชั่วโมง ถ้าไม่ทำแบบนี้คนขับจะเห็นหน้าเก่าหรือหน้าเพี้ยนหลัง deploy)
// - ไฟล์อื่น: Cache-Control: no-cache = ใช้ของใน cache ได้ แต่ต้องถาม server ก่อนทุกครั้งว่าเปลี่ยนไหม
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';

const NO_CACHE = 'no-cache';
const ASSET_RE = /(<(?:script|link)\b[^>]*?\b(?:src|href)=")([^"?#]+\.(?:js|css))(")/gi;

/**
 * @param {Record<string, string>} mounts  URL prefix (ลงท้าย /) → โฟลเดอร์บนเครื่อง เช่น { '/driver/': '.../frontend/driver' }
 * @returns {(prefix: string) => import('express').RequestHandler}  ใช้แทน express.static ของแต่ละ prefix
 */
export function createFrontend(mounts) {
  const toFile = (url, pageDir) => {
    if (/^[a-z]+:|^\/\//i.test(url)) return null;                       // ไฟล์จากเว็บอื่น (เช่น Google Fonts) ไม่ยุ่ง
    if (!url.startsWith('/')) return path.join(pageDir, url);
    const prefix = Object.keys(mounts).find((p) => url.startsWith(p));
    return prefix ? path.join(mounts[prefix], url.slice(prefix.length)) : null;
  };

  const version = (file) => {
    try { return Math.floor(fs.statSync(file).mtimeMs).toString(36); } catch { return null; }
  };

  return (prefix) => {
    const dir = mounts[prefix];
    const files = express.static(dir, { index: false, setHeaders: (res) => res.setHeader('Cache-Control', NO_CACHE) });

    return (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      let rel;
      try { rel = decodeURIComponent(req.path); } catch { return next(); }
      const page = rel.endsWith('/') ? rel + 'index.html' : rel;
      if (!page.endsWith('.html')) return files(req, res, next);

      const file = path.join(dir, path.normalize(page));
      if (!file.startsWith(dir + path.sep)) return next();                // กัน ../ ออกนอกโฟลเดอร์
      fs.readFile(file, 'utf8', (err, html) => {
        if (err) return next();
        const out = html.replace(ASSET_RE, (m, head, url, tail) => {
          const target = toFile(url, path.dirname(file));
          const v = target && version(target);
          return v ? `${head}${url}?v=${v}${tail}` : m;
        });
        res.setHeader('Cache-Control', NO_CACHE);
        res.type('html').send(out);
      });
    };
  };
}
