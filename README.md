# TruckQ · ระบบจัดคิวรถรับสินค้า

## โครงสร้างโปรเจกต์

```
TruckQueue/
├── start-all.bat                 เปิดระบบ (ใช้ไฟล์เดียวกันทั้งเครื่อง dev และ server)
├── deploy.bat                    เครื่อง dev: ส่งโค้ดที่แก้เสร็จขึ้น server (เลื่อน branch release)
├── auto-update.bat               เครื่อง server: เช็ก branch release ทุก 60 วินาที แล้วอัปเดตโค้ดให้เอง
├── frontend/                     หน้าจอ (HTML/CSS/JS ล้วน ไม่ต้อง build) · เปิดผ่าน backend ที่เดียว
│   ├── shared/
│   │   ├── common.js             โค้ดที่ทุกหน้าใช้ร่วมกัน: รูปแบบทะเบียนรถ, แสดงทะเบียน "หัว | หาง"
│   │   └── api.js                รวมการเรียก API ทุกเส้น (axios) ไว้ที่ไฟล์เดียว
│   ├── driver-app/               หน้าคนขับ (/driver): ลงทะเบียน รับคิว ดูสถานะ
│   │   ├── index.html · style.css · manifest.webmanifest · icon.svg
│   │   ├── app.js                ฟอร์ม บัตรคิว เช็กสถานะทุก 5 วินาที
│   │   ├── alarm.js              เตือนเมื่อถึงคิว: ไซเรนดังวน หน้าจอเตือน แจ้งเตือน กันจอดับ
│   │   └── sw.js                 service worker: รับ Web Push แม้ปิดเบราว์เซอร์
│   └── staff-app/                หน้าพนักงาน (/staff) · ใช้ได้ทั้งคอมและมือถือ
│       ├── index.html · style.css
│       ├── app.js                เรียกคิว + จองคิวที่เคาน์เตอร์ + Dashboard
│       └── analytics.html/.js/.css   หน้าวิเคราะห์แบบละเอียด (/staff/analytics.html)
│
└── backend/                      API (Node.js + Express) ต่อ MariaDB
    ├── .env                      ค่าของเครื่องนี้: DB, tunnel, กุญแจ push (ไม่ขึ้น git)
    ├── .env.example              ตัวอย่าง .env (ขึ้น git)
    ├── scripts/
    │   ├── reset-data.js         ล้างคิว (และคนขับ) เริ่มเลขคิวใหม่ที่ 0001
    │   └── push-keys.js          สร้างกุญแจ Web Push ลง .env
    └── src/
        ├── server.js             จุดเริ่มต้น (npm start)
        ├── app.js                ประกอบ Express: middleware → frontend → API → error
        ├── config/               env.js (อ่าน .env) · database.js (connection pool, ทรานแซกชัน)
        ├── middlewares/          requestLogger · errorHandler · requireStaff (ด่าน login พนักงาน)
        ├── utils/                AppError · helpers (ตัดช่องว่าง, token) · plate (รูปแบบทะเบียนรถ)
        ├── routes/index.js       รวม API ทั้งหมด ดูไฟล์นี้ไฟล์เดียวรู้ว่ามี API อะไร
        └── modules/              แยกตามระบบงาน
            ├── company/          บริษัทขนส่ง
            ├── destination/      ปลายทาง
            ├── driver/           คนขับ (เติมข้อมูลจากเบอร์, เปิด/ปิดสิทธิ์)
            ├── dock/             จุดรับสินค้า (กระดานสถานะ, เรียกคิวถัดไป)
            ├── report/           สรุปตัวเลข Dashboard วันนี้
            ├── analytics/        วิเคราะห์ย้อนหลัง: ช่วงเวลาที่รถเยอะ · ส่งไปไหน · เวลาหายไปไหน
            ├── push/             Web Push: ส่งแจ้งเตือนถึงคิว + ส่งซ้ำจนกว่าคนขับจะรับทราบ
            └── queue/            คิว (งานหลัก)
                ├── queue.routes.js      เส้นทาง API
                ├── queue.controller.js  ตรวจข้อมูลที่ส่งมา
                ├── queue.service.js     ทำงานกับฐานข้อมูล
                ├── queue.status.js      สถานะคิวและลำดับขั้น
                └── queue.estimate.js    ประมาณเวลาที่จะถูกเรียก
```

## กติกาของระบบ

