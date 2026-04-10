-- =====================================================
-- 펫리뷰 광고/배너 테이블 SQL
-- Supabase 대시보드 → SQL Editor 에서 실행하세요.
-- =====================================================

-- 1. 배너 테이블 (메인 페이지 상단 배너)
CREATE TABLE IF NOT EXISTS banners (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url   text,
  link_url    text,
  alt_text    text,
  is_active   boolean DEFAULT true,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banners 전체 조회"     ON banners FOR SELECT USING (true);
CREATE POLICY "banners 관리자만 등록" ON banners FOR INSERT
  WITH CHECK ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = true);
CREATE POLICY "banners 관리자만 수정" ON banners FOR UPDATE
  USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = true);
CREATE POLICY "banners 관리자만 삭제" ON banners FOR DELETE
  USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = true);

-- 2. 우수협력병원/이벤트 고정 노출 테이블 (검색 결과 상단)
CREATE TABLE IF NOT EXISTS featured_places (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  place_name  text NOT NULL,
  category    text NOT NULL CHECK (category IN ('hospital', 'grooming')),
  region      text,
  address     text,
  phone       text,
  tag         text DEFAULT '우수협력병원'
                   CHECK (tag IN ('우수협력병원', '이벤트')),
  is_active   boolean DEFAULT true,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE featured_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "featured_places 전체 조회"     ON featured_places FOR SELECT USING (true);
CREATE POLICY "featured_places 관리자만 등록" ON featured_places FOR INSERT
  WITH CHECK ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = true);
CREATE POLICY "featured_places 관리자만 수정" ON featured_places FOR UPDATE
  USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = true);
CREATE POLICY "featured_places 관리자만 삭제" ON featured_places FOR DELETE
  USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = true);
