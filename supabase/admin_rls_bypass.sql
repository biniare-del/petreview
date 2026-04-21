-- 관리자(is_admin=true)가 모든 리뷰를 수정/삭제할 수 있는 RLS 정책
-- Supabase SQL 에디터에서 실행하세요

-- 기존 관리자 정책 제거 (이미 있을 경우 오류 방지)
drop policy if exists "admin can update any review" on reviews;
drop policy if exists "admin can delete any review" on reviews;

-- 관리자: 모든 리뷰 UPDATE 허용
create policy "admin can update any review"
  on reviews for update
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.is_admin = true
    )
  );

-- 관리자: 모든 리뷰 DELETE 허용
create policy "admin can delete any review"
  on reviews for delete
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.is_admin = true
    )
  );
