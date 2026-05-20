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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserStats[]>([])
  const [loading, setLoading] = useState(true)
  const [myRole, setMyRole] = useState<string>('')
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
        setMyRole(profile.role)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">👥</div>
          <p className="text-gray-500">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20 border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              title="กลับ Dashboard"
            >
              ←
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">👥 Admin Panel</h1>
              <p className="text-xs text-gray-400">จัดการผู้ใช้และสิทธิ์การเข้าถึง</p>
            </div>
          </div>
          <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-3 py-1 rounded-full">
            ADMIN
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-5 pb-10">

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-bold text-gray-900">{users.length}</p>
            <p className="text-xs text-gray-500 mt-1">ผู้ใช้ทั้งหมด</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-100 text-center">
            <p className="text-2xl font-bold text-indigo-600">{adminCount}</p>
            <p className="text-xs text-gray-500 mt-1">Admin</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-bold text-gray-700">{userCount}</p>
            <p className="text-xs text-gray-500 mt-1">User ทั่วไป</p>
          </div>
        </div>

        {/* Total Monthly across all users */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-5 text-white shadow-md">
          <p className="text-indigo-200 text-sm">ยอดผ่อนชำระรวมทุก user (เดือนนี้)</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(totalMonthly)}</p>
          <p className="text-indigo-200 text-xs mt-1">
            {users.reduce((s, u) => s + u.active_count, 0)} รายการที่กำลังผ่อนอยู่
          </p>
        </div>

        {/* Search */}
        <div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาด้วยอีเมลหรือชื่อ..."
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
        </div>

        {/* User Table */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1">
            รายชื่อผู้ใช้ ({filtered.length})
          </h2>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center text-gray-400">
              ไม่พบผู้ใช้ที่ค้นหา
            </div>
          ) : (
            filtered.map(user => (
              <UserCard
                key={user.id}
                user={user}
                isUpdating={updating === user.id}
                onToggleRole={() => handleToggleRole(user)}
              />
            ))
          )}
        </div>
      </main>
    </div>
  )
}

function UserCard({
  user,
  isUpdating,
  onToggleRole,
}: {
  user: UserStats
  isUpdating: boolean
  onToggleRole: () => void
}) {
  const isAdmin = user.role === 'admin'

  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border transition-all ${
      isAdmin ? 'border-indigo-200' : 'border-gray-100'
    }`}>
      <div className="flex justify-between items-start gap-3">
        {/* User info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${
            isAdmin ? 'bg-indigo-500' : 'bg-gray-400'
          }`}>
            {user.email[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 truncate">{user.email}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                isAdmin
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {isAdmin ? '👑 ADMIN' : '👤 USER'}
              </span>
            </div>
            {user.display_name && (
              <p className="text-sm text-gray-500">{user.display_name}</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              สมัครเมื่อ {new Date(user.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={onToggleRole}
          disabled={isUpdating}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all disabled:opacity-50 ${
            isAdmin
              ? 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500'
              : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
          }`}
        >
          {isUpdating ? '...' : isAdmin ? 'ถอด Admin' : 'ตั้งเป็น Admin'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-50">
        <div className="text-center">
          <p className="text-base font-bold text-gray-800">{user.installment_count}</p>
          <p className="text-xs text-gray-400">รายการทั้งหมด</p>
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-blue-600">{user.active_count}</p>
          <p className="text-xs text-gray-400">กำลังผ่อน</p>
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-indigo-600">
            {new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0 }).format(user.monthly_total)}
          </p>
          <p className="text-xs text-gray-400">฿/เดือน</p>
        </div>
      </div>
    </div>
  )
}
