# 💳 Installment Tracker

A full-stack web application for tracking product installment payments and monthly expenses. Built with Next.js and Supabase — supports multi-device sync via user authentication.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)

---

## ✨ Features

### Authentication & Security
- Email/password sign up and login
- Per-user data isolation via **Row Level Security (RLS)** — users can never access each other's data
- Session persists across devices (mobile + desktop)
- Role-based access control: **User** and **Admin**

### Dashboard
- Real-time monthly expense summary
- Breakdown by **payment method** (credit cards / cash)
- Breakdown by **platform** (Shopee 🟠, TikTok Shop 🩷, General ⚫)
- Color-coded installment cards per platform

### Installment Management (CRUD)
- Add, view, edit, and delete installment records
- Fields: product name, full price, monthly payment, total installments, current installment, payment method, platform
- **"Paid (+1 installment)"** button — increments current installment and saves instantly
- Completed installments automatically move to the **"Completed"** section
- Progress bar showing payment progress per item

### Credit Card Manager
- Add/remove personal credit cards with a description (e.g. "Online shopping", "Monthly bills")
- Cards appear automatically in the payment method dropdown when adding installments

### Admin Panel (`/admin`)
- Accessible only to users with the `admin` role
- View all registered users with stats: installment count, active items, monthly total
- Promote any user to admin or demote back to user — one click

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Database | PostgreSQL via [Supabase](https://supabase.com/) |
| Auth | Supabase Auth (email/password) |
| Font | Noto Sans Thai (Google Fonts) — full Thai language support |
| Deployment | [Vercel](https://vercel.com/) (recommended) |

---

## 🗄 Database Schema

```
auth.users          (managed by Supabase Auth)
    │
    ├── profiles         id, email, display_name, role ('user'|'admin')
    ├── credit_cards     id, user_id, name, description
    └── installments     id, user_id, product_name, full_price,
                         monthly_payment, total_installments,
                         current_installment, payment_method,
                         platform, is_completed
```

**Row Level Security** is enabled on all tables. Every query is scoped to the authenticated user's `id`. Admins have an additional policy granting full access to all rows.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js 18+](https://nodejs.org/)
- A [Supabase](https://supabase.com/) account (free tier)

### 1. Clone the repository

```bash
git clone https://github.com/nontawat0486/installment-tracker.git
cd installment-tracker
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com/)
2. Go to **SQL Editor** and run the contents of [`supabase/schema.sql`](supabase/schema.sql)
3. Copy your **Project URL** and **anon public key** from **Settings → API**

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Install dependencies and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com/) and import your repository
3. Add the two environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
4. Click **Deploy**

Your app will be live at a public URL accessible from any device.

---

## 📁 Project Structure

```
installment-tracker/
├── app/
│   ├── admin/
│   │   └── page.tsx        # Admin panel (role-protected)
│   ├── dashboard/
│   │   └── page.tsx        # Main dashboard
│   ├── login/
│   │   └── page.tsx        # Login page
│   ├── signup/
│   │   └── page.tsx        # Sign up page
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── supabase.ts         # Supabase browser client
│   └── types.ts            # TypeScript interfaces
├── supabase/
│   └── schema.sql          # Full database schema + RLS policies
├── middleware.ts
├── .env.local.example
└── SETUP.md                # Step-by-step setup guide (Thai)
```

---

## 🔒 Security Notes

- `.env.local` is excluded from version control via `.gitignore`
- All database access is controlled by Supabase RLS — server-side enforcement
- The `get_my_role()` SQL function uses `SECURITY DEFINER` to safely check roles without RLS recursion
- Auto email confirmation is enabled via a database trigger for simplified onboarding

---

## 📄 License

MIT — free to use and modify.
