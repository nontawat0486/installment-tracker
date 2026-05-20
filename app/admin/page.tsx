'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Profile } from '@/lib/types'
import Link from 'next/link'

interface UserStats extends Profile {
  installment_count: number
  active_count: number
  monthly_total: number
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency', currency: 'THB',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserStats[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchUsers = useCallback(async () => {
    const supabase = createClient()
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (!profiles) return

    const { data: installments } = await supabase
      .from('installments')
      .select('user_id, monthly_payment, is_completed')

    const statsMap: Record<string, { count: number; active: number; total: number }> = {}
    ;(installments ?? []).forEach(i => {
      if (!statsMap[i.user_id]) statsMap[i.user_id] = { count: 0, active: 0, total: 0 }
      statsMap[i.user_id].count++
      if (!i.is_completed) {
        statsMap[i.user_id].active++
        statsMap[i.user_id].total += i.monthly_payment
      }
    })

    setUsers(profiles.map(p => ({
      ...p,
      installment_count: statsMap[p.id]?.count ?? 0,
      active_count: statsMap[p.id]?.active ?? 0,
      monthly_total: statsMap[p.id]?.total ?? 0,
    })))
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { window.location.href = '/login'; return }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()

        if (!profile || profile.role !== 'admin') {
          window.location.href = '/dashboard'
          return
        }
        await fetchUsers()
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [fetchUsers])

  const handleToggleRole = async (user: UserStats) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin'
    setUpdating(user.id)
    const supabase = createClient()
    await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', user.id)
    await fetchUsers()
    setUpdating(null)
  }

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.display_name.toLowerCase().includes(search.toLowerCase())
  )

  const adminCount = users.filter(u => u.role === 'admin').length
  const userCount = users.filter(u => u.role === 'user').length
  const totalMonthly = users.reduce((s, u) => s + u.monthly_total, 0)
  const totalActive = users.reduce((s, u) => s + u.active_count, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center text-2xl mx-auto animate-pulse">
            👥
          </div>
          <p className="text-slate-400 text-sm">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-slate-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              ←
            </Link>
            <div>
              <h1 className="text-base font-bold text-slate-900">Admin Panel</h1>
              <p className="text-xs text-slate-400">จัดการผู้ใช้และสิทธิ์การเข้าถึง</p>
            </div>
          </div>
          <span className="text-xs bg-violet-100 text-violet-700 font-bold px-3 py-1 rounded-full tracking-wide">
            ADMIN
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5 pb-12">

        {/* Hero summary */}
        <div className="relative bg-gradient-to-br from-violet-600 to-purple-700 rounded-3xl p-6 text-white shadow-lg overflow-hidden animate-in">
          <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full" />
          <div className="absolute -bottom-8 -left-4 w-24 h-24 bg-white/5 rounded-full" />
          <p className="text-violet-200 text-sm font-medium">ยอดผ่อนชำระรวมทุก User</p>
          <p className="text-4xl font-extrabold mt-1 tracking-tight">{formatCurrency(totalMonthly)}</p>
          <p className="text-violet-200 text-xs mt-2">{totalActive} รายการที่กำลังผ่อนอยู่ทั้งระบบ</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'ผู้ใช้ทั้งหมด', value: users.length, color: 'text-slate-800' },
            { label: 'Admin', value: adminCount, color: 'text-violet-600' },
            { label: 'User ทั่วไป', value: userCount, color: 'text-slate-600' },
          ].map(stat => (
            <div key={stat.label} className="card p-4 text-center animate-in">
              <p className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาด้วยอีเมลหรือชื่อ..."
          className="input"
        />

        {/* User list */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest px-1">
            รายชื่อผู้ใช้ ({filtered.length})
          </p>

          {filtered.length === 0 ? (
            <div className="card p-10 text-center text-slate-400 animate-in">
              ไม่พบผู้ใช้ที่ค้นหา
            </div>
          ) : (
            filtered.map((user, i) => (
              <div
                key={user.id}
                className="card p-4 animate-in"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${
                      user.role === 'admin' ? 'bg-violet-500' : 'bg-slate-300'
                    }`}>
                      {user.email[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 truncate text-sm">{user.email}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          user.role === 'admin'
                            ? 'bg-violet-100 text-violet-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {user.role === 'admin' ? '👑 ADMIN' : '👤 USER'}
                        </span>
                      </div>
                      {user.display_name && (
                        <p className="text-xs text-slate-500 mt-0.5">{user.display_name}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-0.5">
                        สมัครเมื่อ {new Date(user.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleRole(user)}
                    disabled={updating === user.id}
                    className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all disabled:opacity-50 ${
                      user.role === 'admin'
                        ? 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-500'
                        : 'bg-violet-50 text-violet-600 hover:bg-violet-100'
                    }`}
                  >
                    {updating === user.id ? (
                      <svg className="animate-spin h-3.5 w-3.5 inline" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                    ) : user.role === 'admin' ? 'ถอด Admin' : 'ตั้งเป็น Admin'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-50">
                  <div className="text-center">
                    <p className="text-base font-bold text-slate-800">{user.installment_count}</p>
                    <p className="text-xs text-slate-400">รายการทั้งหมด</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-violet-600">{user.active_count}</p>
                    <p className="text-xs text-slate-400">กำลังผ่อน</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-slate-700">
                      {new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0 }).format(user.monthly_total)}
                    </p>
                    <p className="text-xs text-slate-400">฿/เดือน</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
