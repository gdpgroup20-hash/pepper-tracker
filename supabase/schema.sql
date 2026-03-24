create table projects (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

alter table projects enable row level security;

create policy "Public read/write" on projects for all using (true) with check (true);
