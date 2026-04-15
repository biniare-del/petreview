-- 댓글 신고 테이블
-- Supabase SQL Editor에서 실행하세요.

CREATE TABLE IF NOT EXISTS comment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  is_resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

ALTER TABLE comment_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "누구나 신고 가능" ON comment_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "관리자만 조회" ON comment_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "관리자만 수정" ON comment_reports FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
