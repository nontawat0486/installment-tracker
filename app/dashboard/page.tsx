'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { Installment, CreditCard, PaymentHistoryEntry } from '@/lib/types'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
} from 'recharts'

const PLATFORMS = ['ทั่วไป', 'Shopee', 'TikTok Shop', 'Lazada']

const PLATFORM_CONFIG: Record<string, { accent: string; badge: string; cardBg: string; barColor: string }> = {
  'Shopee':      { accent: 'border-l-orange-500',  badge: 'bg-orange-500 text-white',    cardBg: 'bg-orange-50/60',  barColor: 'bg-orange-500'  },
  'TikTok Shop': { accent: 'border-l-pink-500',    badge: 'bg-slate-900 text-pink-400',  cardBg: 'bg-slate-50',      barColor: 'bg-pink-500'    },
  'Lazada':      { accent: 'border-l-violet-500',  badge: 'bg-violet-600 text-white',    cardBg: 'bg-violet-50/60',  barColor: 'bg-violet-500'  },
  'ทั่วไป':     { accent: 'border-l-slate-300',   badge: 'bg-slate-200 text-slate-600', cardBg: 'bg-white',         barColor: 'bg-slate-400'   },
}

const PLATFORM_LOGO: Record<string, string> = {
  'Shopee':      '/logos/shopee.png',
  'TikTok Shop': '/logos/tiktok.png',
  'Lazada':      '/logos/lazada.png',
}

const fmt = (n: number) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(n)

// Chart colors — cycling palette for payment methods (pie)
const PIE_COLORS = ['#7C3AED','#3B82F6','#10B981','#F59E0B','#EF4444','#06B6D4','#F97316','#8B5CF6']

// Chart colors for platforms (bar)
const PLATFORM_CHART_COLOR: Record<string, string> = {
  'Shopee':      '#F97316',
  'TikTok Shop': '#EC4899',
  'Lazada':      '#7C3AED',
  'ทั่วไป':     '#94A3B8',
}

// ── Due date helpers ──────────────────────────────────
function getNextDueDate(dueDay: number): Date {
  const today = new Date()
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate()
  const daysInThisMonth = new Date(y, m + 1, 0).getDate()
  const effectiveThis  = Math.min(dueDay, daysInThisMonth)
  if (d <= effectiveThis) return new Date(y, m, effectiveThis)
  const daysInNext = new Date(y, m + 2, 0).getDate()
  return new Date(y, m + 1, Math.min(dueDay, daysInNext))
}

function getDaysUntilDue(dueDay: number): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const next  = getNextDueDate(dueDay); next.setHours(0, 0, 0, 0)
  return Math.round((next.getTime() - today.getTime()) / 86400000)
}

function getDueLabel(dueDay: number) {
  const days = getDaysUntilDue(dueDay)
  if (days < 0)   return { label: `เลยกำหนด ${Math.abs(days)} วัน`, color: 'text-red-600',    bg: 'bg-red-100',    dot: 'bg-red-500'    }
  if (days === 0) return { label: 'วันนี้!',                          color: 'text-red-600',    bg: 'bg-red-100',    dot: 'bg-red-500'    }
  if (days <= 3)  return { label: `อีก ${days} วัน`,                  color: 'text-orange-600', bg: 'bg-orange-100', dot: 'bg-orange-500' }
  if (days <= 7)  return { label: `อีก ${days} วัน`,                  color: 'text-amber-600',  bg: 'bg-amber-100',  dot: 'bg-amber-400'  }
  return           { label: `ทุกวันที่ ${dueDay}`,                    color: 'text-slate-500',  bg: 'bg-slate-100',  dot: 'bg-slate-400'  }
}
// ─────────────────────────────────────────────────────

