-- =====================================================
-- 펫리뷰 Auth/소셜로그인 테이블 SQL
-- Supabase 대시보드 → SQL Editor 에서 실행하세요.
-- =====================================================

-- 1. profiles 테이블 (사용자 프로필)
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname    text,
  avatar_url  text,
  is_admin    boolean DEFAULT false,
  created_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles 전체 조회"   ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles 본인 생성"   ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles 본인 수정"   ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. 신규 가입 시 profiles 자동 생성 트리거
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, nickname, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. favorites 테이블 (단골 병원)
CREATE TABLE IF NOT EXISTS favorites (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  place_name  text NOT NULL,
  category    text,
  region      text,
  address     text,
  phone       text,
  created_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, place_name)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites 본인 조회"  ON favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "favorites 본인 등록"  ON favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "favorites 본인 삭제"  ON favorites FOR DELETE USING (auth.uid() = user_id);

-- 4. pets 테이블 (마이펫)
CREATE TABLE IF NOT EXISTS pets (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  species     text,
  age         integer,
  photo_url   text,
  created_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pets 본인 조회"  ON pets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "pets 본인 등록"  ON pets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pets 본인 수정"  ON pets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "pets 본인 삭제"  ON pets FOR DELETE USING (auth.uid() = user_id);

-- 5. reviews 테이블에 user_id 추가
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- 6. reviews INSERT 정책 → 로그인 필수 (기존 정책 교체)
DROP POLICY IF EXISTS "누구나 리뷰 작성 가능" ON reviews;
CREATE POLICY "로그인 사용자 리뷰 작성" ON reviews FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 7. reviews 본인 수정/삭제
CREATE POLICY "본인 리뷰 수정" ON reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "본인 리뷰 삭제" ON reviews FOR DELETE USING (auth.uid() = user_id);
