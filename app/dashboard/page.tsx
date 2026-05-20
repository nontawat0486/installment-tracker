'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Installment, CreditCard } from '@/lib/types'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const PLATFORMS = ['ทั่วไป', 'Shopee', 'TikTok Shop']

const PLATFORM_CONFIG: Record<string, { accent: string; badge: string; cardBg: string; barColor: string }> = {
  'Shopee':     { accent: 'border-l-orange-500', badge: 'bg-orange-500 text-white',      cardBg: 'bg-orange-50/60',  barColor: 'bg-orange-500' },
  'TikTok Shop':{ accent: 'border-l-pink-500',   badge: 'bg-slate-900 text-pink-400',    cardBg: 'bg-slate-50',     barColor: 'bg-pink-500'   },
  'ทั่วไป':    { accent: 'border-l-slate-300',   badge: 'bg-slate-200 text-slate-600',   cardBg: 'bg-white',        barColor: 'bg-violet-500' },
}

const fmt = (n: number) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(n)

const EMPTY_FORM = {
  product_name: '', full_price: '', monthly_payment: '',
  total_installments: '', current_installment: '0',
  payment_method: 'เงินสด', platform: 'ทั่วไป',
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
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [form, setForm]                 = useState({ ...EMPTY_FORM })
  const [newCard, setNewCard]           = useState({ name: '', description: '' })

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
    await createClient().from('installments').update({
      current_installment: n, is_completed: n >= item.total_installments,
    }).eq('id', item.id)
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
        <div className="max-w-2xl mx-auto px-4 py-3 flex justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
              {userEmail[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">ผ่อนชำระ</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${userRole === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
                  {userRole.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[160px]">{userEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {userRole === 'admin' && (
              <Link href="/admin" className="btn-ghost px-3 py-2 text-sm text-violet-600 hover:bg-violet-50">
                👥
              </Link>
            )}
            <button onClick={() => setShowSettingsModal(true)} className="btn-ghost px-3 py-2 text-sm">⚙️</button>
            <button onClick={handleLogout} className="btn-ghost px-3 py-2 text-sm text-red-500 hover:bg-red-50">ออก</button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-6 pb-24">

        {/* ── Hero Summary ── */}
        <section className="animate-in">
          <div className="bg-gradient-to-br from-violet-600 via-violet-700 to-purple-800 rounded-3xl p-6 text-white shadow-xl shadow-violet-200 mb-4 relative overflow-hidden">
            {/* decorative circles */}
            <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full" />
            <div className="absolute -bottom-10 -left-6 w-32 h-32 bg-white/5 rounded-full" />
            <p className="text-violet-200 text-sm font-medium">ยอดรวมที่ต้องจ่ายเดือนนี้</p>
            <p className="text-5xl font-extrabold mt-1 tracking-tight">{fmt(totalMonthly)}</p>
            <div className="flex items-center gap-4 mt-4">
              <div className="bg-white/10 rounded-xl px-3 py-1.5 text-xs font-medium">
                📦 {active.length} รายการที่กำลังผ่อน
              </div>
              {completed.length > 0 && (
                <div className="bg-white/10 rounded-xl px-3 py-1.5 text-xs font-medium">
                  ✅ {completed.length} รายการเสร็จแล้ว
                </div>
              )}
            </div>
          </div>

          {/* Breakdown cards */}
          {(Object.keys(byCard).length > 0 || Object.keys(byPlatform).length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {/* By payment */}
              <div className="card p-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">ช่องทางชำระ</p>
                <div className="space-y-2.5">
                  {Object.entries(byCard).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                    <div key={k}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 font-medium truncate max-w-[70px]">{k}</span>
                        <span className="text-slate-900 font-bold">{fmt(v)}</span>
                      </div>
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(v / totalMonthly) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* By platform */}
              <div className="card p-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">แพลตฟอร์ม</p>
                <div className="space-y-2.5">
                  {Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                    <div key={k}>
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLATFORM_CONFIG[k]?.badge ?? 'bg-slate-200 text-slate-600'}`}>{k}</span>
                        <span className="text-slate-900 text-xs font-bold">{fmt(v)}</span>
                      </div>
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${PLATFORM_CONFIG[k]?.barColor ?? 'bg-slate-400'} rounded-full`}
                          style={{ width: `${(v / totalMonthly) * 100}%` }} />
                      </div>
                    </div>
                  ))}
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
                  <InstallmentCard item={item} onPay={() => handlePay(item)}
                    onEdit={() => openEditModal(item)} onDeleteRequest={() => setDeleteConfirmId(item.id)} />
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
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLATFORM_CONFIG[item.platform]?.badge ?? 'bg-slate-200 text-slate-600'}`}>
                        {item.platform}
                      </span>
                      <button onClick={() => setDeleteConfirmId(item.id)}
                        className="text-slate-300 hover:text-red-400 transition-colors p-1">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ── Installment Modal ── */}
      {showInstallmentModal && (
        <Modal title={editingInstallment ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'} onClose={() => setShowInstallmentModal(false)}>
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
              <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} className="input">
                {paymentOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="label">แพลตฟอร์มที่ซื้อ</label>
              <div className="grid grid-cols-3 gap-2">
                {PLATFORMS.map(p => (
                  <button key={p} type="button"
                    onClick={() => setForm(f => ({ ...f, platform: p }))}
                    className={`py-2.5 rounded-2xl text-sm font-semibold border-2 transition-all ${form.platform === p
                      ? p === 'Shopee' ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : p === 'TikTok Shop' ? 'border-pink-500 bg-pink-50 text-pink-700'
                        : 'border-violet-500 bg-violet-50 text-violet-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
                    {p === 'Shopee' ? '🛍️' : p === 'TikTok Shop' ? '🎵' : '📦'} {p}
                  </button>
                ))}
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
                  <button onClick={() => handleDeleteCard(card.id)} className="text-slate-300 hover:text-red-400 transition-colors shrink-0 p-1">🗑️</button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delete Confirm ── */}
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

