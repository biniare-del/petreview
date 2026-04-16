-- C3/C4/C5: 진료메모 / 심장사상충 / 예방접종 기록 테이블
create table if not exists pet_health_records (
  id bigserial primary key,
  pet_id uuid references pets(id) on delete cascade,
  user_id uuid,
  record_type text not null,
  record_date date not null,
  content text,
  next_due_date date,
  created_at timestamp default now()
);

alter table pet_health_records enable row level security;

create policy "본인 기록만 조회" on pet_health_records
  for select using (auth.uid() = user_id);

create policy "본인 기록만 입력" on pet_health_records
  for insert with check (auth.uid() = user_id);

create policy "본인 기록만 삭제" on pet_health_records
  for delete using (auth.uid() = user_id);
