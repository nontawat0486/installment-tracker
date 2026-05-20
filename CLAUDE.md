# CLAUDE.md — Project Memory for Installment Tracker

## Project Overview
Full-stack Thai-language web app for tracking installment payments.
Users log in, record products they're paying off in installments, and see a monthly expense dashboard.

**Live repo:** https://github.com/nontawat0486/installment-tracker

---

## Environment — CRITICAL

| Item | Value |
|------|-------|
| OS | **Windows** — always use `PowerShell` tool, never `Bash` |
| npm/node | PATH must be refreshed before every npm command |
| Project root | `D:\Cluade\Demo_1` |

**Always prepend npm/node commands with PATH refresh:**
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User"); cd "D:\Cluade\Demo_1"; npm ...
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 App Router (`'use client'` on all pages) |
| Language | TypeScript |
| Styling | Tailwind CSS + custom classes in `globals.css` |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth — always use `getSession()` NOT `getUser()` |
| Charts | Recharts |
| Font | Noto Sans Thai (Google Fonts) |

---

## Supabase

- **Project ID:** `uxpcvrjelqavfsrmculr`
- **URL:** `https://uxpcvrjelqavfsrmculr.supabase.co`
- **Anon key:** in `.env.local` (never commit this file)
- Auth redirect: use `window.location.href` — NOT `router.push()` (avoids cookie race condition)
- MCP tools are **deferred** — must run `ToolSearch` before first use each session

**Tables:**
```
auth.users          (Supabase managed)
profiles            id, email, display_name, role ('user'|'admin'), created_at, updated_at
credit_cards        id, user_id, name, description, created_at
installments        id, user_id, product_name, full_price, monthly_payment,
                    total_installments, current_installment, payment_method,
                    platform, is_completed, payment_history JSONB, created_at, updated_at
```

**Key SQL functions:**
- `get_my_role()` — SECURITY DEFINER, avoids RLS recursion
- `auto_confirm_email` trigger — bypasses email confirmation (no SMTP needed)

---

## File Structure

```
app/
  dashboard/page.tsx   ← Main dashboard (LARGE ~850 lines — read with offset/limit)
  login/page.tsx
  signup/page.tsx
  admin/page.tsx
lib/
  supabase.ts          ← createBrowserClient wrapper
  types.ts             ← All TypeScript interfaces
public/
  logos/               ← shopee.png, tiktok.png, lazada.png
supabase/
  schema.sql           ← Reference schema
```

---

## Design System (`globals.css`)

**Component classes:**
```css
.label        — form labels
.input        — all text inputs / selects
.btn-primary  — violet filled button
.btn-ghost    — transparent hover button
.card         — white rounded-3xl shadow-sm ring-1 ring-slate-100
```

**Animations:**
```css
.animate-in   — fadeSlideIn (0.3s)
.animate-pop  — scale pop (0.2s)
```

**Color palette:**
- Primary: `violet-600`
- Shopee: `orange-500`
- TikTok Shop: `slate-900` + `pink-400`
- Lazada: `violet-600`
- General: `slate-200`

**Platform config:** `PLATFORM_CONFIG` and `PLATFORM_LOGO` maps in `dashboard/page.tsx`

---

## Dashboard Layout

**Desktop (lg+):** Two-column grid (`lg:grid-cols-3`)
- Left (`lg:col-span-2`): Hero card + Installment cards + Completed section
- Right sidebar (`hidden lg:flex`, sticky): Financial Insight charts + Upcoming Bills

**Mobile:** Single column. Chart section shows in left column (`lg:hidden`). Sidebar hidden.

**Header:** `max-w-screen-xl` — user avatar dropdown (email, role, admin link, logout)

---

## Common Patterns

**Auth check (client-side):**
```typescript
const { data: { session } } = await supabase.auth.getSession()
if (!session) { window.location.href = '/login'; return }
```

**Redirect after auth:**
```typescript
window.location.href = '/dashboard'  // hard redirect — avoids Next.js router cookie issues
```

**Payment history (JSONB array in installments table):**
```typescript
const newEntry: PaymentHistoryEntry = { installmentNo: n, paidAt: new Date().toISOString() }
const updatedHistory = [...(item.payment_history ?? []), newEntry]
await supabase.from('installments').update({ payment_history: updatedHistory }).eq('id', item.id)
```

---

## Workflow Rules (Learned from Session)

### File Editing
- **Always use `Edit` (targeted diff), NOT `Write` (full rewrite)** — unless creating a new file
- For large files (dashboard), use `Read` with `offset` + `limit` to read only the relevant section
- Never read the same file twice if Edit/Write succeeded — the tool confirms changes

### Token Efficiency
- Read only the section you need, not the whole file
- Load all MCP tools in one `ToolSearch` call, not one at a time
- Group independent tool calls in a single message (parallel execution)
- When using Supabase MCP: load schema once, do all DB operations before session ends

### Git
- Commit message format: `feat:` / `fix:` / `refactor:` / `style:`
- Always stage specific files, not `git add -A`
- Append `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- Push with: `git push` (credential helper configured via `gh auth setup-git`)

### Supabase MCP
- Project ID is always `uxpcvrjelqavfsrmculr`
- Use `apply_migration` for DDL (CREATE TABLE, ALTER TABLE)
- Use `execute_sql` for data queries / ad-hoc checks

### Logos / Static Assets
- Source logos live in `D:\Cluade\Demo_1\logo\`
- Served files must be in `D:\Cluade\Demo_1\public\logos\`
- Copy with PowerShell: `Copy-Item "logo\X.png" "public\logos\X.png"`

---

## Admin Account
- Email: `admin@admin.com`
- Role: `admin` (set in `profiles` table)
- Admin panel: `/admin` — role-gated, shows all users + stats + role toggle
