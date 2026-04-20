-- reviews 테이블에 kakao_place_id 컬럼 추가
-- Supabase SQL Editor에서 실행할 것

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS kakao_place_id text;

-- 인덱스: kakao_place_id 기준 검색 빠르게
CREATE INDEX IF NOT EXISTS reviews_kakao_place_id_idx ON reviews (kakao_place_id);
