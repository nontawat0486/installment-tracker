'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = '/dashboard'
    })
  }, [])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return }
    if (password !== confirmPassword) { setError('รหัสผ่านไม่ตรงกัน'); return }

    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message.includes('already') ? 'อีเมลนี้ถูกใช้งานแล้ว' : `เกิดข้อผิดพลาด: ${error.message}`)
      setLoading(false)
      return
    }

    if (data.session) {
      window.location.href = '/dashboard'
    } else {
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password })
      if (!loginErr) window.location.href = '/dashboard'
      else { setError('สมัครสำเร็จ กรุณา Login ด้วยอีเมลและรหัสผ่านที่ตั้งไว้'); setLoading(false) }
    }
  }

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3
  const strengthLabel = ['', 'อ่อน', 'ปานกลาง', 'แข็งแกร่ง']
  const strengthColor = ['', 'bg-red-400', 'bg-amber-400', 'bg-emerald-500']

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-in">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-violet-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg mx-auto mb-4">
            ✨
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">สร้างบัญชีใหม่</h1>
          <p className="text-slate-500 mt-2">เริ่มต้นจัดการผ่อนชำระได้เลย ฟรี!</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="label">อีเมล</label>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                className="input" placeholder="your@email.com" required
              />
            </div>

            <div>
              <label className="label">รหัสผ่าน</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pr-12" placeholder="อย่างน้อย 6 ตัวอักษร" required
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
              {password && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${strengthColor[strength]} rounded-full transition-all duration-300`}
                      style={{ width: `${(strength / 3) * 100}%` }} />
                  </div>
                  <span className={`text-xs font-medium ${strength === 1 ? 'text-red-500' : strength === 2 ? 'text-amber-500' : 'text-emerald-600'}`}>
                    {strengthLabel[strength]}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="label">ยืนยันรหัสผ่าน</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className={`input pr-10 ${confirmPassword && confirmPassword !== password ? 'ring-2 ring-red-400 border-transparent' : confirmPassword && confirmPassword === password ? 'ring-2 ring-emerald-400 border-transparent' : ''}`}
                  placeholder="••••••••" required
                />
                {confirmPassword && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm">
                    {confirmPassword === password ? '✅' : '❌'}
                  </span>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-3 rounded-2xl animate-pop">
                <span>⚠️</span> {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-base mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  กำลังสมัครสมาชิก...
                </span>
              ) : 'สมัครสมาชิก'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            มีบัญชีแล้ว?{' '}
            <Link href="/login" className="text-violet-600 font-semibold hover:text-violet-700">
              เข้าสู่ระบบ →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
