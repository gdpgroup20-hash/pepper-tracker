-- Run this in Supabase SQL Editor

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  distributor text not null,
  supplier text not null,
  skus text[] default array[]::text[],
  launch_month date not null,
  status text default 'Not contacted',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.campaigns enable row level security;
create policy "Allow all" on public.campaigns for all using (true) with check (true);
