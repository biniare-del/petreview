-- 뽐내기 게시글 테이블
CREATE TABLE IF NOT EXISTS brag_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id uuid REFERENCES pets(id) ON DELETE SET NULL,
  photo_urls text[] NOT NULL,
  caption text,
  like_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE brag_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brag_posts_select" ON brag_posts FOR SELECT USING (true);
CREATE POLICY "brag_posts_insert" ON brag_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "brag_posts_update_owner" ON brag_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "brag_posts_delete_owner" ON brag_posts FOR DELETE USING (auth.uid() = user_id);

-- 좋아요 테이블
CREATE TABLE IF NOT EXISTS brag_post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES brag_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE brag_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brag_likes_select" ON brag_post_likes FOR SELECT USING (true);
CREATE POLICY "brag_likes_insert" ON brag_post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "brag_likes_delete" ON brag_post_likes FOR DELETE USING (auth.uid() = user_id);

-- like_count 자동 증감 함수
CREATE OR REPLACE FUNCTION update_brag_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE brag_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE brag_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER brag_like_count_trigger
AFTER INSERT OR DELETE ON brag_post_likes
FOR EACH ROW EXECUTE FUNCTION update_brag_like_count();