- **จุดรับสินค้า:** รถทุกคันเข้าได้ทุกจุด จุดไหนว่างพนักงานกด "เรียกคิวถัดไป" ระบบจะเรียกคันที่รอนานที่สุดตามลำดับคิวเสมอ
- **ทะเบียนรถ:** กรอก 2 ช่อง คือ **ทะเบียนหัว** และ **ทะเบียนหาง** รูปแบบป้ายรถบรรทุก `เลขหมวด 2 หลัก-เลขทะเบียน 1–4 หลัก` เช่น `70-1234` (ไม่ต้องใส่จังหวัด) · พิมพ์แค่ตัวเลข ระบบใส่ขีดให้เอง · ทะเบียนผิดรูปแบบรับคิวไม่ได้ · แสดงคู่กันเป็น `70-1234 | 71-5678`
- กติกาทะเบียนอยู่ 2 ที่ ต้องแก้ให้ตรงกัน: `backend/src/utils/plate.js` (ตรวจจริง) และ `frontend/shared/common.js` (ช่วยกรอก)

**ลำดับการทำงานของ backend:** คำขอเข้ามา → `routes/index.js` → `modules/<ระบบ>/*.routes.js` → controller (ตรวจข้อมูล) → service (ทำงานกับฐานข้อมูล) → ถ้าผิดพลาด service โยน `AppError` แล้ว `errorHandler` แปลงเป็น `{ error }` ส่งกลับ

## วิธีรัน

1. ครั้งแรกของเครื่องนั้น: คัดลอก `backend/.env.example` เป็น `backend/.env` แล้วใส่ค่าของเครื่องนั้น (ดูหัวข้อ "ใช้ 2 เครื่อง" ด้านล่าง)
2. ดับเบิลคลิก **`start-all.bat`** · ติดตั้งแพ็กเกจให้เอง เปิด backend และเปิด tunnel ถ้าเครื่องนั้นตั้ง `TUNNEL_NAME` ไว้
   (หรือรันเอง: `cd backend` → `npm install` → `npm start`)
3. เปิดหน้าเว็บ
   - หน้าคนขับ: http://localhost:3000/driver/
   - หน้าพนักงาน: http://localhost:3000/staff/ (จองคิว: `/staff/#book` · Dashboard: `/staff/#dashboard`)

   มือถือใน Wi-Fi เดียวกันใช้ IP ที่ backend พิมพ์ไว้ตอนเริ่มแทน `localhost` เช่น `http://192.168.1.20:3000/staff/`

### ใช้ 2 เครื่อง: เครื่อง dev → GitHub → เครื่อง server
โค้ดเหมือนกันทั้งสองเครื่องผ่าน git ส่วนค่าที่ต่างกัน (IP ฐานข้อมูล, รหัสผ่าน, tunnel) อยู่ใน `backend/.env` ของแต่ละเครื่อง ซึ่งไม่ขึ้น git จึง sync แล้วไม่ทับกัน

| ค่าใน `.env` | เครื่อง dev | เครื่อง server |
|---|---|---|
| `DB_HOST` / `DB_PORT` | ที่อยู่ที่ต่อถึง DB ของ server (เช่น DDNS + พอร์ตที่เปิดไว้) | `127.0.0.1` / `3306` |
| `DB_USER` / `DB_PASSWORD` | user ที่อนุญาตให้ต่อจากภายนอก | user ในเครื่อง |
| `PUBLIC_URL` | เว้นว่าง | `https://truckq.natt-server.online` |
| `TUNNEL_NAME` | เว้นว่าง (ไม่เปิด tunnel) | `TruckQueue` |
| `VAPID_*` | **ชุดเดียวกับ server** ถ้าใช้ DB เดียวกัน | สร้างครั้งเดียวด้วย `npm run push:keys` |
| `AUTO_UPDATE` | เว้นว่าง | `1` (อัปเดตโค้ดเองเมื่อมีการ deploy) |

GitHub มี 2 branch: **`main`** = งานล่าสุดของเครื่อง dev (push ได้ตลอด ไม่กระทบ server) · **`release`** = โค้ดที่ server ใช้งานจริง

ขั้นตอนทุกครั้ง:
1. เครื่อง dev: แก้โค้ด → ทดสอบที่ `localhost` → commit → push ได้ตามสะดวก (สำรองงาน ยังไม่ขึ้น server)
2. แก้เสร็จพร้อมใช้งาน: ดับเบิลคลิก **`deploy.bat`** → แสดงรายการที่จะขึ้น → กด `Y` → push `main` และเลื่อน `release` มาที่ commit เดียวกัน
3. เครื่อง server: `auto-update.bat` (start-all.bat เปิดให้เองเมื่อ `AUTO_UPDATE=1`) เช็ก `release` ทุก 60 วินาที เจอของใหม่ก็สลับโค้ดให้ · backend รีสตาร์ตเอง (`npm start` ใช้ `--watch`) · ถ้า `package.json` เปลี่ยนจะ `npm install` ให้ก่อน · ประวัติอยู่ที่ `_server/update.log`
   - ถ้ามีคนแก้ไฟล์บนเครื่อง server ตรงๆ จะ**ไม่อัปเดต**ทับ (บันทึก `[skip]` ใน log) · เปิด `git status` ที่ server แล้วย้อนการแก้ (`git checkout -- .`) หรือย้ายไปแก้ที่เครื่อง dev แทน
   - ถ้า `start-all.bat` เองเปลี่ยน ให้ปิดหน้าต่าง backend/tunnel/updater แล้วเปิด `start-all.bat` ใหม่
