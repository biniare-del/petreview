-- comment_likes: 댓글 좋아요 테이블
create table if not exists comment_likes (
  id uuid default gen_random_uuid() primary key,
  comment_id uuid not null references review_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(comment_id, user_id)
);

alter table comment_likes enable row level security;

create policy "anyone can read comment_likes"
  on comment_likes for select using (true);

create policy "users can insert own like"
  on comment_likes for insert with check (auth.uid() = user_id);

create policy "users can delete own like"
  on comment_likes for delete using (auth.uid() = user_id);
