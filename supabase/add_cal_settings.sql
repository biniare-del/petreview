-- 식단 설정에 칼로리 계산 컬럼 추가
-- Supabase SQL Editor에서 실행

ALTER TABLE pet_diet_settings
  ADD COLUMN IF NOT EXISTS weight_kg    NUMERIC,
  ADD COLUMN IF NOT EXISTS neutered     BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS kcal_per_100g NUMERIC DEFAULT 350;
