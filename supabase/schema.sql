-- ========================================================
-- สคีมาฐานข้อมูล สำหรับระบบจัดการผ่อนชำระ
-- วิธีใช้: คัดลอกโค้ดทั้งหมดนี้ไปวางใน Supabase SQL Editor
-- แล้วกด Run
-- ========================================================


-- ============================================
-- ตาราง 1: บัตรเครดิต (credit_cards)
-- ============================================
CREATE TABLE credit_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- เปิดระบบความปลอดภัยระดับ Row Level
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;

-- กฎ: ผู้ใช้เห็นและแก้ไขได้เฉพาะบัตรของตัวเองเท่านั้น
CREATE POLICY "Users manage their own credit cards"
  ON credit_cards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================
-- ตาราง 2: รายการผ่อนชำระ (installments)
-- ============================================
CREATE TABLE installments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_name TEXT NOT NULL,
  full_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  monthly_payment DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_installments INTEGER NOT NULL DEFAULT 1 CHECK (total_installments >= 1),
  current_installment INTEGER NOT NULL DEFAULT 0 CHECK (current_installment >= 0),
  payment_method TEXT NOT NULL DEFAULT 'เงินสด',
  platform TEXT NOT NULL DEFAULT 'ทั่วไป',
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- เปิดระบบความปลอดภัยระดับ Row Level
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;

-- กฎ: ผู้ใช้เห็นและแก้ไขได้เฉพาะรายการของตัวเองเท่านั้น
CREATE POLICY "Users manage their own installments"
  ON installments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Function: อัพเดท updated_at อัตโนมัติ
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON installments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