function InstallmentCard({ item, onPay, onEdit, onDeleteRequest }: {
  item: Installment; onPay: () => void; onEdit: () => void; onDeleteRequest: () => void
}) {
  const [paying, setPaying] = useState(false)
  const cfg = PLATFORM_CONFIG[item.platform] ?? PLATFORM_CONFIG['ทั่วไป']
  const progress  = item.total_installments > 0 ? Math.min((item.current_installment / item.total_installments) * 100, 100) : 0
  const remaining = item.total_installments - item.current_installment
  const isAlmostDone = remaining <= 3 && remaining > 0

  const handlePay = async () => {
    setPaying(true)
    await onPay()
    setPaying(false)
  }

  return (
    <div className={`bg-white rounded-3xl shadow-sm ring-1 ring-slate-100 overflow-hidden border-l-4 ${cfg.accent}`}>
      <div className="p-4">
        {/* Top row */}
        <div className="flex justify-between items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.badge}`}>{item.platform}</span>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{item.payment_method}</span>
            </div>
            <p className="font-bold text-slate-900 text-base truncate leading-snug">{item.product_name}</p>
            {item.full_price > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">ราคาเต็ม {fmt(item.full_price)}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-extrabold text-slate-900 leading-none">{fmt(item.monthly_payment)}</p>
            <p className="text-xs text-slate-400 mt-1">/เดือน</p>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-500">งวดที่ <span className="font-bold text-slate-700">{item.current_installment}</span> / {item.total_installments}</span>
            <span className={`font-semibold ${isAlmostDone ? 'text-amber-500' : 'text-slate-400'}`}>
              {isAlmostDone && '⚡ '}เหลืออีก {remaining} งวด
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${cfg.barColor} rounded-full transition-all duration-700 ease-out`}
              style={{ width: `${progress}%` }} />
          </div>
          <p className="text-right text-xs text-slate-400 mt-1">{Math.round(progress)}%</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={handlePay} disabled={paying}
            className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-1.5 disabled:opacity-70">
            {paying
              ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
              : <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                  </svg>
                  จ่ายแล้ว (+1 งวด)
                </>
            }
          </button>
          <button onClick={onEdit}
            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all text-sm">
            ✏️
          </button>
          <button onClick={onDeleteRequest}
            className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-2xl transition-all text-sm">
            🗑️
          </button>
        </div>
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
