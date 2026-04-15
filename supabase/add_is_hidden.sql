-- reviews 테이블에 소프트삭제용 is_hidden 컬럼 추가
-- Supabase SQL Editor에서 실행하세요.

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;

-- 기존 데이터 초기화 (NULL → false)
UPDATE reviews SET is_hidden = false WHERE is_hidden IS NULL;
