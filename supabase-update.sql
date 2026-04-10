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

-- 5. pets 테이블 컬럼 추가 (마이펫 프로필 확장)
-- Supabase 대시보드 → SQL Editor 에서 실행하세요.
ALTER TABLE pets ADD COLUMN IF NOT EXISTS breed           text;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS gender          text;         -- '수컷' | '암컷'
ALTER TABLE pets ADD COLUMN IF NOT EXISTS birth_date      date;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS is_neutered     boolean;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS weight          numeric(5,2); -- kg
ALTER TABLE pets ADD COLUMN IF NOT EXISTS registration_no text;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS notes           text;

-- =====================================================
-- 6. review_likes 테이블 (리뷰 도움이 됐어요)
-- =====================================================
CREATE TABLE IF NOT EXISTS review_likes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id  uuid REFERENCES reviews(id) ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(review_id, user_id)
);
ALTER TABLE review_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "누구나 좋아요 수 조회 가능"   ON review_likes FOR SELECT USING (true);
CREATE POLICY "로그인 사용자 좋아요 추가"    ON review_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "본인 좋아요 삭제"             ON review_likes FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 7. review_reports 테이블 (리뷰 신고)
-- =====================================================
CREATE TABLE IF NOT EXISTS review_reports (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id   uuid REFERENCES reviews(id) ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reason      text NOT NULL,
  is_resolved boolean DEFAULT false NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE(review_id, user_id)
);
ALTER TABLE review_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "로그인 사용자 신고 등록"   ON review_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "본인 신고 조회"            ON review_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "관리자 신고 전체 조회"     ON review_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "관리자 신고 처리"          ON review_reports FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- =====================================================
-- 8. contacts 테이블 (문의하기)
-- =====================================================
CREATE TABLE IF NOT EXISTS contacts (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  email       text NOT NULL,
  type        text NOT NULL,
  content     text NOT NULL,
  is_resolved boolean DEFAULT false NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "누구나 문의 등록 가능"  ON contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "관리자 문의 조회"       ON contacts FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "관리자 문의 처리"       ON contacts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
