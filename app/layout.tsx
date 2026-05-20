import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'จัดการผ่อนชำระ',
  description: 'ระบบบันทึกรายการผ่อนสินค้าและค่าใช้จ่ายรายเดือน',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  )
}
