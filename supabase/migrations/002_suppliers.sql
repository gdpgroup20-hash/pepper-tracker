-- Run in Supabase SQL Editor
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color_bg text not null,
  color_border text not null,
  color_text text not null,
  skus text[] default array[]::text[],
  created_at timestamptz default now()
);

alter table public.suppliers enable row level security;
create policy "Allow all" on public.suppliers for all using (true) with check (true);

-- Seed existing suppliers
insert into public.suppliers (name, color_bg, color_border, color_text) values
  ('Pilgrim''s', '#1e3a5f', '#3b82f6', '#93c5fd'),
  ('Essity', '#134e4a', '#14b8a6', '#99f6e4'),
  ('Aspire Bakeries', '#431407', '#f97316', '#fdba74'),
  ('Kettle Cuisine', '#450a0a', '#ef4444', '#fca5a5'),
  ('Kerry', '#2e1065', '#a855f7', '#d8b4fe'),
  ('Branding Iron', '#451a03', '#f59e0b', '#fde68a'),
  ('J.M. Smucker', '#052e16', '#22c55e', '#86efac')
on conflict (name) do nothing;
