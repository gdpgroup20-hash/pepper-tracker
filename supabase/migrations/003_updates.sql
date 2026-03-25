-- Run in Supabase SQL Editor
alter table public.campaigns add column if not exists notes text default null;
