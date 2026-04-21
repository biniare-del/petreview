-- 건의함 테이블
CREATE TABLE IF NOT EXISTS feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT '기타',
  title text NOT NULL,
  content text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- RLS 활성화
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

-- 누구나 INSERT 가능 (비로그인 포함)
CREATE POLICY "feedbacks_insert_public"
  ON feedbacks FOR INSERT
  WITH CHECK (true);

-- SELECT는 관리자만 (서비스롤 키 사용 시 자동 우회됨)
-- 일반 유저는 자신의 것만 조회 가능
CREATE POLICY "feedbacks_select_own"
  ON feedbacks FOR SELECT
  USING (user_id = auth.uid() OR auth.uid() IS NULL);
