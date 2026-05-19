-- 식단 관리 테이블 (우쭈쭈 Phase 2)
-- Supabase SQL Editor에서 실행

-- 펫별 식단 설정 (1행)
CREATE TABLE IF NOT EXISTS pet_diet_settings (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pet_id           UUID REFERENCES pets(id) ON DELETE CASCADE NOT NULL UNIQUE,
  meals_per_day    SMALLINT DEFAULT 2,
  food_name        TEXT,
  food_amount_g    NUMERIC,
  water_target_ml  NUMERIC DEFAULT 300,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 일별 식단 기록
CREATE TABLE IF NOT EXISTS pet_diet_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pet_id      UUID REFERENCES pets(id) ON DELETE CASCADE NOT NULL,
  log_type    TEXT NOT NULL,      -- 'meal' | 'water' | 'snack'
  meal_order  SMALLINT,           -- 1·2·3 (log_type='meal' 일 때)
  water_ml    NUMERIC,
  note        TEXT,
  logged_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pet_diet_logs ON pet_diet_logs (pet_id, logged_at DESC);

ALTER TABLE pet_diet_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_diet_logs     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner only" ON pet_diet_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner only" ON pet_diet_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
