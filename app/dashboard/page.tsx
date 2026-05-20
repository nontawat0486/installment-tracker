'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Installment, CreditCard } from '@/lib/types'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const PLATFORMS = ['ทั่วไป', 'Shopee', 'TikTok Shop']

const PLATFORM_BADGE: Record<string, string> = {
  'Shopee': 'bg-orange-500 text-white',
  'TikTok Shop': 'bg-pink-500 text-white',
  'ทั่วไป': 'bg-gray-400 text-white',
}

const PLATFORM_CARD: Record<string, string> = {
  'Shopee': 'border-orange-200 bg-orange-50',
  'TikTok Shop': 'border-pink-200 bg-pink-50',
  'ทั่วไป': 'border-gray-200 bg-white',
}

const PLATFORM_PROGRESS: Record<string, string> = {
  'Shopee': 'bg-orange-500',
  'TikTok Shop': 'bg-pink-500',
  'ทั่วไป': 'bg-indigo-500',
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const EMPTY_FORM = {
  product_name: '',
  full_price: '',
  monthly_payment: '',
  total_installments: '',
  current_installment: '0',
  payment_method: 'เงินสด',
  platform: 'ทั่วไป',
}

export default function DashboardPage() {
  const router = useRouter()
  const [installments, setInstallments] = useState<Installment[]>([])
  const [creditCards, setCreditCards] = useState<CreditCard[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [userRole, setUserRole] = useState<'user' | 'admin'>('user')

  const [showInstallmentModal, setShowInstallmentModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [editingInstallment, setEditingInstallment] = useState<Installment | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [newCard, setNewCard] = useState({ name: '', description: '' })

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: iData }, { data: cData }] = await Promise.all([
      supabase.from('installments').select('*').order('created_at', { ascending: false }),
      supabase.from('credit_cards').select('*').order('name'),
    ])
    setInstallments(iData ?? [])
    setCreditCards(cData ?? [])
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          window.location.href = '/login'
          return
        }
        setUserEmail(session.user.email ?? '')
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        if (profile) setUserRole(profile.role as 'user' | 'admin')
        await fetchData()
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [fetchData])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const openAddModal = () => {
    setEditingInstallment(null)
    setForm({
      ...EMPTY_FORM,
      payment_method: creditCards.length > 0 ? creditCards[0].name : 'เงินสด',
    })
    setShowInstallmentModal(true)
  }

  const openEditModal = (item: Installment) => {
    setEditingInstallment(item)
    setForm({
      product_name: item.product_name,
      full_price: item.full_price.toString(),
      monthly_payment: item.monthly_payment.toString(),
      total_installments: item.total_installments.toString(),
      current_installment: item.current_installment.toString(),
      payment_method: item.payment_method,
      platform: item.platform,
    })
    setShowInstallmentModal(true)
  }

  const handleSave = async () => {
    if (!form.product_name.trim() || !form.monthly_payment || !form.total_installments) return
    setSaving(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSaving(false); return }

    const currentVal = parseInt(form.current_installment) || 0
    const totalVal = parseInt(form.total_installments) || 1
    const payload = {
      product_name: form.product_name.trim(),
      full_price: parseFloat(form.full_price) || 0,
      monthly_payment: parseFloat(form.monthly_payment) || 0,
      total_installments: totalVal,
      current_installment: currentVal,
      payment_method: form.payment_method,
      platform: form.platform,
      is_completed: currentVal >= totalVal,
    }

    if (editingInstallment) {
      await supabase.from('installments').update(payload).eq('id', editingInstallment.id)
    } else {
      await supabase.from('installments').insert({ ...payload, user_id: session.user.id })
    }

    await fetchData()
    setShowInstallmentModal(false)
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('installments').delete().eq('id', id)
    setDeleteConfirmId(null)
    await fetchData()
  }

  const handlePayInstallment = async (item: Installment) => {
    const newCurrent = item.current_installment + 1
    const supabase = createClient()
    await supabase.from('installments').update({
      current_installment: newCurrent,
      is_completed: newCurrent >= item.total_installments,
    }).eq('id', item.id)
    await fetchData()
  }

  const handleAddCard = async () => {
    if (!newCard.name.trim()) return
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await supabase.from('credit_cards').insert({
      name: newCard.name.trim(),
      description: newCard.description.trim(),
      user_id: session.user.id,
    })
    setNewCard({ name: '', description: '' })
    await fetchData()
  }

  const handleDeleteCard = async (id: string) => {
    const supabase = createClient()
    await supabase.from('credit_cards').delete().eq('id', id)
    await fetchData()
  }

  const activeList = installments.filter(i => !i.is_completed)
  const completedList = installments.filter(i => i.is_completed)

  const totalMonthly = activeList.reduce((s, i) => s + i.monthly_payment, 0)

  const byCard: Record<string, number> = {}
  activeList.forEach(i => {
    byCard[i.payment_method] = (byCard[i.payment_method] || 0) + i.monthly_payment
  })

  const byPlatform: Record<string, number> = {}
  activeList.forEach(i => {
    byPlatform[i.platform] = (byPlatform[i.platform] || 0) + i.monthly_payment
  })

  const paymentOptions = ['เงินสด', ...creditCards.map(c => c.name)]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">💳</div>
          <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20 border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-gray-900">💳 ผ่อนชำระ</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-gray-400 truncate max-w-[160px]">{userEmail}</p>
              {userRole === 'admin' ? (
                <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
                  ADMIN
                </span>
              ) : (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  USER
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {userRole === 'admin' && (
              <Link
                href="/admin"
                className="px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors font-medium"
              >
                👥 Admin
              </Link>
            )}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors text-sm"
              title="จัดการบัตรเครดิต"
            >
              ⚙️ บัตร
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            >
              ออก
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-6 pb-20">

        {/* ===== Summary Section ===== */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            สรุปรายจ่ายเดือนนี้
          </h2>

          {/* Total card */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-5 text-white mb-3 shadow-md">
            <p className="text-indigo-200 text-sm">ยอดรวมทั้งหมดที่ต้องจ่าย</p>
            <p className="text-4xl font-bold mt-1 tracking-tight">{formatCurrency(totalMonthly)}</p>
            <p className="text-indigo-200 text-xs mt-2">
              {activeList.length} รายการที่กำลังผ่อน
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* By Payment Method */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                แยกตามช่องทางชำระ
              </p>
              {Object.entries(byCard).length === 0 ? (
                <p className="text-gray-300 text-sm">ไม่มีข้อมูล</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(byCard)
                    .sort((a, b) => b[1] - a[1])
                    .map(([method, amount]) => (
                      <div key={method} className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">💳</span>
                          <span className="text-xs text-gray-600 truncate max-w-[80px]">{method}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* By Platform */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                แยกตามแพลตฟอร์ม
              </p>
              {Object.entries(byPlatform).length === 0 ? (
                <p className="text-gray-300 text-sm">ไม่มีข้อมูล</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(byPlatform)
                    .sort((a, b) => b[1] - a[1])
                    .map(([platform, amount]) => (
                      <div key={platform} className="flex justify-between items-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLATFORM_BADGE[platform] ?? 'bg-gray-400 text-white'}`}>
                          {platform}
                        </span>
                        <span className="text-sm font-bold text-gray-900">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ===== Active Installments ===== */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              รายการกำลังผ่อน ({activeList.length})
            </h2>
            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
            >
              <span>+</span> เพิ่มรายการ
            </button>
          </div>

          {activeList.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
              <p className="text-4xl mb-3">📦</p>
              <p className="text-gray-500 font-medium">ยังไม่มีรายการผ่อนชำระ</p>
              <p className="text-gray-400 text-sm mt-1">กดปุ่ม + เพิ่มรายการ เพื่อเริ่มบันทึก</p>
              <button
                onClick={openAddModal}
                className="mt-4 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
              >
                เพิ่มรายการแรก
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeList.map(item => (
                <InstallmentCard
                  key={item.id}
                  item={item}
                  onPay={() => handlePayInstallment(item)}
                  onEdit={() => openEditModal(item)}
                  onDeleteRequest={() => setDeleteConfirmId(item.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ===== Completed Installments ===== */}
        {completedList.length > 0 && (
          <section>
            <button
              onClick={() => setShowCompleted(v => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors mb-3"
            >
              <span>ผ่อนชำระเสร็จสิ้น ({completedList.length})</span>
              <span className="text-xs">{showCompleted ? '▲' : '▼'}</span>
            </button>

            {showCompleted && (
              <div className="space-y-2">
                {completedList.map(item => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 opacity-70"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${PLATFORM_BADGE[item.platform] ?? 'bg-gray-400 text-white'}`}>
                          {item.platform}
                        </span>
                        <span className="font-medium text-gray-700 truncate">{item.product_name}</span>
                        <span className="shrink-0 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ ครบแล้ว</span>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <span className="text-sm font-semibold text-gray-500">{formatCurrency(item.full_price)}</span>
                        <button
                          onClick={() => setDeleteConfirmId(item.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{item.payment_method} • {item.total_installments} งวด</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ===== Installment Modal ===== */}
      {showInstallmentModal && (
        <Modal
          title={editingInstallment ? '✏️ แก้ไขรายการ' : '➕ เพิ่มรายการใหม่'}
          onClose={() => setShowInstallmentModal(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="label">ชื่อสินค้า *</label>
              <input
                type="text"
                value={form.product_name}
                onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))}
                className="input"
                placeholder="เช่น iPhone 15 Pro, หูฟัง Sony"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">ราคาเต็ม (บาท)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={form.full_price}
                  onChange={e => setForm(f => ({ ...f, full_price: e.target.value }))}
                  className="input"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="label">ยอดต่อเดือน (บาท) *</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={form.monthly_payment}
                  onChange={e => setForm(f => ({ ...f, monthly_payment: e.target.value }))}
                  className="input"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">งวดทั้งหมด *</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.total_installments}
                  onChange={e => setForm(f => ({ ...f, total_installments: e.target.value }))}
                  className="input"
                  placeholder="เช่น 12, 24"
                  min="1"
                />
              </div>
              <div>
                <label className="label">จ่ายแล้ว (งวด)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.current_installment}
                  onChange={e => setForm(f => ({ ...f, current_installment: e.target.value }))}
                  className="input"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="label">ช่องทางชำระเงิน</label>
              <select
                value={form.payment_method}
                onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                className="input"
              >
                {paymentOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">แพลตฟอร์มที่ซื้อ</label>
              <select
                value={form.platform}
                onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                className="input"
              >
                {PLATFORMS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowInstallmentModal(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.product_name.trim() || !form.monthly_payment || !form.total_installments}
                className="flex-1 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all"
              >
                {saving ? 'กำลังบันทึก...' : editingInstallment ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ===== Settings Modal ===== */}
      {showSettingsModal && (
        <Modal title="⚙️ จัดการบัตรเครดิต" onClose={() => setShowSettingsModal(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              เพิ่มบัตรเครดิตของคุณ จากนั้นจะปรากฏในเมนูเลือกช่องทางชำระเงินโดยอัตโนมัติ
            </p>

            {/* ฟอร์มเพิ่มบัตรใหม่ */}
            <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
              <div>
                <label className="label">ชื่อบัตร *</label>
                <input
                  type="text"
                  value={newCard.name}
                  onChange={e => setNewCard(c => ({ ...c, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAddCard()}
                  className="input"
                  placeholder="เช่น AEON, UOB, KTC, UCHOOSE"
                />
              </div>
              <div>
                <label className="label">บัตรนี้ใช้สำหรับอะไร</label>
                <input
                  type="text"
                  value={newCard.description}
                  onChange={e => setNewCard(c => ({ ...c, description: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAddCard()}
                  className="input"
                  placeholder="เช่น ช้อปปิ้งออนไลน์, ค่าใช้จ่ายประจำเดือน"
                />
              </div>
              <button
                onClick={handleAddCard}
                disabled={!newCard.name.trim()}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-semibold transition-colors"
              >
                + เพิ่มบัตร
              </button>
            </div>

            {/* รายการบัตรที่มีอยู่ */}
            <div className="space-y-2">
              {creditCards.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">
                  <p className="text-2xl mb-2">💳</p>
                  ยังไม่มีบัตรเครดิต เพิ่มบัตรแรกได้เลย
                </div>
              ) : (
                creditCards.map(card => (
                  <div key={card.id} className="flex justify-between items-start p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <span className="text-base mt-0.5">💳</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800">{card.name}</p>
                        {card.description && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{card.description}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors p-1 shrink-0"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ===== Delete Confirm Modal ===== */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-center mb-4">
              <p className="text-3xl mb-2">🗑️</p>
              <h3 className="font-bold text-gray-900">ยืนยันการลบ</h3>
              <p className="text-gray-500 text-sm mt-1">ข้อมูลจะถูกลบถาวรและไม่สามารถกู้คืนได้</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 font-semibold"
              >
                ลบเลย
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== Sub-components =====

function InstallmentCard({
  item,
  onPay,
  onEdit,
  onDeleteRequest,
}: {
  item: Installment
  onPay: () => void
  onEdit: () => void
  onDeleteRequest: () => void
}) {
  const progress = item.total_installments > 0
    ? Math.min((item.current_installment / item.total_installments) * 100, 100)
    : 0
  const remaining = item.total_installments - item.current_installment
  const cardClass = PLATFORM_CARD[item.platform] ?? 'border-gray-200 bg-white'
  const progressClass = PLATFORM_PROGRESS[item.platform] ?? 'bg-indigo-500'
  const badgeClass = PLATFORM_BADGE[item.platform] ?? 'bg-gray-400 text-white'

  return (
    <div className={`rounded-2xl p-4 shadow-sm border ${cardClass}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`}>
              {item.platform}
            </span>
            <span className="text-xs text-gray-400">{item.payment_method}</span>
          </div>
          <p className="font-semibold text-gray-900 truncate">{item.product_name}</p>
          {item.full_price > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">ราคาเต็ม {formatCurrency(item.full_price)}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-gray-900">{formatCurrency(item.monthly_payment)}</p>
          <p className="text-xs text-gray-400">/เดือน</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>งวดที่ {item.current_installment}/{item.total_installments}</span>
          <span className={remaining <= 3 ? 'text-orange-500 font-semibold' : ''}>
            เหลือ {remaining} งวด
            {remaining <= 3 && remaining > 0 && ' ⚡'}
          </span>
        </div>
        <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressClass} rounded-full transition-all duration-500`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onPay}
          className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 active:scale-95 transition-all"
        >
          ✓ จ่ายแล้ว (+1 งวด)
        </button>
        <button
          onClick={onEdit}
          className="px-3 py-2.5 text-gray-500 hover:bg-white hover:shadow-sm rounded-xl transition-all text-sm"
          title="แก้ไข"
        >
          ✏️
        </button>
        <button
          onClick={onDeleteRequest}
          className="px-3 py-2.5 text-gray-400 hover:bg-red-50 hover:text-red-400 rounded-xl transition-all text-sm"
          title="ลบ"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl sm:rounded-t-3xl">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