4. แก้โครงสร้างฐานข้อมูล: ทำที่ฐานข้อมูลของ server (ทั้งสองเครื่องใช้ DB เดียวกัน) · ถ้าโค้ดใหม่ต้องใช้ตาราง/คอลัมน์ใหม่ ให้แก้ DB ก่อนรัน `deploy.bat`

ตั้งค่าเครื่อง server ครั้งแรก (ครั้งเดียว): pull โค้ดล่าสุด → ใส่ `AUTO_UPDATE=1` ใน `backend/.env` → ปิดหน้าต่าง TruckQueue ที่เปิดอยู่ → เปิด `start-all.bat` ใหม่ (จะสลับไป branch `release` และเปิดหน้าต่าง "TruckQueue Updater" ย่อไว้)

ย้อนกลับเวอร์ชันก่อนหน้าแบบด่วน (ที่เครื่อง dev): `git push --force origin <commit เดิม>:release` · server จะสลับกลับภายใน 1 นาที

### ล้างข้อมูล (เริ่มใช้ระบบใหม่ / หลังทดสอบ) · ลบแล้วกู้คืนไม่ได้
```bash
npm run db:reset -- --yes
```
ลบคิวทั้งหมดและประวัติการกด เลขคิวเริ่มใหม่ที่ 0001 · เพิ่ม `--drivers` ถ้าจะลบรายชื่อคนขับด้วย · ไม่แตะบริษัท ปลายทาง และจุดรับสินค้า

### แจ้งเตือนถึงคิว (Web Push) · เด้งถึงมือถือคนขับแม้ปิดเบราว์เซอร์
```bash
npm run push:keys
```
สร้างกุญแจ VAPID ลงใน `.env` ครั้งเดียวที่เครื่อง server แล้วคัดลอกไปใส่ `.env` ของเครื่อง dev · รีสตาร์ตเซิร์ฟเวอร์หลังใส่กุญแจ · ถ้าไม่มีกุญแจ ระบบอื่นใช้ได้ปกติ แค่ไม่ส่ง push
- **ต้องเปิดหน้าคนขับผ่าน https** (หรือ localhost) ถ้าเปิดด้วย `http://192.168.x.x` เบราว์เซอร์จะไม่ยอมให้สมัครรับแจ้งเตือน
- คนขับต้องกด "อนุญาต" แจ้งเตือน (ถามตอนกดยืนยันรับคิว หรือกดปุ่ม "เปิดเสียงและแจ้งเตือน" บนบัตรคิว)
- **iPhone (iOS 16.4+)** ต้องกด แชร์ → "เพิ่มไปยังหน้าจอโฮม" แล้วเปิดจากไอคอน TruckQ ก่อน จึงจะรับแจ้งเตือนได้
- พนักงานกดเรียกคิว → ส่งแจ้งเตือนทันที และส่งซ้ำทุก 30 วินาที (สูงสุด 10 ครั้ง) จนกว่าคนขับจะกด "รับทราบ" · หน้าพนักงานแสดงว่าคนขับรับทราบแล้วหรือยัง
- เสียงตอนปิดเบราว์เซอร์เป็นเสียงแจ้งเตือนปกติของโทรศัพท์ ถ้าเปิดหน้าเว็บค้างไว้จะได้ไซเรนดังวนจนกว่าจะกดรับทราบ
- การส่งซ้ำอยู่ในหน่วยความจำของเซิร์ฟเวอร์ ถ้ารีสตาร์ตเซิร์ฟเวอร์ระหว่างนั้น การส่งซ้ำของคิวที่กำลังเรียกอยู่จะหยุด

## ฐานข้อมูล (`truckqueue_db`)

