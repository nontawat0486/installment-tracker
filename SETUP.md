# คู่มือติดตั้งระบบจัดการผ่อนชำระ
> สำหรับผู้ที่ไม่มีความรู้ด้าน Coding — ทำตามขั้นตอนนี้ทีละข้อ

---

## ขั้นตอนที่ 1 — ติดตั้ง Node.js

1. เปิดเบราว์เซอร์ไปที่ https://nodejs.org
2. กดปุ่ม **"LTS"** (ด้านซ้าย) เพื่อดาวน์โหลด
3. เปิดไฟล์ที่ดาวน์โหลดมาและติดตั้งตามขั้นตอน (กด Next ไปเรื่อยๆ)
4. ตรวจสอบโดยเปิด **Command Prompt** (พิมพ์ `cmd` ใน Start Menu) แล้วพิมพ์:
   ```
   node --version
   ```
   ถ้าเห็น `v20.x.x` หรือตัวเลขใดก็ได้ แสดงว่าติดตั้งสำเร็จ

---

## ขั้นตอนที่ 2 — สร้างฐานข้อมูลบน Supabase (ฟรี)

1. เปิดเบราว์เซอร์ไปที่ https://supabase.com
2. กด **"Start your project"** → สมัครด้วย GitHub หรืออีเมล
3. กด **"New project"**
   - Organization: เลือกค่าเริ่มต้น
   - Project name: `installment-tracker` (หรือชื่ออะไรก็ได้)
   - Database Password: ตั้งรหัสผ่านที่จำได้ง่าย (เก็บไว้ก่อน)
   - Region: เลือก `Southeast Asia (Singapore)`
   - กด **"Create new project"**
4. รอประมาณ 1-2 นาที จนหน้าเว็บโหลดเสร็จ

### เรียกใช้งาน SQL Schema

5. ในหน้า Supabase ด้านซ้าย คลิกไอคอน **SQL Editor** (รูปโค้ด `< >`)
6. กด **"New query"**
7. เปิดไฟล์ `supabase/schema.sql` ในโฟลเดอร์โปรเจกต์
8. **คัดลอกโค้ดทั้งหมด** ในไฟล์นั้น
9. **วาง** ลงใน SQL Editor
10. กดปุ่ม **"Run"** (หรือ Ctrl+Enter)
11. ถ้าเห็น `Success. No rows returned` แสดงว่าสำเร็จ

### คัดลอก API Keys

12. ด้านซ้าย คลิก **Settings** (ไอคอนฟันเฟือง) → **API**
13. หาส่วน **"Project URL"** — คัดลอกลิงก์ที่ขึ้นต้นด้วย `https://`
14. หาส่วน **"anon public"** ใต้ Project API Keys — คัดลอก key ยาวๆ นั้น

---

## ขั้นตอนที่ 3 — ตั้งค่าโปรเจกต์

1. เปิดโฟลเดอร์โปรเจกต์ (โฟลเดอร์ที่มีไฟล์นี้อยู่)
2. สร้างไฟล์ใหม่ชื่อ **`.env.local`** (ไม่มีนามสกุล)
3. เปิดไฟล์ด้วย Notepad แล้วพิมพ์:

   ```
   NEXT_PUBLIC_SUPABASE_URL=ใส่ Project URL ที่คัดลอกมา
   NEXT_PUBLIC_SUPABASE_ANON_KEY=ใส่ anon key ที่คัดลอกมา
   ```

   **ตัวอย่าง:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefghij.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
   ```

4. บันทึกไฟล์

---

## ขั้นตอนที่ 4 — รันโปรแกรม

1. เปิด **Command Prompt** หรือ **PowerShell**
2. `cd` เข้าไปในโฟลเดอร์โปรเจกต์:
   ```
   cd "D:\Cluade\Demo_1"
   ```
3. ติดตั้ง Dependencies (ทำครั้งเดียว):
   ```
   npm install
   ```
4. เริ่มรันโปรแกรม:
   ```
   npm run dev
   ```
5. เปิดเบราว์เซอร์ไปที่ **http://localhost:3000**
6. คุณจะเห็นหน้า Login — กด "สมัครสมาชิก" เพื่อสร้างบัญชี

> **หยุดโปรแกรม:** กด `Ctrl + C` ใน Command Prompt

---

## ขั้นตอนที่ 5 — Deploy ขึ้น Internet (ฟรี บน Vercel)

เพื่อให้เข้าใช้ได้จากมือถือหรืออุปกรณ์อื่น:

1. สร้างบัญชี GitHub ที่ https://github.com (ถ้ายังไม่มี)
2. Upload โฟลเดอร์โปรเจกต์ขึ้น GitHub (สร้าง Repository ใหม่)
3. ไปที่ https://vercel.com → สมัครด้วย GitHub
4. กด **"New Project"** → เลือก Repository ที่ Upload ไว้
5. ในส่วน **Environment Variables** เพิ่ม 2 ค่าเดียวกับใน `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. กด **Deploy**
7. Vercel จะให้ URL เช่น `https://installment-tracker-xxx.vercel.app`
8. เข้า URL นี้จากมือถือหรือคอมพิวเตอร์เครื่องไหนก็ได้!

---

## คำถามที่พบบ่อย

**Q: ข้อมูลหายไหมถ้าปิดโปรแกรม?**
A: ไม่หาย ข้อมูลเก็บใน Supabase บน Cloud ตลอดเวลา

**Q: เพื่อนสามารถดูข้อมูลของเราได้ไหม?**
A: ไม่ได้ ระบบ RLS (Row Level Security) แยกข้อมูลแต่ละ user อย่างสมบูรณ์

**Q: Supabase ฟรีได้นานแค่ไหน?**
A: Free tier รองรับโปรเจกต์ขนาดเล็ก-กลางได้ฟรีตลอด (50,000 rows, 500MB storage)

**Q: Vercel ฟรีหรือเปล่า?**
A: ฟรีสำหรับ Personal projects ตลอด

---

## โครงสร้างไฟล์

```
Demo_1/
├── app/
│   ├── dashboard/page.tsx   ← หน้า Dashboard หลัก
│   ├── login/page.tsx       ← หน้า Login
│   ├── signup/page.tsx      ← หน้าสมัครสมาชิก
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── supabase.ts          ← การเชื่อมต่อฐานข้อมูล
│   └── types.ts             ← รูปแบบข้อมูล
├── supabase/
│   └── schema.sql           ← SQL สำหรับสร้างฐานข้อมูล
├── middleware.ts             ← ระบบป้องกัน Route
├── .env.local               ← API Keys (สร้างเอง ไม่ได้รวมมา)
└── SETUP.md                 ← ไฟล์นี้
```
