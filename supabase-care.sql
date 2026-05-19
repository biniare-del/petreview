-- 케어 기록 테이블 (우쭈쭈 Phase 1)
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS pet_care_logs (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pet_id     UUID REFERENCES pets(id) ON DELETE CASCADE NOT NULL,
  care_key   TEXT NOT NULL,          -- 'heartworm', 'nail_trim', 'teeth_brushing' 등
  done_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스 (pet별 최신 기록 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_pet_care_logs_pet_id ON pet_care_logs (pet_id, done_at DESC);

-- RLS
ALTER TABLE pet_care_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자는 자신의 케어 기록만 접근" ON pet_care_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
