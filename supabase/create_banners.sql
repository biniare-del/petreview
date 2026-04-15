-- 배너 테이블
create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  link_url text,
  alt_text text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 우수협력병원 / 이벤트 고정 노출 테이블
create table if not exists public.featured_places (
  id uuid primary key default gen_random_uuid(),
  place_name text not null,
  category text not null default 'hospital',
  region text,
  address text,
  phone text,
  tag text not null default '우수협력병원',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- RLS 활성화
alter table public.banners enable row level security;
alter table public.featured_places enable row level security;

-- 전체 읽기 허용 (공개)
create policy "banners_select" on public.banners for select using (true);
create policy "featured_places_select" on public.featured_places for select using (true);

-- 관리자만 insert/update/delete (profiles.is_admin 체크)
create policy "banners_admin_write" on public.banners for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "featured_places_admin_write" on public.featured_places for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