function DueBadge({ dueDay, size = 'sm' }: { dueDay: number; size?: 'sm' | 'xs' }) {
  const due = getDueLabel(dueDay)
  if (size === 'xs') {
    return (
      <span className={`text-[10px] font-bold ${due.color}`}>{due.label}</span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${due.bg} ${due.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${due.dot}`} />
      {due.label}
    </span>
  )
}

function DueBadgePill({ dueDay }: { dueDay: number }) {
  const due = getDueLabel(dueDay)
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${due.bg} ${due.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${due.dot}`} />
      {due.label}
    </span>
  )
}

const EMPTY_FORM = {
  product_name: '', full_price: '', monthly_payment: '',
  total_installments: '', current_installment: '0',
  payment_method: 'เงินสด', platform: 'ทั่วไป',
  due_day: '',
}

export default function DashboardPage() {
  const router = useRouter()
  const [installments, setInstallments] = useState<Installment[]>([])
  const [creditCards, setCreditCards]   = useState<CreditCard[]>([])
  const [loading, setLoading]           = useState(true)
  const [userEmail, setUserEmail]       = useState('')
  const [userRole, setUserRole]         = useState<'user' | 'admin'>('user')

  const [showInstallmentModal, setShowInstallmentModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal]       = useState(false)
  const [editingInstallment, setEditingInstallment]     = useState<Installment | null>(null)
  const [showCompleted, setShowCompleted]               = useState(false)
  const [saving, setSaving]             = useState(false)
  const [form, setForm]                 = useState({ ...EMPTY_FORM })
  const [newCard, setNewCard]           = useState({ name: '', description: '' })

  // dropdown
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // confirmation modals
  const [payConfirmItem, setPayConfirmItem]     = useState<Installment | null>(null)
  const [deleteConfirmId, setDeleteConfirmId]   = useState<string | null>(null)

  // inline add-card (inside installment modal)
  const [showInlineCard, setShowInlineCard]     = useState(false)
  const [inlineCard, setInlineCard]             = useState({ name: '', description: '' })
  const [inlineCardSaving, setInlineCardSaving] = useState(false)

  const fetchData = useCallback(async () => {
    const sb = createClient()
    const [{ data: iData }, { data: cData }] = await Promise.all([
      sb.from('installments').select('*').order('created_at', { ascending: false }),
      sb.from('credit_cards').select('*').order('name'),
    ])
    setInstallments(iData ?? [])
    setCreditCards(cData ?? [])
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const sb = createClient()
        const { data: { session } } = await sb.auth.getSession()
        if (!session) { window.location.href = '/login'; return }
        setUserEmail(session.user.email ?? '')
        const { data: profile } = await sb.from('profiles').select('role').eq('id', session.user.id).single()
        if (profile) setUserRole(profile.role as 'user' | 'admin')
        await fetchData()
      } finally { setLoading(false) }
    }
    init()
  }, [fetchData])

  // close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    await createClient().auth.signOut()
    router.push('/login'); router.refresh()
  }

  const openAddModal = () => {
    setEditingInstallment(null)
    setForm({ ...EMPTY_FORM, payment_method: creditCards[0]?.name ?? 'เงินสด' })
    setShowInstallmentModal(true)
  }

  const openEditModal = (item: Installment) => {
    setEditingInstallment(item)
    setForm({
      product_name: item.product_name, full_price: item.full_price.toString(),
      monthly_payment: item.monthly_payment.toString(),
      total_installments: item.total_installments.toString(),
      current_installment: item.current_installment.toString(),
      payment_method: item.payment_method, platform: item.platform,
      due_day: item.due_day?.toString() ?? '',
    })
    setShowInstallmentModal(true)
  }

  const handleSave = async () => {
    if (!form.product_name.trim() || !form.monthly_payment || !form.total_installments) return
    setSaving(true)
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { setSaving(false); return }
    const cur = parseInt(form.current_installment) || 0
    const tot = parseInt(form.total_installments) || 1
    const payload = {
      product_name: form.product_name.trim(), full_price: parseFloat(form.full_price) || 0,
      monthly_payment: parseFloat(form.monthly_payment) || 0,
      total_installments: tot, current_installment: cur,
      payment_method: form.payment_method, platform: form.platform,
      is_completed: cur >= tot,
      due_day: parseInt(form.due_day) || null,
    }
    if (editingInstallment)
      await sb.from('installments').update(payload).eq('id', editingInstallment.id)
    else
      await sb.from('installments').insert({ ...payload, user_id: session.user.id })
    await fetchData(); setShowInstallmentModal(false); setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await createClient().from('installments').delete().eq('id', id)
    setDeleteConfirmId(null); await fetchData()
  }

  const handlePay = async (item: Installment) => {
    const n = item.current_installment + 1
    const newEntry: PaymentHistoryEntry = {
      installmentNo: n,
      paidAt: new Date().toISOString(),
    }
    const updatedHistory = [...(item.payment_history ?? []), newEntry]
    await createClient().from('installments').update({
      current_installment: n,
      is_completed: n >= item.total_installments,
      payment_history: updatedHistory,
    }).eq('id', item.id)
    setPayConfirmItem(null)
    await fetchData()
  }

  const handleAddCard = async () => {
    if (!newCard.name.trim()) return
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    await sb.from('credit_cards').insert({ name: newCard.name.trim(), description: newCard.description.trim(), user_id: session.user.id })
    setNewCard({ name: '', description: '' }); await fetchData()
  }

  const handleInlineAddCard = async () => {
    if (!inlineCard.name.trim()) return
    setInlineCardSaving(true)
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { setInlineCardSaving(false); return }
    await sb.from('credit_cards').insert({
      name: inlineCard.name.trim(),
      description: inlineCard.description.trim(),
      user_id: session.user.id,
    })
    await fetchData()
    // auto-select the new card
    setForm(f => ({ ...f, payment_method: inlineCard.name.trim() }))
    setInlineCard({ name: '', description: '' })
    setShowInlineCard(false)
    setInlineCardSaving(false)
  }

  const handleDeleteCard = async (id: string) => {
    await createClient().from('credit_cards').delete().eq('id', id); await fetchData()
  }

  const active    = installments.filter(i => !i.is_completed)
  const completed = installments.filter(i => i.is_completed)
  const totalMonthly = active.reduce((s, i) => s + i.monthly_payment, 0)

  const byCard: Record<string, number> = {}
  active.forEach(i => { byCard[i.payment_method] = (byCard[i.payment_method] || 0) + i.monthly_payment })

  const byPlatform: Record<string, number> = {}
  active.forEach(i => { byPlatform[i.platform] = (byPlatform[i.platform] || 0) + i.monthly_payment })

  const totalRemaining = active.reduce((s, i) => s + (i.total_installments - i.current_installment) * i.monthly_payment, 0)
  const alertItems  = active.filter(i => i.due_day != null && getDaysUntilDue(i.due_day!) <= 7)
  const overdueItems = active.filter(i => i.due_day != null && getDaysUntilDue(i.due_day!) < 0)

  const paymentOptions = ['เงินสด', ...creditCards.map(c => c.name)]

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 bg-violet-600 rounded-3xl mx-auto flex items-center justify-center text-3xl animate-pulse shadow-lg">💳</div>
        <p className="text-slate-500 font-medium">กำลังโหลดข้อมูล...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ── */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-slate-100">
        <div className="max-w-screen-xl mx-auto px-4 lg:px-8 py-3 flex justify-between items-center gap-3">
          <span className="text-sm font-bold text-slate-900">ผ่อนชำระ</span>

          <div className="flex items-center gap-2">
            {/* Add card button */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="btn-ghost px-3 py-2 text-sm flex items-center gap-1.5"
            >
              💳 <span className="text-xs font-semibold">เพิ่มบัตร</span>
            </button>

            {/* User avatar + dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(v => !v)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm transition-all ${
                  showDropdown ? 'bg-violet-700 ring-2 ring-violet-400 ring-offset-1' : 'bg-violet-600 hover:bg-violet-700'
                }`}
              >
                {userEmail[0]?.toUpperCase() ?? '?'}
              </button>

              {showDropdown && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl ring-1 ring-slate-100 overflow-hidden animate-pop z-30">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0">
                        {userEmail[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{userEmail}</p>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                          userRole === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {userRole.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    {userRole === 'admin' && (
                      <Link
                        href="/admin"
                        onClick={() => setShowDropdown(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-violet-700 hover:bg-violet-50 transition-colors font-medium"
                      >
                        <span>👥</span> Admin Panel
                      </Link>
                    )}
                    <button
                      onClick={() => { setShowDropdown(false); handleLogout() }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors font-semibold"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"/>
                      </svg>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 py-5 pb-24">

        {/* ── Due-Date Alert Banner ── */}
        {alertItems.length > 0 && (
          <div className="mb-4 animate-in">
            <div className={`rounded-2xl px-4 py-3 flex items-start gap-3 ${
              overdueItems.length > 0 ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
            }`}>
              <span className="text-lg shrink-0 mt-0.5">{overdueItems.length > 0 ? '🚨' : '⏰'}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${overdueItems.length > 0 ? 'text-red-700' : 'text-amber-700'}`}>
                  {overdueItems.length > 0
                    ? `มี ${overdueItems.length} รายการเลยกำหนดชำระแล้ว!`
                    : `มี ${alertItems.length} รายการใกล้ถึงวันชำระ (ภายใน 7 วัน)`}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {alertItems.map(item => {
                    const due = item.due_day != null ? getDueLabel(item.due_day) : null
                    if (!due) return null
                    return (
                      <span key={item.id}
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${due.bg} ${due.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${due.dot}`} />
                        {item.product_name} · {due.label}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">

        {/* ══════════ LEFT COLUMN (2/3) ══════════ */}
        <div className="lg:col-span-2 space-y-5">

        {/* ── Hero Summary ── */}
        <section className="animate-in">
          <div className="bg-gradient-to-br from-violet-600 via-violet-700 to-purple-800 rounded-3xl p-6 text-white shadow-xl shadow-violet-200 mb-4 relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full" />
            <div className="absolute -bottom-10 -left-6 w-32 h-32 bg-white/5 rounded-full" />
            <p className="text-violet-200 text-sm font-medium">ยอดรวมที่ต้องจ่ายเดือนนี้</p>
            <p className="text-5xl font-extrabold mt-1 tracking-tight">{fmt(totalMonthly)}</p>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-white/10" />
              <div className="text-center">
                <p className="text-violet-200 text-[11px]">ยอดคงเหลือทั้งหมด</p>
                <p className="text-xl font-bold text-white leading-tight">{fmt(totalRemaining)}</p>
              </div>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <div className="bg-white/10 rounded-xl px-3 py-1.5 text-xs font-medium">
                📦 {active.length} รายการที่กำลังผ่อน
              </div>
              {overdueItems.length > 0 && (
                <div className="bg-red-500/80 rounded-xl px-3 py-1.5 text-xs font-bold text-white animate-pulse">
                  ⚠️ เลยกำหนด {overdueItems.length} รายการ
                </div>
              )}
              {completed.length > 0 && (
                <div className="bg-white/10 rounded-xl px-3 py-1.5 text-xs font-medium">
                  ✅ {completed.length} รายการเสร็จแล้ว
                </div>
              )}
            </div>
          </div>

          {/* ── Chart Section — mobile only; desktop shows in sidebar ── */}
          {active.length > 0 && (
            <div className="lg:hidden card p-5 mt-4 animate-in">
              <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/>
                </svg>
                สัดส่วนค่าใช้จ่ายเดือนนี้
              </h3>

              <div className="grid grid-cols-2 gap-6">

                {/* ── Donut: Payment Methods ── */}
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">ช่องทางชำระ</p>
                  {Object.keys(byCard).length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie
                            data={Object.entries(byCard).map(([name, value]) => ({ name, value }))}
                            cx="50%" cy="50%"
                            innerRadius={42} outerRadius={68}
                            paddingAngle={3} dataKey="value"
                            strokeWidth={0}
                          >
                            {Object.entries(byCard).map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v: unknown) => [fmt(v as number), 'ยอด']}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '12px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>

                      {/* Legend */}
                      <div className="space-y-1.5 mt-3">
                        {Object.entries(byCard).sort((a, b) => b[1] - a[1]).map(([k, v], i) => (
                          <div key={k} className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="text-xs text-slate-600 truncate max-w-[75px]">{k}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-xs font-bold text-slate-800">{Math.round((v / totalMonthly) * 100)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-40 flex items-center justify-center text-slate-300 text-xs">ไม่มีข้อมูล</div>
                  )}
                </div>

                {/* ── Horizontal Bar: Platforms ── */}
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">แพลตฟอร์ม</p>
                  {Object.keys(byPlatform).length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart
                          layout="vertical"
                          data={Object.entries(byPlatform)
                            .sort((a, b) => b[1] - a[1])
                            .map(([name, value]) => ({ name, value }))}
                          margin={{ top: 0, right: 4, left: 0, bottom: 0 }}
                        >
                          <XAxis type="number" hide />
                          <YAxis
                            type="category" dataKey="name"
                            tick={{ fontSize: 10, fill: '#64748B' }}
                            width={62} axisLine={false} tickLine={false}
                          />
                          <Tooltip
                            formatter={(v: unknown) => [fmt(v as number), 'ยอด']}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '12px' }}
                          />
                          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                            {Object.entries(byPlatform)
                              .sort((a, b) => b[1] - a[1])
                              .map(([k], i) => (
                                <Cell key={i} fill={PLATFORM_CHART_COLOR[k] ?? '#8B5CF6'} />
                              ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>

                      {/* Platform totals */}
                      <div className="space-y-1.5 mt-3">
                        {Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              {PLATFORM_LOGO[k] && (
                                <img src={PLATFORM_LOGO[k]} alt={k} className="w-3.5 h-3.5 object-contain rounded-sm" />
                              )}
                              <span className="text-xs text-slate-600">{k}</span>
                            </div>
                            <span className="text-xs font-bold text-slate-800">{fmt(v)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-40 flex items-center justify-center text-slate-300 text-xs">ไม่มีข้อมูล</div>
                  )}
                </div>

              </div>
            </div>
          )}
        </section>

        {/* ── Active Installments ── */}
        <section className="animate-in" style={{ animationDelay: '0.05s' }}>
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">รายการกำลังผ่อน</h2>
              <p className="text-xs text-slate-400">{active.length} รายการ</p>
            </div>
            <button onClick={openAddModal} className="btn-primary flex items-center gap-1.5 px-4 py-2.5 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
              </svg>
              เพิ่มรายการ
            </button>
          </div>

          {active.length === 0 ? (
            <div className="card p-12 text-center animate-in">
              <div className="w-16 h-16 bg-slate-100 rounded-3xl mx-auto flex items-center justify-center text-3xl mb-4">📦</div>
              <p className="font-semibold text-slate-700 mb-1">ยังไม่มีรายการผ่อนชำระ</p>
              <p className="text-slate-400 text-sm mb-5">กดปุ่มเพิ่มรายการเพื่อเริ่มบันทึก</p>
              <button onClick={openAddModal} className="btn-primary px-6 py-2.5 text-sm mx-auto">
                เพิ่มรายการแรก
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {active.map((item, i) => (
                <div key={item.id} className="animate-in" style={{ animationDelay: `${i * 0.04}s` }}>
                  <InstallmentCard
                    item={item}
                    onPayRequest={() => setPayConfirmItem(item)}
                    onEdit={() => openEditModal(item)}
                    onDeleteRequest={() => setDeleteConfirmId(item.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Completed ── */}
        {completed.length > 0 && (
          <section className="animate-in" style={{ animationDelay: '0.1s' }}>
            <button
              onClick={() => setShowCompleted(v => !v)}
              className="flex items-center gap-2 w-full text-left mb-3 group"
            >
              <span className="text-sm font-bold text-slate-400 group-hover:text-slate-600 transition-colors">
                ผ่อนชำระเสร็จสิ้น
              </span>
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {completed.length}
              </span>
              <span className="text-slate-300 text-xs ml-auto">{showCompleted ? '▲' : '▼'}</span>
            </button>

            {showCompleted && (
              <div className="space-y-2">
                {completed.map(item => (
                  <div key={item.id} className="card p-4 opacity-60 flex items-center justify-between gap-3 animate-in">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center text-sm shrink-0">✅</div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-700 truncate text-sm">{item.product_name}</p>
                        <p className="text-xs text-slate-400">{item.payment_method} · {item.total_installments} งวด · {fmt(item.full_price)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${PLATFORM_CONFIG[item.platform]?.badge ?? 'bg-slate-200 text-slate-600'}`}>
                        {PLATFORM_LOGO[item.platform] && (
                          <img src={PLATFORM_LOGO[item.platform]} alt={item.platform} className="w-3 h-3 object-contain rounded-sm" />
                        )}
                        {item.platform}
                      </span>
                      <button onClick={() => setDeleteConfirmId(item.id)}
                        className="text-red-300 hover:text-red-600 hover:bg-red-50 transition-all p-1.5 rounded-xl">
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        </div> {/* end left column */}

        {/* ══════════ RIGHT SIDEBAR (1/3) — desktop only ══════════ */}
        <aside className="hidden lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-[65px]">

          {/* ── Financial Insight ── */}
          <div className="card p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">สรุปภาพรวม</h3>
                <p className="text-xs text-slate-400">สัดส่วนค่าใช้จ่ายเดือนนี้</p>
              </div>
            </div>

            {active.length > 0 ? (
              <div className="space-y-5">
                {/* Donut — payment methods */}
                {Object.keys(byCard).length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">ช่องทางชำระ</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={Object.entries(byCard).map(([name, value]) => ({ name, value }))}
                          cx="50%" cy="50%"
                          innerRadius={52} outerRadius={78}
                          paddingAngle={3} dataKey="value" strokeWidth={0}
                        >
                          {Object.entries(byCard).map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: unknown) => [fmt(v as number), 'ยอด']}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '12px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-1">
                      {Object.entries(byCard).sort((a, b) => b[1] - a[1]).map(([k, v], i) => (
                        <div key={k} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="text-xs text-slate-600 truncate max-w-[100px]">{k}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-slate-400">{fmt(v)}</span>
                            <span className="text-xs font-bold text-slate-700 w-8 text-right">
                              {Math.round((v / totalMonthly) * 100)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bar — platforms */}
                {Object.keys(byPlatform).length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">แพลตฟอร์ม</p>
                    <ResponsiveContainer width="100%" height={Math.max(100, Object.keys(byPlatform).length * 38)}>
                      <BarChart
                        layout="vertical"
                        data={Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))}
                        margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name"
                          tick={{ fontSize: 11, fill: '#64748B' }}
                          width={68} axisLine={false} tickLine={false} />
                        <Tooltip
                          formatter={(v: unknown) => [fmt(v as number), 'ยอด']}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '12px' }}
                        />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                          {Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).map(([k], i) => (
                            <Cell key={i} fill={PLATFORM_CHART_COLOR[k] ?? '#8B5CF6'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-32 flex flex-col items-center justify-center text-slate-300 gap-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
                <span className="text-xs">ยังไม่มีรายการ</span>
              </div>
            )}
          </div>

          {/* ── Upcoming Bills ── */}
          <div className="card p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">รายการที่ต้องจ่ายถัดไป</h3>
                <p className="text-xs text-slate-400">เรียงตามวันครบกำหนด</p>
              </div>
            </div>

            {active.length > 0 ? (
              <div className="space-y-1">
                {[...active]
                  .sort((a, b) => {
                    // Items with a due_day come first, sorted by days until due
                    const aDays = a.due_day != null ? getDaysUntilDue(a.due_day) : 9999
                    const bDays = b.due_day != null ? getDaysUntilDue(b.due_day) : 9999
                    if (aDays !== bDays) return aDays - bDays
                    // Tiebreak: fewest installments remaining
                    return (a.total_installments - a.current_installment) - (b.total_installments - b.current_installment)
                  })
                  .slice(0, 6)
                  .map((item) => {
                    const remaining = item.total_installments - item.current_installment
                    const isUrgent  = remaining <= 3 || (item.due_day != null && getDaysUntilDue(item.due_day!) <= 3)
                    const pct       = Math.round((item.current_installment / item.total_installments) * 100)
                    return (
                      <div key={item.id}
                        className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-50 transition-colors group">
                        {/* Platform icon */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          isUrgent ? 'bg-amber-100' : 'bg-slate-100 group-hover:bg-slate-200'
                        }`}>
                          {PLATFORM_LOGO[item.platform] ? (
                            <img src={PLATFORM_LOGO[item.platform]} alt=""
                              className="w-5 h-5 object-contain" />
                          ) : (
                            <span className="text-base">📦</span>
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{item.product_name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${isUrgent ? 'bg-amber-400' : 'bg-violet-400'}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                            <span className={`text-[10px] font-semibold shrink-0 ${isUrgent ? 'text-amber-500' : 'text-slate-400'}`}>
                              {remaining} งวด
                            </span>
                          </div>
                        </div>
                        {/* Amount */}
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-slate-700">{fmt(item.monthly_payment)}</p>
                          {item.due_day != null
                            ? <DueBadge dueDay={item.due_day} size="xs" />
                            : isUrgent && <span className="text-[10px] text-amber-500 font-bold">⚡ ใกล้หมด</span>
                          }
                        </div>
                      </div>
                    )
                  })}
                {active.length > 6 && (
                  <p className="text-center text-xs text-slate-400 pt-2">
                    และอีก {active.length - 6} รายการ
                  </p>
                )}
              </div>
            ) : (
              <div className="h-24 flex flex-col items-center justify-center text-slate-300 gap-2">
                <span className="text-2xl">✅</span>
                <span className="text-xs">ไม่มีรายการที่รอชำระ</span>
              </div>
            )}
          </div>

        </aside>

        </div> {/* end grid wrapper */}
      </main>

      {/* ── Installment Modal ── */}
      {showInstallmentModal && (
        <Modal title={editingInstallment ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'} onClose={() => { setShowInstallmentModal(false); setShowInlineCard(false); setInlineCard({ name: '', description: '' }) }}>
          <div className="space-y-4">
            <div>
              <label className="label">ชื่อสินค้า *</label>
              <input type="text" value={form.product_name} autoFocus
                onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))}
                className="input" placeholder="เช่น iPhone 16 Pro, หูฟัง Sony" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">ราคาเต็ม (฿)</label>
                <input type="number" inputMode="decimal" value={form.full_price}
                  onChange={e => setForm(f => ({ ...f, full_price: e.target.value }))}
                  className="input" placeholder="0" min="0" />
              </div>
              <div>
                <label className="label">ยอดต่อเดือน (฿) *</label>
                <input type="number" inputMode="decimal" value={form.monthly_payment}
                  onChange={e => setForm(f => ({ ...f, monthly_payment: e.target.value }))}
                  className="input" placeholder="0" min="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">งวดทั้งหมด *</label>
                <input type="number" inputMode="numeric" value={form.total_installments}
                  onChange={e => setForm(f => ({ ...f, total_installments: e.target.value }))}
                  className="input" placeholder="เช่น 12, 24" min="1" />
              </div>
              <div>
                <label className="label">จ่ายแล้ว (งวด)</label>
                <input type="number" inputMode="numeric" value={form.current_installment}
                  onChange={e => setForm(f => ({ ...f, current_installment: e.target.value }))}
                  className="input" placeholder="0" min="0" />
              </div>
            </div>
            <div>
              <label className="label">ช่องทางชำระเงิน</label>

              {/* Pill buttons */}
              <div className="flex flex-wrap gap-2 mb-2">
                {paymentOptions.map(o => (
                  <button key={o} type="button"
                    onClick={() => { setForm(f => ({ ...f, payment_method: o })); setShowInlineCard(false) }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-sm font-semibold border-2 transition-all ${
                      form.payment_method === o
                        ? 'border-violet-500 bg-violet-50 text-violet-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}>
                    {o === 'เงินสด' ? '💵' : '💳'} {o}
                  </button>
                ))}

                {/* + เพิ่มบัตร toggle */}
                <button type="button"
                  onClick={() => setShowInlineCard(v => !v)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-2xl text-sm font-semibold border-2 transition-all ${
                    showInlineCard
                      ? 'border-violet-400 bg-violet-50 text-violet-600'
                      : 'border-dashed border-slate-300 text-slate-400 hover:border-violet-400 hover:text-violet-500'
                  }`}>
                  <svg className={`w-3.5 h-3.5 transition-transform ${showInlineCard ? 'rotate-45' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
                  </svg>
                  เพิ่มบัตร
                </button>
              </div>

              {/* Inline add-card form */}
              {showInlineCard && (
                <div className="bg-violet-50 border border-violet-200 rounded-2xl p-3 space-y-2 animate-pop">
                  <p className="text-xs font-bold text-violet-600 flex items-center gap-1">💳 บัตรใหม่</p>
                  <input
                    type="text" autoFocus
                    value={inlineCard.name}
                    onChange={e => setInlineCard(c => ({ ...c, name: e.target.value }))}
                    className="input text-sm py-2"
                    placeholder="ชื่อบัตร เช่น AEON, UOB, KTC"
                  />
                  <input
                    type="text"
                    value={inlineCard.description}
                    onChange={e => setInlineCard(c => ({ ...c, description: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleInlineAddCard()}
                    className="input text-sm py-2"
                    placeholder="ใช้สำหรับอะไร (ไม่บังคับ)"
                  />
                  <div className="flex gap-2">
                    <button type="button"
                      onClick={() => { setShowInlineCard(false); setInlineCard({ name: '', description: '' }) }}
                      className="btn-ghost flex-1 py-2 text-xs border border-slate-200">
                      ยกเลิก
                    </button>
                    <button type="button"
                      onClick={handleInlineAddCard}
                      disabled={inlineCardSaving || !inlineCard.name.trim()}
                      className="btn-primary flex-1 py-2 text-xs">
                      {inlineCardSaving ? 'กำลังบันทึก...' : '+ บันทึกบัตร'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="label">วันครบกำหนดชำระ (ทุกเดือน)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number" inputMode="numeric" min="1" max="31"
                  value={form.due_day}
                  onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))}
                  className="input w-28 text-center text-lg font-bold"
                  placeholder="วันที่"
                />
                <span className="text-sm text-slate-500">
                  {form.due_day && parseInt(form.due_day) >= 1 && parseInt(form.due_day) <= 31
                    ? <DueBadgePill dueDay={parseInt(form.due_day)} />
                    : <span className="text-slate-400 text-xs">ไม่ระบุ — ข้ามช่องนี้ได้</span>}
                </span>
              </div>
            </div>
            <div>
              <label className="label">แพลตฟอร์มที่ซื้อ</label>
              <div className="grid grid-cols-4 gap-2">
                {PLATFORMS.map(p => {
                  const isSelected = form.platform === p
                  const selectedStyle =
                    p === 'Shopee'      ? 'border-orange-500 bg-orange-50 text-orange-700' :
                    p === 'TikTok Shop' ? 'border-pink-500 bg-slate-900 text-pink-300' :
                    p === 'Lazada'      ? 'border-violet-500 bg-violet-50 text-violet-700' :
                                         'border-slate-400 bg-slate-100 text-slate-700'
                  return (
                    <button key={p} type="button"
                      onClick={() => setForm(f => ({ ...f, platform: p }))}
                      className={`flex flex-col items-center gap-2 py-3 rounded-2xl text-xs font-semibold border-2 transition-all ${
                        isSelected ? selectedStyle : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                      }`}>
                      {PLATFORM_LOGO[p] ? (
                        <img src={PLATFORM_LOGO[p]} alt={p}
                          className={`w-8 h-8 object-contain rounded-lg ${p === 'TikTok Shop' && !isSelected ? 'opacity-70' : ''}`} />
                      ) : (
                        <span className="text-2xl">📦</span>
                      )}
                      <span>{p}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowInstallmentModal(false)} className="btn-ghost flex-1 py-3 border border-slate-200">ยกเลิก</button>
              <button onClick={handleSave}
                disabled={saving || !form.product_name.trim() || !form.monthly_payment || !form.total_installments}
                className="btn-primary flex-1 py-3">
                {saving ? 'กำลังบันทึก...' : editingInstallment ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Settings Modal ── */}
      {showSettingsModal && (
        <Modal title="จัดการบัตรเครดิต" onClose={() => setShowSettingsModal(false)}>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">เพิ่มบัตรใหม่</p>
              <div>
                <label className="label">ชื่อบัตร *</label>
                <input type="text" value={newCard.name} className="input"
                  onChange={e => setNewCard(c => ({ ...c, name: e.target.value }))}
                  placeholder="เช่น AEON, UOB, KTC, UCHOOSE" />
              </div>
              <div>
                <label className="label">ใช้สำหรับอะไร</label>
                <input type="text" value={newCard.description} className="input"
                  onChange={e => setNewCard(c => ({ ...c, description: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAddCard()}
                  placeholder="เช่น ช้อปปิ้งออนไลน์, ค่าใช้จ่ายประจำเดือน" />
              </div>
              <button onClick={handleAddCard} disabled={!newCard.name.trim()} className="btn-primary w-full py-2.5 text-sm">
                + เพิ่มบัตร
              </button>
            </div>

            <div className="space-y-2">
              {creditCards.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  <div className="text-3xl mb-2">💳</div>ยังไม่มีบัตรเครดิต
                </div>
              ) : creditCards.map(card => (
                <div key={card.id} className="flex items-start justify-between gap-3 p-3.5 bg-slate-50 rounded-2xl">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 bg-white shadow-sm rounded-xl flex items-center justify-center text-sm shrink-0">💳</div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">{card.name}</p>
                      {card.description && <p className="text-xs text-slate-400 truncate mt-0.5">{card.description}</p>}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteCard(card.id)}
                    className="text-red-300 hover:text-red-600 hover:bg-red-50 transition-all p-1.5 rounded-xl shrink-0">
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* ── Pay Confirmation Modal ── */}
      {payConfirmItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-pop">
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-violet-100 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-3">✅</div>
              <h3 className="font-bold text-slate-900 text-lg">ยืนยันการชำระเงิน?</h3>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                <span className="font-semibold text-slate-700">{payConfirmItem.product_name}</span>
                <br />
                งวดที่ <span className="font-bold text-violet-600">{payConfirmItem.current_installment + 1}</span>
                {' '}จาก {payConfirmItem.total_installments} งวด
                <br />
                <span className="text-base font-bold text-slate-900 mt-1 inline-block">{fmt(payConfirmItem.monthly_payment)}</span>
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPayConfirmItem(null)} className="btn-ghost flex-1 py-3 border border-slate-200">
                ยกเลิก
              </button>
              <button onClick={() => handlePay(payConfirmItem)} className="btn-primary flex-1 py-3">
                ยืนยันจ่ายแล้ว
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-pop">
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-red-100 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-3">🗑️</div>
              <h3 className="font-bold text-slate-900 text-lg">ยืนยันการลบ?</h3>
              <p className="text-slate-500 text-sm mt-1">ข้อมูลจะถูกลบถาวร ไม่สามารถกู้คืนได้</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="btn-ghost flex-1 py-3 border border-slate-200">ยกเลิก</button>
              <button onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-3 bg-red-500 text-white font-semibold rounded-2xl hover:bg-red-600 active:scale-95 transition-all">
                ลบเลย
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
    </svg>
  )
}

function InstallmentCard({ item, onPayRequest, onEdit, onDeleteRequest }: {
  item: Installment
  onPayRequest: () => void
  onEdit: () => void
  onDeleteRequest: () => void
}) {
  const [showHistory, setShowHistory] = useState(false)

  const cfg       = PLATFORM_CONFIG[item.platform] ?? PLATFORM_CONFIG['ทั่วไป']
  const logoSrc   = PLATFORM_LOGO[item.platform]
  const progress  = item.total_installments > 0 ? Math.min((item.current_installment / item.total_installments) * 100, 100) : 0
  const remaining = item.total_installments - item.current_installment
  const isAlmostDone = remaining <= 3 && remaining > 0
  const history   = [...(item.payment_history ?? [])].reverse() // newest first

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('th-TH', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  return (
    <div className={`bg-white rounded-3xl shadow-sm ring-1 ring-slate-100 overflow-hidden border-l-4 ${cfg.accent}`}>
      <div className="p-4">

        {/* ── Top row ── */}
        <div className="flex justify-between items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">

            {/* Badges */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.badge}`}>
                {logoSrc && <img src={logoSrc} alt={item.platform} className="w-3.5 h-3.5 object-contain rounded-sm" />}
                {item.platform}
              </span>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {item.payment_method}
              </span>
              {item.due_day != null && <DueBadge dueDay={item.due_day} />}
            </div>

            {/* Product name with platform logo watermark */}
            <div className="flex items-center gap-2">
              {logoSrc && (
                <img src={logoSrc} alt={item.platform}
                  className="w-7 h-7 object-contain rounded-lg shrink-0 opacity-90 shadow-sm" />
              )}
              <p className="font-bold text-slate-900 text-base truncate leading-snug">
                {item.product_name}
              </p>
            </div>

            {item.full_price > 0 && (
              <p className="text-xs text-slate-400 mt-0.5 ml-9">ราคาเต็ม {fmt(item.full_price)}</p>
            )}
          </div>

          {/* Monthly amount */}
          <div className="text-right shrink-0">
            <p className="text-2xl font-extrabold text-slate-900 leading-none">{fmt(item.monthly_payment)}</p>
            <p className="text-xs text-slate-400 mt-1">/เดือน</p>
          </div>
        </div>

        {/* ── Progress ── */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-500">
              งวดที่ <span className="font-bold text-slate-700">{item.current_installment}</span> / {item.total_installments}
            </span>
            <span className={`font-semibold ${isAlmostDone ? 'text-amber-500' : 'text-slate-400'}`}>
              {isAlmostDone && '⚡ '}เหลืออีก {remaining} งวด
            </span>
          </div>
          <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full ${cfg.barColor} rounded-full transition-all duration-700 ease-out`}
              style={{ width: `${progress}%` }} />
          </div>
          <p className="text-right text-xs font-semibold text-slate-500 mt-1">{Math.round(progress)}%</p>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-2">
          <button onClick={onPayRequest}
            className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
            </svg>
            จ่ายแล้ว (+1 งวด)
          </button>
          <button onClick={onEdit}
            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all text-sm">
            ✏️
          </button>
          <button onClick={onDeleteRequest}
            className="w-10 h-10 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-100 rounded-2xl transition-all">
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* ── Payment History Accordion ── */}
      <div className="border-t border-slate-100">
        <button
          onClick={() => setShowHistory(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            ประวัติการชำระ
            {history.length > 0 && (
              <span className="bg-violet-100 text-violet-600 font-bold px-1.5 py-0.5 rounded-full text-[10px]">
                {history.length}
              </span>
            )}
          </span>
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${showHistory ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7"/>
          </svg>
        </button>

        {showHistory && (
          <div className="px-4 pb-4 space-y-2 animate-in">
            {history.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">ยังไม่มีประวัติการชำระ</p>
            ) : (
              history.map((entry, i) => (
                <div key={i}
                  className="flex items-center justify-between bg-slate-50 rounded-2xl px-3 py-2"
                  style={{ animationDelay: `${i * 0.03}s` }}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${cfg.barColor}`}>
                      {entry.installmentNo}
                    </div>
                    <span className="text-xs font-semibold text-slate-700">
                      งวดที่ {entry.installmentNo}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{fmtDate(entry.paidAt)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl animate-in">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl sm:rounded-t-3xl z-10">
          <h3 className="font-bold text-slate-900 text-base">{title}</h3>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors text-xl leading-none">
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
