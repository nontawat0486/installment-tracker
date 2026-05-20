'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

const FEATURES = [
  { icon: '💳', text: 'จัดการผ่อนชำระทุกบัตร' },
  { icon: '📊', text: 'Dashboard สรุปยอดรายเดือน' },
  { icon: '🔄', text: 'ซิงค์ข้อมูลทุกอุปกรณ์' },
  { icon: '🔒', text: 'ข้อมูลแยกส่วน ปลอดภัย 100%' },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = '/dashboard'
    })
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    if (error) {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      setLoading(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid lg:grid-cols-2 gap-8 items-center">

        {/* Left — Brand */}
        <div className="hidden lg:block space-y-8 pl-4">
          <div>
            <div className="w-14 h-14 bg-violet-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg mb-6">
              💳
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 leading-tight">
              จัดการผ่อนชำระ<br />
              <span className="text-violet-600">ให้ง่ายขึ้น</span>
            </h1>
            <p className="text-slate-500 mt-3 text-lg leading-relaxed">
              บันทึกรายการผ่อนสินค้าทุกชิ้น ติดตามยอดชำระแต่ละเดือน
            </p>
          </div>

          <div className="space-y-3">
            {FEATURES.map(f => (
              <div key={f.text} className="flex items-center gap-3">
                <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center text-base shrink-0">
                  {f.icon}
                </div>
                <span className="text-slate-700 font-medium">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Form */}
        <div className="card p-8 animate-in">
          {/* Mobile logo */}
          <div className="flex justify-center mb-6 lg:hidden">
            <div className="w-12 h-12 bg-violet-600 rounded-2xl flex items-center justify-center text-xl shadow-md">
              💳
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">ยินดีต้อนรับกลับ</h2>
          <p className="text-slate-500 text-sm mb-7">เข้าสู่ระบบเพื่อดูข้อมูลของคุณ</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">อีเมล</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="your@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label">รหัสผ่าน</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pr-12"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors text-sm"
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-2xl animate-pop">
                <span>⚠️</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 text-base mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  กำลังเข้าสู่ระบบ...
                </span>
              ) : 'เข้าสู่ระบบ'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            ยังไม่มีบัญชี?{' '}
            <Link href="/signup" className="text-violet-600 font-semibold hover:text-violet-700">
              สมัครสมาชิกฟรี →
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}