| ตาราง | เก็บอะไร |
|---|---|
| `company` | บริษัทขนส่ง |
| `destination` | ปลายทาง |
| `driver` | คนขับ 1 คน 1 แถว · `status` = `active` รับคิวได้ / `inactive` ออกจากงาน-ปิดสิทธิ์ |
| `dock` | จุดรับสินค้า + เวลามาตรฐาน |
| `queue` | คิว 1 แถว = รถ 1 คัน 1 รอบ · ทะเบียนหัว/หาง (`plate_no` / `trailer_plate`), ปลายทาง (บังคับทุกช่อง), สถานะ, เวลาทุกขั้น |
| `queue_event` | ประวัติทุกการกด (ใครทำอะไร ตอนไหน) |
| `push_subscription` | ที่อยู่ส่งแจ้งเตือน Web Push ไปยังมือถือที่ถือคิวนั้น (1 คิว : 1 เครื่อง) · ลบตามเมื่อลบคิว |

**สถานะคิว:** `waiting` รอคิว → `called` กำลังเรียก → `loading` กำลังเข้าโหลด → `done` โหลดเสร็จ → `exited` ออกแล้ว · `cancelled` ยกเลิก
เลขคิวรันต่อเนื่อง ไม่เริ่มใหม่ทุกวัน (0001, 0002, ...)

## API

### ฝั่งคนขับ
| Method | Path | ใช้ทำอะไร |
|---|---|---|
| GET | `/api/companies` | รายชื่อบริษัทขนส่ง |
| GET | `/api/destinations` | รายการปลายทาง |
| GET | `/api/drivers/lookup?phone=` | เติมชื่อ นามสกุล บริษัทจากเบอร์ (คนขับ inactive ตอบ `inactive: true` ไม่ส่งชื่อ) |
| POST | `/api/queues` | ลงทะเบียน `{phone, first_name, last_name, company_id, plate_no, trailer_plate, destination_id}` (บังคับทุกช่อง · ทะเบียนรูปแบบ `70-1234` · ปลายทางมีตัวเลือก "ไม่ระบุ") → `{id, token, queue_no}` |
| GET | `/api/queues/:id?token=` | สถานะคิว จำนวนคันก่อนหน้า เวลาที่คาดว่าจะถูกเรียก |
| POST | `/api/queues/:id/cancel` | คนขับยกเลิกคิวเอง `{token}` |
| POST | `/api/queues/:id/ack` | คนขับกด "รับทราบ" ว่าถึงคิวแล้ว `{token}` → บันทึก `driver_ack_at` และหยุดส่งแจ้งเตือนซ้ำ |
| GET | `/api/push/public-key` | กุญแจสาธารณะสำหรับสมัคร Web Push (`null` = ยังไม่ได้ตั้งกุญแจ) |
| POST | `/api/queues/:id/push` | สมัครรับแจ้งเตือนถึงคิว `{token, subscription}` |

### ฝั่งพนักงาน (ยังไม่มี login · ด่านอยู่ที่ `middlewares/requireStaff.js`)
| Method | Path | ใช้ทำอะไร |
|---|---|---|
| GET | `/api/staff/board` | สถานะทุกจุดรับสินค้า, คิวที่รอ (พร้อมเวลาคาดว่าจะเรียก), คิวที่โหลดเสร็จรอออก |
| GET | `/api/staff/dashboard` | ภาพรวมวันนี้: จำนวนรถแต่ละสถานะ, เวลาเฉลี่ย, แยกจุดรับสินค้า, รายชั่วโมง |
| GET | `/api/staff/analytics?days=7\|30\|90` | วิเคราะห์ย้อนหลัง: วัน×ชั่วโมงที่รถมาถึง, จำนวนต่อปลายทาง, เวลาเฉลี่ยแต่ละช่วงแยกจุดรับสินค้า |
| POST | `/api/staff/docks/:id/call-next` | เรียกคิวถัดไป (คันที่รอนานสุด) เข้าจุดรับสินค้านี้ |
| POST | `/api/staff/queues/:id/start` | กำลังเรียก → กำลังเข้าโหลด |
| POST | `/api/staff/queues/:id/finish` | กำลังเข้าโหลด → โหลดเสร็จ |
| POST | `/api/staff/queues/:id/exit` | โหลดเสร็จ → ออกแล้ว |
| POST | `/api/staff/queues/:id/skip` | กำลังเรียก → รอคิว (ไปต่อท้าย) |
| POST | `/api/staff/queues/:id/cancel` | รอคิว / กำลังเรียก → ยกเลิก |
| PATCH | `/api/staff/drivers/:id/status` | `{status: 'active' \| 'inactive'}` เปิด/ปิดสิทธิ์รับคิว |

ทดสอบด้วย PowerShell เช่น
```powershell
Invoke-RestMethod -Method Post http://localhost:3000/api/staff/docks/1/call-next
```
