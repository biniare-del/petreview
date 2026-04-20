-- review_comments 테이블 생성 + RLS 정책
-- Supabase SQL Editor에서 실행하세요

CREATE TABLE IF NOT EXISTS review_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id  uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    text NOT NULL CHECK (char_length(content) <= 300),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE review_comments ENABLE ROW LEVEL SECURITY;

-- 누구나 댓글을 읽을 수 있음 (비로그인 포함)
CREATE POLICY "댓글 읽기 허용" ON review_comments
  FOR SELECT USING (true);

-- 로그인한 사용자만 댓글 작성 가능
CREATE POLICY "로그인 사용자 댓글 작성" ON review_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 자신의 댓글만 삭제 가능
CREATE POLICY "자신의 댓글 삭제" ON review_comments
  FOR DELETE USING (auth.uid() = user_id);
