-- =====================================================
-- 펫리뷰 Supabase 업데이트 SQL (영수증 인증 기능)
-- Supabase 대시보드 → SQL Editor 에서 실행하세요.
-- =====================================================

-- 1. reviews 테이블 컬럼 추가
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_verified  BOOLEAN DEFAULT false;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS total_amount INTEGER;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS pet_photo_url TEXT;

-- visit_date 는 기존 스키마에 이미 있으므로 추가 불필요.

-- 2. receipts 버킷 private 으로 변경 (공개 URL 차단)
UPDATE storage.buckets SET public = false WHERE id = 'receipts';

-- 3. pet-photos 버킷 생성 (public)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('pet-photos', 'pet-photos', true)
  ON CONFLICT (id) DO NOTHING;

-- 4. pet-photos Storage 정책 (기존 정책과 이름 충돌 방지 위해 새 이름 사용)
CREATE POLICY "pet-photos 업로드 허용"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pet-photos');

CREATE POLICY "pet-photos 조회 허용"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pet-photos');
