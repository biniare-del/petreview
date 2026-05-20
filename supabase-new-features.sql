-- =====================================================
-- 우쭈쭈 신규 기능 SQL (케어 4탭 + 단골병원 + 소셜 통합)
-- Supabase 대시보드 → SQL Editor 에서 순서대로 실행
-- =====================================================

-- ─────────────────────────────────────────────────
-- 1. pet_weights (체중 기록)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pet_weights (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pet_id      UUID REFERENCES pets(id) ON DELETE CASCADE NOT NULL,
  weight      NUMERIC(5,2) NOT NULL,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pet_weights_pet ON pet_weights (pet_id, recorded_at DESC);
ALTER TABLE pet_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pet_weights_owner" ON pet_weights
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────
-- 2. hospital_visits (단골병원 방문 기록)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hospital_visits (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  favorite_id  UUID REFERENCES favorites(id) ON DELETE CASCADE NOT NULL,
  visit_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  cost         NUMERIC(10,0),
  content      TEXT,
  vet_name     TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hospital_visits_fav ON hospital_visits (favorite_id, visit_date DESC);
ALTER TABLE hospital_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hospital_visits_owner" ON hospital_visits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────
-- 3. pet_expenses (지출 가계부)
--    mypage.js에서 이미 사용 중이므로 IF NOT EXISTS
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pet_expenses (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pet_id       UUID REFERENCES pets(id) ON DELETE SET NULL,
  category     TEXT NOT NULL,
  amount       NUMERIC(10,0) NOT NULL,
  memo         TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source       TEXT DEFAULT 'manual',
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pet_expenses_user ON pet_expenses (user_id, expense_date DESC);
ALTER TABLE pet_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pet_expenses_owner" ON pet_expenses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────
-- 4. posts 테이블 업데이트
--    a) photo_urls 컬럼 추가 (사진 포스팅용)
--    b) tag CHECK 제약 확장 (사진자랑, 일상 추가)
-- ─────────────────────────────────────────────────
ALTER TABLE posts ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT NULL;

-- 기존 tag CHECK 제약 제거 후 새 제약으로 교체
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_tag_check;
ALTER TABLE posts ADD CONSTRAINT posts_tag_check
  CHECK (tag IN ('사진자랑', '병원추천', '질문', '자랑', '정보', '일상'));

-- ─────────────────────────────────────────────────
-- 5. favorites 테이블 memo 컬럼 추가 (단골병원 메모)
-- ─────────────────────────────────────────────────
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS memo TEXT DEFAULT NULL;

-- ─────────────────────────────────────────────────
-- 6. pet_health_records 확인 (이미 존재하면 스킵)
--    (supabase/add_pet_health_records.sql 미실행 시 여기서 생성)
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pet_health_records (
  id          BIGSERIAL PRIMARY KEY,
  pet_id      UUID REFERENCES pets(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL,
  record_date DATE NOT NULL,
  content     TEXT,
  next_due_date DATE,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE pet_health_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'hr_owner_select' AND tablename = 'pet_health_records') THEN
    CREATE POLICY "hr_owner_select" ON pet_health_records FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'hr_owner_insert' AND tablename = 'pet_health_records') THEN
    CREATE POLICY "hr_owner_insert" ON pet_health_records FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'hr_owner_delete' AND tablename = 'pet_health_records') THEN
    CREATE POLICY "hr_owner_delete" ON pet_health_records FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
