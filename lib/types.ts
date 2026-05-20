export interface Profile {
  id: string
  email: string
  display_name: string
  role: 'user' | 'admin'
  created_at: string
  updated_at: string
}

export interface CreditCard {
  id: string
  user_id: string
  name: string
  description: string
  created_at: string
}

export interface PaymentHistoryEntry {
  installmentNo: number
  paidAt: string   // ISO timestamp
}

export interface Installment {
  id: string
  user_id: string
  product_name: string
  full_price: number
  monthly_payment: number
  total_installments: number
  current_installment: number
  payment_method: string
  platform: string
  is_completed: boolean
  payment_history: PaymentHistoryEntry[]
  due_day: number | null
  created_at: string
  updated_at: string
}
