-- Run in Supabase SQL Editor
-- Changes skus from text[] to jsonb[] for structured {name, gtin} objects
alter table public.suppliers alter column skus type jsonb using to_jsonb(skus);
alter table public.suppliers alter column skus set default '[]'::jsonb;
