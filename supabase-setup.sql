-- =====================================================
-- 펫리뷰 Supabase 초기 설정 SQL
-- =====================================================
-- Supabase 대시보드 → SQL Editor 에서 이 파일 내용을 붙여넣고 실행하세요.
-- =====================================================

-- 1. reviews 테이블 생성
CREATE TABLE IF NOT EXISTS reviews (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  place_name      text        NOT NULL,
  category        text        NOT NULL CHECK (category IN ('hospital', 'grooming')),
  region          text        NOT NULL,
  visit_date      date        NOT NULL,
  service_detail  text        NOT NULL,
  total_price     integer     NOT NULL CHECK (total_price >= 0),
  short_review    text        NOT NULL,
  receipt_image_url text,
  created_at      timestamptz DEFAULT now() NOT NULL
);

-- 2. Row Level Security 활성화
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- 3. 정책: 누구나 리뷰 읽기 가능
CREATE POLICY "누구나 리뷰 읽기 가능"
  ON reviews FOR SELECT
  USING (true);

-- 4. 정책: 누구나 리뷰 작성 가능
CREATE POLICY "누구나 리뷰 작성 가능"
  ON reviews FOR INSERT
  WITH CHECK (true);

-- 5. Storage: 영수증 이미지 저장용 버킷 생성
INSERT INTO storage.buckets (id, name, public)
  VALUES ('receipts', 'receipts', true)
  ON CONFLICT (id) DO NOTHING;

-- 6. Storage 정책: 누구나 영수증 업로드 가능
CREATE POLICY "누구나 영수증 업로드 가능"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipts');

-- 7. Storage 정책: 누구나 영수증 조회 가능
CREATE POLICY "누구나 영수증 조회 가능"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts');
