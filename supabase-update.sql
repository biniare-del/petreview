-- =====================================================
-- 펫리뷰 Supabase 업데이트 SQL (영수증 인증 기능)
-- Supabase 대시보드 → SQL Editor 에서 실행하세요.
-- =====================================================

-- 1. reviews 테이블 컬럼 추가
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_verified  BOOLEAN DEFAULT false;
-- total_price 는 기존 스키마에 이미 있으므로 추가 불필요 (코드에서 total_price 사용)
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

-- =====================================================
-- 10. reviews 테이블에 status 컬럼 추가 (검수 상태)
-- =====================================================
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS status text DEFAULT 'approved';

-- 기존 데이터 보정:
-- 영수증 있지만 미인증 → pending (검수 대기)
UPDATE reviews
SET status = 'pending'
WHERE is_verified = false
  AND receipt_image_url IS NOT NULL
  AND receipt_image_url != ''
  AND status = 'approved';
-- 이미 인증된 리뷰는 approved 유지 (DEFAULT로 이미 설정됨)

-- =====================================================
-- 11. 커뮤니티 게시판 (posts, comments)
-- =====================================================

CREATE TABLE IF NOT EXISTS posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  tag        TEXT NOT NULL CHECK (tag IN ('병원추천', '질문', '자랑', '정보')),
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- posts RLS
CREATE POLICY "posts_select" ON posts FOR SELECT USING (true);
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_delete" ON posts FOR DELETE USING (auth.uid() = user_id);

-- comments RLS
CREATE POLICY "comments_select" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON comments FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 12. reviews 테이블 다항목 별점 컬럼 추가
-- =====================================================
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS score_kindness  INTEGER CHECK (score_kindness  BETWEEN 1 AND 5);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS score_price     INTEGER CHECK (score_price     BETWEEN 1 AND 5);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS score_facility  INTEGER CHECK (score_facility  BETWEEN 1 AND 5);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS score_wait      INTEGER CHECK (score_wait      BETWEEN 1 AND 5);

-- =====================================================
-- 13. post_likes 테이블 (커뮤니티 글 좋아요)
-- =====================================================
CREATE TABLE IF NOT EXISTS post_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_likes_select" ON post_likes FOR SELECT USING (true);
CREATE POLICY "post_likes_insert" ON post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "post_likes_delete" ON post_likes FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 14. posts 권한 변경 (삭제: 관리자만 / 수정: 본인만)
-- =====================================================
DROP POLICY IF EXISTS "posts_delete" ON posts;
CREATE POLICY "posts_delete" ON posts FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "posts_update" ON posts FOR UPDATE USING (auth.uid() = user_id);
